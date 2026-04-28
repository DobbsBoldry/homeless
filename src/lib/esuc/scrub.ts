/**
 * Clinical-note de-identification (#247).
 *
 * Phase 1 strategy: pattern-based (regex) scrub. Pre-BAA we run on
 * synthetic data only, so the goal is "every leak vector named in the
 * issue is caught with a deterministic pattern" — not "matches AWS
 * Comprehend Medical's recall." Per ADR 0002, the upgrade path post-BAA
 * is AWS Comprehend Medical (HIPAA-eligible, NER-based), with this
 * regex layer staying as a defense-in-depth pre-pass.
 *
 * Applied at TWO points (belt + suspenders):
 *   1. Ingest — `scripts/load-ed-encounters.ts` and the future Epic FHIR
 *      webhook scrub `notes` BEFORE INSERT. Raw PHI never lands in
 *      `ed_encounters.notes`.
 *   2. Prompt-build — `care-plan.ts` re-scrubs at build time as
 *      defense-in-depth. A regression in either layer fails closed.
 *
 * The leak vectors covered (each with a corresponding test):
 *   - Honorific + name           ("Dr. Smith")
 *   - Honorific-less provider    ("signed off by Smith")
 *   - Family-relationship + name ("daughter Mary")
 *   - Phone numbers
 *   - Email addresses
 *   - SSNs
 *   - Address fragments          ("living at 123 Main")
 *   - Street addresses           ("123 Main St")
 *   - MRN-shaped strings         (MRN: 1234567 / "Medical Record Number")
 *   - Specific dates             (YYYY-MM-DD, MM/DD/YYYY) — combined with
 *                                a diagnosis these are reidentifying
 *
 * What this DOESN'T catch (deliberate gaps; AWS Comprehend would):
 *   - Standalone names without an honorific or context word
 *   - Misspellings of relationship words
 *   - Free-form addresses that don't match street-suffix patterns
 *   - Non-US phone formats
 *   - International ID formats
 *   These are the classes that warrant the AWS upgrade post-BAA.
 */

// Order matters: more-specific patterns run first so they don't get
// fragmented by broader replacements (e.g. SSN before generic digit runs).
type Rule = { name: string; re: RegExp; replacement: string };

const FAMILY_RELATIONSHIPS = [
  'mother',
  'father',
  'son',
  'daughter',
  'sister',
  'brother',
  'wife',
  'husband',
  'spouse',
  'partner',
  'aunt',
  'uncle',
  'cousin',
  'grandmother',
  'grandfather',
  'grandson',
  'granddaughter',
  'mom',
  'dad',
  'parent',
  'child',
  'kid',
];

const PROVIDER_CONTEXT_VERBS = [
  'signed off by',
  'signed by',
  'authored by',
  'attending',
  'reviewed by',
  'consulted',
  'seen by',
  'discussed with',
  'per',
];

const STREET_SUFFIXES = [
  'st',
  'street',
  'ave',
  'avenue',
  'rd',
  'road',
  'blvd',
  'boulevard',
  'dr',
  'drive',
  'ln',
  'lane',
  'ct',
  'court',
  'pl',
  'place',
  'way',
  'pkwy',
  'parkway',
  'ter',
  'terrace',
];

const RULES: Rule[] = [
  // SSN — most specific shape; do first.
  { name: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED-SSN]' },

  // Email
  {
    name: 'email',
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    replacement: '[REDACTED-EMAIL]',
  },

  // Phone — US-shaped, before MRN's digit pattern.
  {
    name: 'phone',
    re: /\+?1?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/g,
    replacement: '[REDACTED-PHONE]',
  },

  // MRN — explicit "MRN: 12345" or "Medical Record Number 12345"
  {
    name: 'mrn',
    re: /\b(?:MRN|medical\s+record\s+(?:number|no\.?|#))[\s:#]*\d{4,}\b/gi,
    replacement: '[REDACTED-MRN]',
  },

  // Specific dates — ISO 8601 (2024-03-15) and US (3/15/2024 or 03/15/2024).
  // Combined with a diagnosis these are a reidentification vector.
  {
    name: 'iso-date',
    re: /\b\d{4}-\d{2}-\d{2}\b/g,
    replacement: '[REDACTED-DATE]',
  },
  {
    name: 'us-date',
    re: /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/\d{2,4}\b/g,
    replacement: '[REDACTED-DATE]',
  },

  // Street addresses — number + name + suffix from the list above.
  {
    name: 'street-address',
    re: new RegExp(
      String.raw`\b\d+\s+[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)?\s+(?:${STREET_SUFFIXES.join('|')})\b\.?`,
      'gi',
    ),
    replacement: '[REDACTED-ADDRESS]',
  },

  // Address fragments — "(living|residing|stays|located) at <number> <word>"
  {
    name: 'address-fragment',
    re: /\b(?:living|residing|stays|stayed|stay|resides|located|residence)\s+at\s+\d+[A-Za-z\s]*?(?=[.,;]|$)/gi,
    replacement: '[REDACTED-ADDRESS]',
  },

  // Honorific + name (Dr. Smith, Mrs. Jones-Patel, Dr Smith without dot).
  {
    name: 'honorific-name',
    re: /\b(?:Mr|Mrs|Ms|Mx|Dr|Prof|Rev)\.?\s+[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?/g,
    replacement: '[REDACTED-NAME]',
  },

  // Family-relationship + name ("daughter Mary", "son Jonathan Doe-Smith").
  {
    name: 'family-name',
    re: new RegExp(
      String.raw`\b(?:${FAMILY_RELATIONSHIPS.join('|')})\s+(?:[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?)`,
      'gi',
    ),
    replacement: '[REDACTED-FAMILY-NAME]',
  },

  // Honorific-less provider name with context verb
  // ("signed off by Smith", "attending Patel-Williams").
  {
    name: 'provider-name',
    re: new RegExp(
      String.raw`\b(?:${PROVIDER_CONTEXT_VERBS.join('|')})\s+(?:[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?)`,
      'gi',
    ),
    replacement: '[REDACTED-PROVIDER]',
  },
];

/**
 * Scrub a clinical note in-place. Returns null for null input (preserves
 * the column's nullability). Order is significant — more-specific patterns
 * run first so a SSN doesn't get fragmented by a generic digit-run match.
 *
 * Idempotent: scrubbing already-scrubbed text is a no-op (the [REDACTED-*]
 * tokens don't match any of the patterns).
 */
export function scrubClinicalNote(s: string | null): string | null {
  if (s == null) return s;
  let out = s;
  for (const { re, replacement } of RULES) {
    out = out.replace(re, replacement);
  }
  return out;
}

/**
 * Test/debug helper: returns the first rule that matches `s`, or null.
 * Used by tests to assert *which* pattern caught a leak vector, not just
 * "something redacted it."
 */
export function firstMatchingRule(s: string): string | null {
  for (const r of RULES) {
    r.re.lastIndex = 0;
    if (r.re.test(s)) return r.name;
  }
  return null;
}
