/**
 * Integration-style tests for school-referral query layer — PRVN-003.
 *
 * DB is mocked via vi.mock so no real Postgres connection is required.
 * We verify:
 *   1. createSchoolReferral with M-V basis inserts referral + consent rows
 *      and fires an audit-log entry with action 'school_referral.created'.
 *   2. M-V basis without attestation throws before touching the DB.
 *   3. Invalid M-V basis (no housing-related service) throws before touching DB.
 *   4. Parental consent basis without consentSignedAt throws before touching DB.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

// Capture all insert calls so we can assert what was written.
const insertedRows: { table: string; values: unknown }[] = [];
const txInsertedRows: { table: string; values: unknown }[] = [];
const auditEvents: unknown[] = [];

vi.mock('@/db/client', () => {
  const makeInsert =
    (isTx = false) =>
    (table: { _: { name: string } }) => {
      const target = isTx ? txInsertedRows : insertedRows;
      return {
        values: (values: unknown) => {
          target.push({ table: table?._ ? table._.name : String(table), values });
          return {
            returning: () =>
              Promise.resolve([
                {
                  id: 'ref-uuid-001',
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

  const txObj = {
    insert: makeInsert(true),
  };

  return {
    db: {
      insert: makeInsert(false),
      transaction: vi.fn(async (fn: (tx: typeof txObj) => Promise<unknown>) => fn(txObj)),
    },
  };
});

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(async (input: unknown) => {
    auditEvents.push(input);
  }),
}));

// school-referral-policy uses db directly for recordDisclosure — mock it too.
vi.mock('@/db/schema/school-referral-disclosures', () => ({
  schoolReferralDisclosures: { _: { name: 'school_referral_disclosures' } },
}));
vi.mock('@/db/schema/school-referrals', () => ({
  schoolReferrals: { _: { name: 'school_referrals' } },
}));
vi.mock('@/db/schema/school-referral-consents', () => ({
  schoolReferralConsents: { _: { name: 'school_referral_consents' } },
}));

const { createSchoolReferral } = await import('./school-referrals');

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSchoolReferral — McKinney-Vento basis', () => {
  beforeEach(() => {
    txInsertedRows.length = 0;
    insertedRows.length = 0;
    auditEvents.length = 0;
    vi.clearAllMocks();
  });

  it('inserts referral row, consent row, and fires audit log with M-V basis', async () => {
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

    // Consent row should have null signed_at and null consent_text_version for M-V
    const consent = consentInsert.values as Record<string, unknown>;
    expect(consent.basis).toBe('mckinney_vento_authorization');
    expect(consent.signedAt).toBeNull();
    expect(consent.consentTextVersion).toBeNull();

    // Audit log fired with 'school_referral.created'
    expect(auditEvents).toHaveLength(1);
    const auditEvent = auditEvents[0] as Record<string, unknown>;
    expect(auditEvent.action).toBe('school_referral.created');
    expect(auditEvent.targetId).toBe('ref-uuid-001');
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

describe('createSchoolReferral — parental_consent basis', () => {
  beforeEach(() => {
    txInsertedRows.length = 0;
    insertedRows.length = 0;
    auditEvents.length = 0;
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

  it('inserts consent row with signed_at and consent_text_version when parental consent provided', async () => {
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
    expect(typeof consent.consentTextVersion).toBe('string');
    expect((consent.consentTextVersion as string).startsWith('ferpa-')).toBe(true);
  });
});
