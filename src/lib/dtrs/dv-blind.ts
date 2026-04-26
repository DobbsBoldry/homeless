import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { dvFlaggedPersons } from '@/db/schema/dv-flags';
import type { UserRole } from '@/db/schema/enums';

/**
 * Roles allowed to see un-redacted location/address data on DV-flagged
 * subjects. Attorneys actively defending a survivor in court need the
 * address; everyone else gets redacted. DV-trained caseworkers also
 * keep access — they're who set the flag in the first place.
 *
 * A future enhancement (post-DTRS-005 advisor session) is to make this
 * per-flag rather than per-role: a survivor could opt to share their
 * address with one specific caseworker and no one else.
 */
const DV_ADDRESS_VIEW_ROLES: ReadonlySet<UserRole> = new Set(['attorney', 'caseworker']);

export const REDACTED_PLACEHOLDER = 'LOCATION_REDACTED';

export function viewerCanSeeDvAddresses(role: UserRole): boolean {
  return DV_ADDRESS_VIEW_ROLES.has(role);
}

/**
 * Returns the set of subject identifiers (synthetic_person_ref OR
 * phone OR — in eviction-filings — defendant name+address pair) that
 * are currently DV-flagged. "Currently" = flag_cleared_at IS NULL.
 *
 * Pass an empty `candidates` to skip the round-trip; the function
 * short-circuits to an empty Set.
 */
export async function dvFlaggedSubset(candidates: readonly string[]): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();
  const rows = await db
    .select({ subject: dvFlaggedPersons.subjectIdentifier })
    .from(dvFlaggedPersons)
    .where(
      and(
        inArray(dvFlaggedPersons.subjectIdentifier, candidates as string[]),
        isNull(dvFlaggedPersons.flagClearedAt),
      ),
    );
  return new Set(rows.map((r) => r.subject));
}

/**
 * One-off check by subject identifier. Use the bulk variant in
 * `dvFlaggedSubset` for any list view; this helper is for single
 * record reads (e.g. a case detail page).
 */
export async function isDvFlagged(subjectIdentifier: string): Promise<boolean> {
  const [row] = await db
    .select({ id: dvFlaggedPersons.id })
    .from(dvFlaggedPersons)
    .where(
      and(
        eq(dvFlaggedPersons.subjectIdentifier, subjectIdentifier),
        isNull(dvFlaggedPersons.flagClearedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Pure helper. Given a record with optional address fields, replace
 * them with the redacted placeholder when `redact` is true. Used in
 * page-level rendering and tested with shared fixtures.
 */
export function redactAddress<
  T extends {
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    defendantAddress?: string | null;
  },
>(record: T, redact: boolean): T {
  if (!redact) return record;
  const next: T = { ...record };
  if ('addressLine1' in next) next.addressLine1 = REDACTED_PLACEHOLDER;
  if ('city' in next) next.city = null;
  if ('state' in next) next.state = null;
  if ('postalCode' in next) next.postalCode = null;
  if ('defendantAddress' in next) next.defendantAddress = REDACTED_PLACEHOLDER;
  return next;
}
