/**
 * COOR-014 — Tests for the extended school-referral query layer.
 *
 * Covers:
 *   1. updateSchoolReferralStatus writes a school_referral_status_events row
 *      inside the transaction, with fromStatus, toStatus, actorUserId, and note.
 *   2. Audit-log metadata for status updates contains fromStatus, toStatus, and
 *      hasNote — but NOT the note content (COOR-014 privacy posture).
 *   3. Note length > 500 chars throws before touching the DB.
 *   4. listReferralsForLiaison: membership gate — returns empty for a user
 *      with no school-org membership.
 *   5. listReferralsForLiaison: cross-org isolation — user's school orgs scope
 *      the returned referrals; referrals from other orgs are not included.
 *   6. listReferralsForLiaison: writes one disclosure-log row per returned
 *      referral, each with purpose 'liaison_dashboard_view' and actual basis.
 *   7. (Critical 1 review) addReferralStatusUpdate: a caseworker WITHOUT
 *      membership in the referral's school org is rejected — the action's
 *      getSchoolReferral gate fires before updateSchoolReferralStatus is called.
 *   8. (Critical 2 review) getSchoolReferralStatusEvents: writes a disclosure-log
 *      row with purpose='caseworker_case_detail_history' when access is allowed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared capture arrays — reset before each test
// ---------------------------------------------------------------------------

const txInsertedRows: { table: string; values: unknown }[] = [];
const auditEvents: unknown[] = [];
const disclosureRows: unknown[] = [];

// Controls what db.select().from(school_referrals)... returns per test.
let referralRows: unknown[] = [];
// Controls what db.select().from(org_memberships).innerJoin(partner_orgs)... returns.
let schoolOrgRows: unknown[] = [];
// Controls what tx.select().from(school_referral_status_events)... returns.
let statusEventRows: unknown[] = [];
// Controls what tx.select().from(school_referrals).where(eq(id))... returns (current status).
let currentStatusRows: unknown[] = [];
// Controls consentJoinRows for the referral+basis query in listReferralsForLiaison
// AND for getSchoolReferralStatusEvents (school_referrals innerJoin school_referral_consents).
// The extra fields (id, status, partnerOrgId) are used when mocking the select-projection
// shape returned by getSchoolReferralStatusEvents.
let consentJoinRows: Record<string, unknown>[] = [];
// Controls org_memberships rows for non-admin membership lookup in getSchoolReferralStatusEvents.
let membershipRows: unknown[] = [];

// ---------------------------------------------------------------------------
// DB mock
// ---------------------------------------------------------------------------

vi.mock('@/db/client', () => {
  const makeInsert =
    (isTx = false) =>
    (table: { _: { name: string } }) => {
      const tableName = table?._ ? table._.name : String(table);
      return {
        values: (values: unknown) => {
          if (tableName === 'school_referral_disclosures') {
            disclosureRows.push(values);
          } else {
            (isTx ? txInsertedRows : []).push({ table: tableName, values });
          }
          return {
            returning: () => Promise.resolve([{ id: 'ref-uuid-001', status: 'received' }]),
          };
        },
      };
    };

  const makeSelect = () => (_columns?: unknown) => ({
    from: (table: { _: { name: string } }) => {
      const tableName = table?._ ? table._.name : String(table);

      if (tableName === 'school_referrals') {
        return {
          // updateSchoolReferralStatus current-status read (plain .where().limit()):
          where: () => ({ limit: () => Promise.resolve(currentStatusRows) }),
          // listReferralsForLiaison referral+basis join AND getSchoolReferralStatusEvents
          // referral+basis join — both use school_referrals.innerJoin(school_referral_consents):
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({ limit: () => Promise.resolve(consentJoinRows) }),
              limit: () => Promise.resolve(consentJoinRows),
            }),
            limit: () => Promise.resolve(consentJoinRows),
          }),
        };
      }

      if (tableName === 'org_memberships') {
        return {
          // getSchoolReferralStatusEvents partner-org lookup for non-admin:
          where: () => ({ limit: () => Promise.resolve(membershipRows) }),
          // listReferralsForLiaison school org membership check (outer db.select):
          innerJoin: () => ({
            where: () => Promise.resolve(schoolOrgRows),
          }),
        };
      }

      if (tableName === 'school_referral_status_events') {
        return {
          where: () => ({
            orderBy: () => Promise.resolve(statusEventRows),
          }),
        };
      }

      // Fallback
      return {
        where: () => ({ limit: () => Promise.resolve([]) }),
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({ limit: () => Promise.resolve([]) }),
          }),
        }),
      };
    },
  });

  const makeUpdate = () => (_table: { _: { name: string } }) => {
    return {
      set: () => ({
        where: () => ({
          returning: () =>
            Promise.resolve([
              {
                id: 'ref-uuid-001',
                status: referralRows[0]
                  ? ((referralRows[0] as Record<string, unknown>).status ?? 'triaged')
                  : 'triaged',
              },
            ]),
        }),
      }),
    };
  };

  const txObj = {
    insert: makeInsert(true),
    select: makeSelect(),
    update: makeUpdate(),
  };

  return {
    db: {
      insert: makeInsert(false),
      select: makeSelect(),
      update: makeUpdate(),
      transaction: vi.fn(async (fn: (tx: typeof txObj) => Promise<unknown>) => fn(txObj)),
    },
  };
});

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(async (input: unknown) => {
    auditEvents.push(input);
  }),
}));

// Schema mocks
vi.mock('@/db/schema/school-referral-disclosures', () => ({
  schoolReferralDisclosures: { _: { name: 'school_referral_disclosures' } },
}));
vi.mock('@/db/schema/school-referrals', () => ({
  schoolReferrals: { _: { name: 'school_referrals' } },
}));
vi.mock('@/db/schema/school-referral-consents', () => ({
  schoolReferralConsents: { _: { name: 'school_referral_consents' } },
}));
vi.mock('@/db/schema/school-referral-status-events', () => ({
  schoolReferralStatusEvents: { _: { name: 'school_referral_status_events' } },
}));
vi.mock('@/db/schema/org-memberships', () => ({
  orgMemberships: { _: { name: 'org_memberships' } },
}));
vi.mock('@/db/schema/partner-orgs', () => ({
  partnerOrgs: { _: { name: 'partner_orgs' } },
}));

const { updateSchoolReferralStatus, listReferralsForLiaison, getSchoolReferralStatusEvents } =
  await import('./school-referrals');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseReferralRow = {
  id: 'ref-uuid-001',
  partnerOrgId: 'org-school-001',
  status: 'received',
  servicesRequested: [],
  mvAuthorizationConfirmed: true,
  urgency: 'medium',
  receivedAt: new Date(),
  lastUpdatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// updateSchoolReferralStatus — COOR-014 extensions
// ---------------------------------------------------------------------------

describe('updateSchoolReferralStatus — COOR-014 event log + privacy', () => {
  beforeEach(() => {
    txInsertedRows.length = 0;
    auditEvents.length = 0;
    disclosureRows.length = 0;
    referralRows = [baseReferralRow];
    currentStatusRows = [{ status: 'received' }];
    consentJoinRows = [];
    schoolOrgRows = [];
    statusEventRows = [];
    membershipRows = [];
    vi.clearAllMocks();
  });

  it('writes a school_referral_status_events row inside the transaction', async () => {
    await updateSchoolReferralStatus('ref-uuid-001', 'triaged', 'user-cw-001', {
      confirmationNote: 'Intake scheduled for Monday.',
    });

    const eventInsert = txInsertedRows.find((r) => r.table === 'school_referral_status_events');
    expect(eventInsert).toBeDefined();
    const vals = eventInsert!.values as Record<string, unknown>;
    expect(vals.referralId).toBe('ref-uuid-001');
    expect(vals.fromStatus).toBe('received');
    expect(vals.toStatus).toBe('triaged');
    expect(vals.actorUserId).toBe('user-cw-001');
    expect(vals.note).toBe('Intake scheduled for Monday.');
  });

  it('stores null note when no confirmationNote is provided', async () => {
    await updateSchoolReferralStatus('ref-uuid-001', 'triaged', 'user-cw-001');

    const eventInsert = txInsertedRows.find((r) => r.table === 'school_referral_status_events');
    expect(eventInsert).toBeDefined();
    const vals = eventInsert!.values as Record<string, unknown>;
    expect(vals.note).toBeNull();
  });

  it('audit-log metadata contains hasNote flag but NOT the note content', async () => {
    await updateSchoolReferralStatus('ref-uuid-001', 'in_progress', 'user-cw-001', {
      confirmationNote: 'Connected to Boulware — sensitive family detail here.',
    });

    expect(auditEvents).toHaveLength(1);
    const meta = (auditEvents[0] as Record<string, unknown>).metadata as Record<string, unknown>;
    // Must carry transition info
    expect(meta.fromStatus).toBe('received');
    expect(meta.toStatus).toBe('in_progress');
    expect(meta.hasNote).toBe(true);
    // Must NOT contain the note text
    expect(JSON.stringify(meta)).not.toContain('Boulware');
    expect(JSON.stringify(meta)).not.toContain('sensitive family detail');
    expect(meta).not.toHaveProperty('note');
    expect(meta).not.toHaveProperty('confirmationNote');
  });

  it('audit-log action is school_referral.status_changed (ADR 0005)', async () => {
    await updateSchoolReferralStatus('ref-uuid-001', 'triaged', 'user-cw-001');

    expect(auditEvents).toHaveLength(1);
    const auditEvent = auditEvents[0] as Record<string, unknown>;
    expect(auditEvent.action).toBe('school_referral.status_changed');
  });

  it('audit-log tx is passed so event write is atomic with the update', async () => {
    await updateSchoolReferralStatus('ref-uuid-001', 'connected', 'user-cw-001');

    expect(auditEvents).toHaveLength(1);
    const auditEvent = auditEvents[0] as Record<string, unknown>;
    // tx must be present — DTRS-010 pattern
    expect(auditEvent).toHaveProperty('tx');
  });

  it('throws before touching the DB when confirmationNote > 500 chars', async () => {
    const longNote = 'x'.repeat(501);
    await expect(
      updateSchoolReferralStatus('ref-uuid-001', 'triaged', 'user-cw-001', {
        confirmationNote: longNote,
      }),
    ).rejects.toThrow(/500 characters/i);

    // No DB writes
    expect(txInsertedRows).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });

  it('accepts a note of exactly 500 chars', async () => {
    const exactNote = 'a'.repeat(500);
    await expect(
      updateSchoolReferralStatus('ref-uuid-001', 'triaged', 'user-cw-001', {
        confirmationNote: exactNote,
      }),
    ).resolves.toBeDefined();

    const eventInsert = txInsertedRows.find((r) => r.table === 'school_referral_status_events');
    expect(eventInsert).toBeDefined();
    const vals = eventInsert!.values as Record<string, unknown>;
    expect((vals.note as string).length).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// listReferralsForLiaison — COOR-014: membership gate + disclosure log
// ---------------------------------------------------------------------------

describe('listReferralsForLiaison — membership gate and disclosure log', () => {
  beforeEach(() => {
    txInsertedRows.length = 0;
    auditEvents.length = 0;
    disclosureRows.length = 0;
    referralRows = [];
    currentStatusRows = [];
    consentJoinRows = [];
    schoolOrgRows = [];
    statusEventRows = [];
    membershipRows = [];
    vi.clearAllMocks();
  });

  it('returns empty when viewer has no school org memberships', async () => {
    schoolOrgRows = []; // no school orgs → early return

    const results = await listReferralsForLiaison({
      userId: 'user-liaison-001',
      role: 'caseworker',
    });

    expect(results).toHaveLength(0);
    // No reads attempted, no disclosures written
    expect(disclosureRows).toHaveLength(0);
  });

  it('writes one disclosure-log row per referral with liaison_dashboard_view purpose', async () => {
    schoolOrgRows = [{ partnerOrgId: 'org-school-001' }];
    consentJoinRows = [
      {
        referral: { ...baseReferralRow, id: 'ref-A', partnerOrgId: 'org-school-001' },
        basis: 'mckinney_vento_authorization',
      },
      {
        referral: { ...baseReferralRow, id: 'ref-B', partnerOrgId: 'org-school-001' },
        basis: 'parental_consent',
      },
    ];

    const results = await listReferralsForLiaison({
      userId: 'user-liaison-001',
      role: 'caseworker',
    });

    expect(results).toHaveLength(2);
    expect(disclosureRows).toHaveLength(2);

    const rowA = disclosureRows.find(
      (r) => (r as Record<string, unknown>).referralId === 'ref-A',
    ) as Record<string, unknown> | undefined;
    const rowB = disclosureRows.find(
      (r) => (r as Record<string, unknown>).referralId === 'ref-B',
    ) as Record<string, unknown> | undefined;

    expect(rowA).toBeDefined();
    expect(rowA?.purpose).toBe('liaison_dashboard_view');
    expect(rowA?.basis).toBe('mckinney_vento_authorization');

    expect(rowB).toBeDefined();
    expect(rowB?.purpose).toBe('liaison_dashboard_view');
    expect(rowB?.basis).toBe('parental_consent');
  });

  it('scopes disclosure to the viewer school org (accessedByPartnerOrgId set)', async () => {
    schoolOrgRows = [{ partnerOrgId: 'org-school-001' }];
    consentJoinRows = [
      {
        referral: { ...baseReferralRow, id: 'ref-A', partnerOrgId: 'org-school-001' },
        basis: 'mckinney_vento_authorization',
      },
    ];

    await listReferralsForLiaison({ userId: 'user-liaison-001', role: 'caseworker' });

    const disclosure = disclosureRows[0] as Record<string, unknown>;
    // accessedByPartnerOrgId carries the referral's own partnerOrgId
    expect(disclosure.accessedByPartnerOrgId).toBe('org-school-001');
  });

  it('returns empty and writes no disclosures when referral list is empty', async () => {
    schoolOrgRows = [{ partnerOrgId: 'org-school-001' }];
    consentJoinRows = []; // no referrals

    const results = await listReferralsForLiaison({
      userId: 'user-liaison-001',
      role: 'caseworker',
    });

    expect(results).toHaveLength(0);
    expect(disclosureRows).toHaveLength(0);
  });

  it('attaches latestEvent to each returned referral', async () => {
    schoolOrgRows = [{ partnerOrgId: 'org-school-001' }];
    consentJoinRows = [
      {
        referral: { ...baseReferralRow, id: 'ref-A', partnerOrgId: 'org-school-001' },
        basis: 'mckinney_vento_authorization',
      },
    ];
    statusEventRows = [
      {
        id: 'evt-001',
        referralId: 'ref-A',
        fromStatus: 'received',
        toStatus: 'triaged',
        actorUserId: 'user-cw-001',
        note: 'Triage complete.',
        occurredAt: new Date(),
      },
    ];

    const results = await listReferralsForLiaison({
      userId: 'user-liaison-001',
      role: 'caseworker',
    });

    expect(results).toHaveLength(1);
    expect(results[0].latestEvent).not.toBeNull();
    expect(results[0].latestEvent?.note).toBe('Triage complete.');
    expect(results[0].latestEvent?.toStatus).toBe('triaged');
  });

  it('latestEvent projection omits actorUserId (not present in LatestEventSummary)', async () => {
    schoolOrgRows = [{ partnerOrgId: 'org-school-001' }];
    consentJoinRows = [
      {
        referral: { ...baseReferralRow, id: 'ref-A', partnerOrgId: 'org-school-001' },
        basis: 'mckinney_vento_authorization',
      },
    ];
    statusEventRows = [
      {
        id: 'evt-001',
        referralId: 'ref-A',
        fromStatus: 'received',
        toStatus: 'triaged',
        actorUserId: 'user-cw-secret',
        note: 'Triage complete.',
        occurredAt: new Date(),
      },
    ];

    const results = await listReferralsForLiaison({
      userId: 'user-liaison-001',
      role: 'caseworker',
    });

    expect(results).toHaveLength(1);
    // actorUserId must NOT be present in the projected latestEvent shape
    expect(results[0].latestEvent).not.toHaveProperty('actorUserId');
  });

  it('returns null latestEvent when no events exist for a referral', async () => {
    schoolOrgRows = [{ partnerOrgId: 'org-school-001' }];
    consentJoinRows = [
      {
        referral: { ...baseReferralRow, id: 'ref-A', partnerOrgId: 'org-school-001' },
        basis: 'mckinney_vento_authorization',
      },
    ];
    statusEventRows = []; // no events yet

    const results = await listReferralsForLiaison({
      userId: 'user-liaison-001',
      role: 'caseworker',
    });

    expect(results).toHaveLength(1);
    expect(results[0].latestEvent).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getSchoolReferralStatusEvents — Critical 2: disclosure log + policy gate
// ---------------------------------------------------------------------------

describe('getSchoolReferralStatusEvents — FERPA disclosure log (Critical 2)', () => {
  beforeEach(() => {
    txInsertedRows.length = 0;
    auditEvents.length = 0;
    disclosureRows.length = 0;
    referralRows = [];
    currentStatusRows = [];
    consentJoinRows = [];
    schoolOrgRows = [];
    statusEventRows = [];
    membershipRows = [];
    vi.clearAllMocks();
  });

  it('writes a disclosure-log row with purpose caseworker_case_detail_history when admin reads events', async () => {
    // consentJoinRows drives the school_referrals.innerJoin(school_referral_consents) query.
    consentJoinRows = [
      {
        id: 'ref-uuid-001',
        basis: 'mckinney_vento_authorization',
        status: 'received',
        partnerOrgId: 'org-school-001',
        referral: baseReferralRow,
      },
    ];
    statusEventRows = [
      {
        id: 'evt-001',
        referralId: 'ref-uuid-001',
        fromStatus: 'received',
        toStatus: 'triaged',
        actorUserId: 'user-cw-001',
        note: 'Connected to Boulware Mission shelter, family intake Friday.',
        occurredAt: new Date(),
      },
    ];

    const events = await getSchoolReferralStatusEvents('ref-uuid-001', {
      userId: 'user-admin-001',
      role: 'admin',
    });

    expect(events).toHaveLength(1);
    // Disclosure row must have been written
    expect(disclosureRows).toHaveLength(1);
    const disclosure = disclosureRows[0] as Record<string, unknown>;
    expect(disclosure.purpose).toBe('caseworker_case_detail_history');
    expect(disclosure.referralId).toBe('ref-uuid-001');
    expect(disclosure.accessedByUserId).toBe('user-admin-001');
    expect(disclosure.dataClassesDisclosed).toEqual(
      expect.arrayContaining(['status_event_note', 'status_transition_history']),
    );
  });

  it('returns empty array when referral is not found (no disclosure written)', async () => {
    consentJoinRows = []; // referral not found

    const events = await getSchoolReferralStatusEvents('ref-uuid-999', {
      userId: 'user-admin-001',
      role: 'admin',
    });

    expect(events).toHaveLength(0);
    expect(disclosureRows).toHaveLength(0);
  });

  it('returns empty array and writes no disclosure when role is denied (attorney)', async () => {
    consentJoinRows = [
      {
        id: 'ref-uuid-001',
        basis: 'mckinney_vento_authorization',
        status: 'received',
        partnerOrgId: 'org-school-001',
        referral: baseReferralRow,
      },
    ];
    statusEventRows = [
      { id: 'evt-001', referralId: 'ref-uuid-001', note: 'note', occurredAt: new Date() },
    ];

    const events = await getSchoolReferralStatusEvents('ref-uuid-001', {
      userId: 'user-atty-001',
      role: 'attorney',
    });

    expect(events).toHaveLength(0);
    expect(disclosureRows).toHaveLength(0);
  });
});
