/**
 * Integration-style tests for school-referral query layer — PRVN-003.
 *
 * DB is mocked via vi.mock so no real Postgres connection is required.
 * We verify:
 *   1. createSchoolReferral with M-V basis inserts referral + consent rows
 *      and fires an audit-log entry with action 'school_referral.created'.
 *      The consent row carries the sentinel 'mckinney_vento_v1' for
 *      consent_text_version (Issue 4 / Option B).
 *   2. M-V basis without attestation throws before touching the DB.
 *   3. Invalid M-V basis (no housing-related service) throws before touching DB.
 *   4. Parental consent basis without consentSignedAt throws before touching DB.
 *   5. getSchoolReferral returns null for a caseworker without membership in
 *      the referral's partner org (Issue 1 membership gate).
 *   6. listSchoolReferralsForCaseworker writes one disclosure-log row per
 *      returned referral, each carrying the referral's actual basis (Issue 3).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

// Capture all insert calls so we can assert what was written.
const insertedRows: { table: string; values: unknown }[] = [];
const txInsertedRows: { table: string; values: unknown }[] = [];
const auditEvents: unknown[] = [];
const disclosureRows: unknown[] = [];

// Rows returned by db.select() — overrideable per test.
let selectRows: unknown[] = [];
// Membership rows returned by orgMemberships select — overrideable per test.
let membershipRows: unknown[] = [];
// Consent-join rows for list query — overrideable per test.
let consentJoinRows: { referral: unknown; basis: string }[] = [];

vi.mock('@/db/client', () => {
  const makeInsert =
    (isTx = false) =>
    (table: { _: { name: string } }) => {
      const target = isTx ? txInsertedRows : insertedRows;
      const tableName = table?._ ? table._.name : String(table);
      return {
        values: (values: unknown) => {
          if (tableName === 'school_referral_disclosures') {
            disclosureRows.push(values);
          } else {
            target.push({ table: tableName, values });
          }
          return {
            returning: () =>
              Promise.resolve([
                {
                  id: 'ref-uuid-001',
                  partnerOrgId: 'org-school-001',
                  status: 'received',
                  servicesRequested: [],
                  mvAuthorizationConfirmed: true,
                  urgency: 'medium',
                  receivedAt: new Date(),
                  lastUpdatedAt: new Date(),
                },
              ]),
          };
        },
      };
    };

  // makeSelect — a db.select() mock that routes by the table passed to .from().
  // Accepts an optional column-shape argument (ignored — we return whole rows).
  // school_referrals  → selectRows
  // org_memberships   → membershipRows
  // anything else     → []
  const makeSelect =
    () =>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_columns?: unknown) => ({
      from: (table: { _: { name: string } }) => {
        const tableName = table?._ ? table._.name : String(table);
        if (tableName === 'org_memberships') {
          return {
            where: () => ({ limit: () => Promise.resolve(membershipRows) }),
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({ limit: () => Promise.resolve(consentJoinRows) }),
              }),
            }),
          };
        }
        if (tableName === 'school_referrals') {
          return {
            where: () => ({ limit: () => Promise.resolve(selectRows) }),
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({ limit: () => Promise.resolve(consentJoinRows) }),
              }),
            }),
          };
        }
        // fallback (audit_log, disclosures, etc.)
        return {
          where: () => ({ limit: () => Promise.resolve([]) }),
          innerJoin: () => ({
            where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }),
          }),
        };
      },
    });

  const txObj = {
    insert: makeInsert(true),
    select: makeSelect(),
  };

  return {
    db: {
      insert: makeInsert(false),
      select: makeSelect(),
      transaction: vi.fn(async (fn: (tx: typeof txObj) => Promise<unknown>) => fn(txObj)),
    },
  };
});

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(async (input: unknown) => {
    auditEvents.push(input);
  }),
}));

// schema mocks
vi.mock('@/db/schema/school-referral-disclosures', () => ({
  schoolReferralDisclosures: { _: { name: 'school_referral_disclosures' } },
}));
vi.mock('@/db/schema/school-referrals', () => ({
  schoolReferrals: { _: { name: 'school_referrals' } },
}));
vi.mock('@/db/schema/school-referral-consents', () => ({
  schoolReferralConsents: { _: { name: 'school_referral_consents' } },
}));
vi.mock('@/db/schema/org-memberships', () => ({
  orgMemberships: { _: { name: 'org_memberships' } },
}));

const { createSchoolReferral, getSchoolReferral, listSchoolReferralsForCaseworker } = await import(
  './school-referrals'
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mvInput = {
  partnerOrgId: 'org-school-001',
  referringUserId: 'user-liaison-001',
  studentFirstInitial: 'J',
  guardianName: 'Maria Lopez',
  guardianContact: '270-555-0101',
  housingSituation: 'Family is sleeping in a vehicle after losing housing.',
  servicesRequested: ['shelter_placement', 'case_management'],
  urgency: 'high' as const,
  basis: 'mckinney_vento_authorization' as const,
  mvAuthorizationConfirmed: true,
};

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
// createSchoolReferral — McKinney-Vento basis
// ---------------------------------------------------------------------------

describe('createSchoolReferral — McKinney-Vento basis', () => {
  beforeEach(() => {
    txInsertedRows.length = 0;
    insertedRows.length = 0;
    auditEvents.length = 0;
    disclosureRows.length = 0;
    selectRows = [];
    membershipRows = [];
    consentJoinRows = [];
    vi.clearAllMocks();
  });

  it('inserts referral row, consent row with sentinel, and fires audit log', async () => {
    const referral = await createSchoolReferral(mvInput);

    // Returns a referral object
    expect(referral).toBeDefined();
    expect(referral.id).toBe('ref-uuid-001');

    // Two inserts happened inside the transaction: school_referrals + school_referral_consents
    expect(txInsertedRows).toHaveLength(2);
    const referralInsert = txInsertedRows[0];
    const consentInsert = txInsertedRows[1];

    // Verify no last name or DOB in referral row values
    expect(JSON.stringify(referralInsert.values)).not.toMatch(
      /lastName|last_name|dateOfBirth|dob/i,
    );

    // Consent row should carry the named sentinel constant (Issue 4, Option B)
    // — not null, self-documents the statutory basis.
    const consent = consentInsert.values as Record<string, unknown>;
    expect(consent.basis).toBe('mckinney_vento_authorization');
    expect(consent.signedAt).toBeNull();
    expect(consent.consentTextVersion).toBe('mckinney_vento_v1'); // MCKINNEY_VENTO_CONSENT_VERSION_SENTINEL

    // Audit log fired with 'school_referral.created' and carries tx (Issue 2)
    expect(auditEvents).toHaveLength(1);
    const auditEvent = auditEvents[0] as Record<string, unknown>;
    expect(auditEvent.action).toBe('school_referral.created');
    expect(auditEvent.targetId).toBe('ref-uuid-001');
    expect(auditEvent).toHaveProperty('tx'); // tx passed — rolls back atomically
    expect((auditEvent.metadata as Record<string, unknown>).basis).toBe(
      'mckinney_vento_authorization',
    );
  });

  it('throws when mvAuthorizationConfirmed is false', async () => {
    await expect(
      createSchoolReferral({ ...mvInput, mvAuthorizationConfirmed: false }),
    ).rejects.toThrow(/mvAuthorizationConfirmed/i);
  });

  it('throws when housing situation is too short for M-V (M-V validation fails)', async () => {
    await expect(createSchoolReferral({ ...mvInput, housingSituation: 'Car' })).rejects.toThrow(
      /McKinney-Vento basis invalid/i,
    );
  });

  it('throws when only non-housing services are requested for M-V', async () => {
    await expect(
      createSchoolReferral({ ...mvInput, servicesRequested: ['transportation'] }),
    ).rejects.toThrow(/McKinney-Vento basis invalid/i);
  });
});

// ---------------------------------------------------------------------------
// createSchoolReferral — parental_consent basis
// ---------------------------------------------------------------------------

describe('createSchoolReferral — parental_consent basis', () => {
  beforeEach(() => {
    txInsertedRows.length = 0;
    insertedRows.length = 0;
    auditEvents.length = 0;
    disclosureRows.length = 0;
    selectRows = [];
    membershipRows = [];
    consentJoinRows = [];
    vi.clearAllMocks();
  });

  it('throws when consentSignedAt is missing for parental_consent', async () => {
    await expect(
      createSchoolReferral({
        ...mvInput,
        basis: 'parental_consent',
        mvAuthorizationConfirmed: false,
        consentSignedAt: undefined,
      }),
    ).rejects.toThrow(/consentSignedAt/i);
  });

  it('inserts consent row with signed_at and parental version when parental_consent provided', async () => {
    await createSchoolReferral({
      ...mvInput,
      basis: 'parental_consent',
      mvAuthorizationConfirmed: false,
      consentSignedAt: new Date('2026-04-15T10:00:00Z'),
      consentSignedMethod: 'in_person',
      consentConsenterName: 'Maria Lopez',
      consentConsenterRelationship: 'parent',
    });

    expect(txInsertedRows).toHaveLength(2);
    const consent = txInsertedRows[1].values as Record<string, unknown>;
    expect(consent.basis).toBe('parental_consent');
    expect(consent.signedAt).toBeInstanceOf(Date);
    expect(consent.consentTextVersion).toBe('ferpa-parental-v1');
  });

  it('inserts consent row with eligible-student version when eligible_student_consent provided', async () => {
    await createSchoolReferral({
      ...mvInput,
      basis: 'eligible_student_consent',
      mvAuthorizationConfirmed: false,
      consentSignedAt: new Date('2026-04-15T10:00:00Z'),
      consentSignedMethod: 'in_person',
      consentConsenterName: 'Jordan Smith',
      consentConsenterRelationship: 'self',
    });

    expect(txInsertedRows).toHaveLength(2);
    const consent = txInsertedRows[1].values as Record<string, unknown>;
    expect(consent.basis).toBe('eligible_student_consent');
    expect(consent.signedAt).toBeInstanceOf(Date);
    // Must stamp the eligible-student version, NOT the parental version.
    expect(consent.consentTextVersion).toBe('ferpa-eligible-student-v1');
  });
});

// ---------------------------------------------------------------------------
// getSchoolReferral — Issue 1: partner-org membership gate
// ---------------------------------------------------------------------------

describe('getSchoolReferral — partner-org membership gate', () => {
  beforeEach(() => {
    txInsertedRows.length = 0;
    insertedRows.length = 0;
    auditEvents.length = 0;
    disclosureRows.length = 0;
    selectRows = [baseReferralRow];
    membershipRows = [];
    consentJoinRows = [];
    vi.clearAllMocks();
  });

  it('returns null for a caseworker without membership in the referral partner org', async () => {
    // selectRows = [baseReferralRow] → referral found
    // membershipRows = [] → no membership
    membershipRows = [];

    const result = await getSchoolReferral('ref-uuid-001', {
      userId: 'user-cw-outsider',
      role: 'caseworker',
    });

    expect(result).toBeNull();
  });

  it('writes an access_denied disclosure-log row when membership is missing', async () => {
    membershipRows = [];

    await getSchoolReferral('ref-uuid-001', {
      userId: 'user-cw-outsider',
      role: 'caseworker',
    });

    // A disclosure row should have been written with purpose 'access_denied'
    expect(disclosureRows.length).toBeGreaterThan(0);
    const denied = disclosureRows[0] as Record<string, unknown>;
    expect(denied.purpose).toBe('access_denied');
    expect(denied.accessedByUserId).toBe('user-cw-outsider');
  });

  it('returns the referral for a caseworker WITH membership in the referral partner org', async () => {
    membershipRows = [{ id: 'membership-001' }];

    const result = await getSchoolReferral('ref-uuid-001', {
      userId: 'user-cw-member',
      role: 'caseworker',
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe('ref-uuid-001');
  });

  it('returns the referral for admin without any membership check', async () => {
    // membershipRows empty — admin bypasses membership check
    membershipRows = [];

    const result = await getSchoolReferral('ref-uuid-001', {
      userId: 'user-admin-001',
      role: 'admin',
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe('ref-uuid-001');
  });

  it('returns null when referral is not found (selectRows empty)', async () => {
    selectRows = [];
    membershipRows = [{ id: 'membership-001' }];

    const result = await getSchoolReferral('ref-uuid-999', {
      userId: 'user-cw-member',
      role: 'caseworker',
    });

    expect(result).toBeNull();
  });

  it('writes a school_referral.access_denied_role audit-log entry when role is denied', async () => {
    // selectRows = [baseReferralRow] → referral found
    // attorney has no access per canAccessSchoolReferral
    selectRows = [baseReferralRow];

    const result = await getSchoolReferral('ref-uuid-001', {
      userId: 'user-atty-001',
      role: 'attorney',
    });

    expect(result).toBeNull();
    // An audit-log row should have been written with the role-denied action
    expect(auditEvents).toHaveLength(1);
    const auditEvent = auditEvents[0] as Record<string, unknown>;
    expect(auditEvent.action).toBe('school_referral.access_denied_role');
    expect(auditEvent.targetId).toBe('ref-uuid-001');
    expect((auditEvent.metadata as Record<string, unknown>).viewer_role).toBe('attorney');
    expect((auditEvent.metadata as Record<string, unknown>).basis).toBe('role_denied');
    // No disclosure row — FERPA § 99.32 logs disclosures, not denials
    expect(disclosureRows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// listSchoolReferralsForCaseworker — Issue 3: per-row disclosure basis
// ---------------------------------------------------------------------------

describe('listSchoolReferralsForCaseworker — per-row disclosure-log basis', () => {
  beforeEach(() => {
    txInsertedRows.length = 0;
    insertedRows.length = 0;
    auditEvents.length = 0;
    disclosureRows.length = 0;
    selectRows = [];
    membershipRows = [];
    consentJoinRows = [];
    vi.clearAllMocks();
  });

  it('writes one disclosure-log row per referral, each with the referral actual basis', async () => {
    // Mix of two referrals with different bases
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

    const results = await listSchoolReferralsForCaseworker(
      { userId: 'user-cw-001', role: 'caseworker' },
      { partnerOrgId: 'org-school-001' },
    );

    expect(results).toHaveLength(2);
    // Two disclosure rows — one per referral
    expect(disclosureRows).toHaveLength(2);

    const rowA = disclosureRows.find(
      (r) => (r as Record<string, unknown>).referralId === 'ref-A',
    ) as Record<string, unknown> | undefined;
    const rowB = disclosureRows.find(
      (r) => (r as Record<string, unknown>).referralId === 'ref-B',
    ) as Record<string, unknown> | undefined;

    expect(rowA).toBeDefined();
    expect(rowA?.basis).toBe('mckinney_vento_authorization');
    expect(rowA?.purpose).toBe('caseworker_queue_view');

    expect(rowB).toBeDefined();
    expect(rowB?.basis).toBe('parental_consent');
    expect(rowB?.purpose).toBe('caseworker_queue_view');
  });

  it('writes no disclosure rows when no referrals are returned', async () => {
    consentJoinRows = [];

    const results = await listSchoolReferralsForCaseworker(
      { userId: 'user-cw-001', role: 'caseworker' },
      {},
    );

    expect(results).toHaveLength(0);
    expect(disclosureRows).toHaveLength(0);
  });

  it('drops referrals the viewer cannot access and writes no disclosure for denied rows', async () => {
    // attorney cannot access school referrals
    consentJoinRows = [
      {
        referral: { ...baseReferralRow, id: 'ref-A', partnerOrgId: 'org-school-001' },
        basis: 'parental_consent',
      },
    ];

    const results = await listSchoolReferralsForCaseworker(
      { userId: 'user-atty-001', role: 'attorney' },
      {},
    );

    expect(results).toHaveLength(0);
    expect(disclosureRows).toHaveLength(0);
  });
});
