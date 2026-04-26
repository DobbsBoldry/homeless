/**
 * Single source of truth for the synthetic-person identifier shape.
 * Used by the public consent panel (`/p/[ref]/consent`) and its
 * server actions to gate URL params before any DB read/write.
 *
 * Format today: `SYN-PERSON-<alphanumeric>`. Post-Phase-2 (when the
 * data trust steward holds the real-id mapping) this becomes a
 * URL-safe hash; bump the regex when that happens.
 */
export const SYNTHETIC_PERSON_REF_RE = /^SYN-PERSON-[A-Z0-9]+$/;

export function isValidSyntheticPersonRef(ref: string): boolean {
  return SYNTHETIC_PERSON_REF_RE.test(ref);
}
