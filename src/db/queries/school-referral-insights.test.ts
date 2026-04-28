/**
 * Integration-style tests for getLiaisonInsights — PRVN-004.
 *
 * DB is mocked via vi.mock so no real Postgres connection is required.
 * Mirrors the mock pattern from school-referrals.test.ts.
 *
 * Tests:
 *   1. Returns zero-shaped insights when viewer has no school memberships.
 *   2. Returns zero-shaped insights when school membership exists but no
 *      referrals fall within the time window.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

const auditEvents: unknown[] = [];
const disclosureRows: unknown[] = [];

// Configurable per-test: rows returned by the membership lookup.
let membershipRows: unknown[] = [];
// Configurable per-test: rows returned by the referral join inside the tx.
let referralRows: unknown[] = [];
// Configurable per-test: rows returned by the status events query.
let statusEventRows: unknown[] = [];

vi.mock('@/db/client', () => {
  /**
   * Build a thenable chain for rows. Every method returns the same chain so
   * the query can be awaited at any point in the call chain:
   *
   *   await db.select().from(t).where()               → rows
   *   await db.select().from(t).innerJoin().where().orderBy().limit()  → rows
   *   await db.select().from(t).where().orderBy()     → rows
   */
  const makeChain = (rows: unknown[]): Record<string, unknown> => {
    const resolved = Promise.resolve(rows);
    const chain: Record<string, unknown> = {
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable — mock for chained Drizzle query
      then: resolved.then.bind(resolved),
      catch: resolved.catch.bind(resolved),
      finally: resolved.finally.bind(resolved),
    };
    // Each method returns a fresh chain resolving to the same rows.
    for (const method of ['where', 'innerJoin', 'orderBy', 'limit', 'leftJoin']) {
      chain[method] = () => makeChain(rows);
    }
    return chain;
  };

  const makeSelect = () => (_cols?: unknown) => ({
    from: (table: { _: { name: string } }) => {
      const name = table?._?.name ?? String(table);

      if (name === 'org_memberships') return makeChain(membershipRows);
      if (name === 'school_referrals') return makeChain(referralRows);
      if (name === 'school_referral_status_events') return makeChain(statusEventRows);

      // Fallback (partner_orgs standalone, audit_log, etc.)
      return makeChain([]);
    },
  });

  const makeInsert = () => (_table: unknown) => ({
    values: (values: unknown) => {
      const t = _table as { _: { name: string } } | undefined;
      const name = t?._?.name ?? '';
      if (name === 'school_referral_disclosures') {
        disclosureRows.push(values);
      }
      return { returning: () => Promise.resolve([]) };
    },
  });

  const txObj = {
    select: makeSelect(),
    insert: makeInsert(),
  };

  return {
    db: {
      select: makeSelect(),
      insert: makeInsert(),
      transaction: vi.fn(async (fn: (tx: typeof txObj) => Promise<unknown>) => fn(txObj)),
    },
  };
});

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(async (input: unknown) => {
    auditEvents.push(input);
  }),
}));

// schema mocks (table shape just needs _.name)
vi.mock('@/db/schema/school-referrals', () => ({
  schoolReferrals: { _: { name: 'school_referrals' } },
}));
vi.mock('@/db/schema/school-referral-consents', () => ({
  schoolReferralConsents: { _: { name: 'school_referral_consents' } },
}));
vi.mock('@/db/schema/school-referral-status-events', () => ({
  schoolReferralStatusEvents: { _: { name: 'school_referral_status_events' } },
}));
vi.mock('@/db/schema/school-referral-disclosures', () => ({
  schoolReferralDisclosures: { _: { name: 'school_referral_disclosures' } },
}));
vi.mock('@/db/schema/org-memberships', () => ({
  orgMemberships: { _: { name: 'org_memberships' } },
}));
vi.mock('@/db/schema/partner-orgs', () => ({
  partnerOrgs: { _: { name: 'partner_orgs' } },
}));

const { getLiaisonInsights } = await import('./school-referrals');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VIEWER = { userId: 'user-liaison-001', role: 'caseworker' as const };
const WINDOW = { since: new Date('2026-04-01T00:00:00Z'), until: new Date('2026-04-28T23:59:59Z') };

function makeReferralRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'ref-uuid-001',
    status: 'received',
    servicesRequested: ['shelter_placement', 'case_management'],
    receivedAt: new Date('2026-04-10T12:00:00Z'),
    partnerOrgId: 'org-school-001',
    basis: 'mckinney_vento_authorization',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getLiaisonInsights', () => {
  beforeEach(() => {
    auditEvents.length = 0;
    disclosureRows.length = 0;
    membershipRows = [];
    referralRows = [];
    statusEventRows = [];
    vi.clearAllMocks();
  });

  // ── zero memberships ─────────────────────────────────────────────────────

  it('returns zero-shaped insights when viewer has no school memberships', async () => {
    membershipRows = []; // no school org rows

    const result = await getLiaisonInsights(VIEWER, WINDOW);

    expect(result.totalReferrals).toBe(0);
    expect(result.connectionRate).toBeNull();
    expect(result.connectedCount).toBe(0);
    expect(result.serviceBreakdown).toEqual([]);
    expect(result.medianTimeToConnectDays).toBeNull();
    // All six statuses present with count 0
    expect(result.statusDistribution).toHaveLength(6);
    expect(result.statusDistribution.every((r) => r.count === 0)).toBe(true);
  });

  it('writes no disclosure rows and no audit event when viewer has no school memberships', async () => {
    membershipRows = [];

    await getLiaisonInsights(VIEWER, WINDOW);

    expect(disclosureRows).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });

  // ── zero referrals in window ─────────────────────────────────────────────

  it('returns zero-shaped insights when membership exists but no referrals in window', async () => {
    membershipRows = [{ partnerOrgId: 'org-school-001' }];
    referralRows = []; // no referrals returned from the join

    const result = await getLiaisonInsights(VIEWER, WINDOW);

    expect(result.totalReferrals).toBe(0);
    expect(result.connectionRate).toBeNull();
    expect(result.connectedCount).toBe(0);
    expect(result.serviceBreakdown).toEqual([]);
    expect(result.medianTimeToConnectDays).toBeNull();
  });

  it('writes one audit event and no disclosure rows for zero-referral case', async () => {
    membershipRows = [{ partnerOrgId: 'org-school-001' }];
    referralRows = [];

    await getLiaisonInsights(VIEWER, WINDOW);

    // Transaction ran — audit log should have been called.
    expect(auditEvents).toHaveLength(1);
    const evt = auditEvents[0] as Record<string, unknown>;
    expect(evt.action).toBe('school_referral.aggregate_insights_viewed');
    expect((evt.metadata as Record<string, unknown>).totalReferrals).toBe(0);

    // No referrals → no disclosure rows.
    expect(disclosureRows).toHaveLength(0);
  });

  // ── happy path ────────────────────────────────────────────────────────────

  it('returns correct aggregate counts for a set of referral rows', async () => {
    membershipRows = [{ partnerOrgId: 'org-school-001' }];
    referralRows = [
      makeReferralRow({ id: 'ref-A', status: 'connected' }),
      makeReferralRow({ id: 'ref-B', status: 'closed_completed' }),
      makeReferralRow({ id: 'ref-C', status: 'received', servicesRequested: ['food_assistance'] }),
    ];
    statusEventRows = [
      {
        referralId: 'ref-A',
        toStatus: 'connected',
        occurredAt: new Date('2026-04-15T12:00:00Z'),
      },
      {
        referralId: 'ref-B',
        toStatus: 'closed_completed',
        occurredAt: new Date('2026-04-20T12:00:00Z'),
      },
    ];

    const result = await getLiaisonInsights(VIEWER, WINDOW);

    expect(result.totalReferrals).toBe(3);
    expect(result.connectedCount).toBe(2);
    expect(result.connectionRate).toBeCloseTo(2 / 3);

    // All 6 statuses present; 'connected' and 'closed_completed' each have 1.
    expect(result.statusDistribution.find((r) => r.status === 'connected')?.count).toBe(1);
    expect(result.statusDistribution.find((r) => r.status === 'closed_completed')?.count).toBe(1);
    expect(result.statusDistribution.find((r) => r.status === 'received')?.count).toBe(1);
  });

  it('writes one disclosure-log row per referral counted', async () => {
    membershipRows = [{ partnerOrgId: 'org-school-001' }];
    referralRows = [makeReferralRow({ id: 'ref-A' }), makeReferralRow({ id: 'ref-B' })];

    await getLiaisonInsights(VIEWER, WINDOW);

    expect(disclosureRows).toHaveLength(2);
    for (const row of disclosureRows as Array<Record<string, unknown>>) {
      expect(row.purpose).toBe('liaison_aggregate_insights');
      expect(row.accessedByUserId).toBe(VIEWER.userId);
    }
  });

  it('audit metadata contains only counts and IDs (no demographics)', async () => {
    membershipRows = [{ partnerOrgId: 'org-school-001' }];
    referralRows = [makeReferralRow()];

    await getLiaisonInsights(VIEWER, WINDOW);

    const evt = auditEvents[0] as Record<string, unknown>;
    const meta = evt.metadata as Record<string, unknown>;

    // Must have totalReferrals and schoolOrgIds
    expect(meta).toHaveProperty('totalReferrals');
    expect(meta).toHaveProperty('schoolOrgIds');

    // Must NOT have any PII-shaped fields
    const metaStr = JSON.stringify(meta);
    expect(metaStr).not.toMatch(/guardian|student|housing|note|initial/i);
  });
});
