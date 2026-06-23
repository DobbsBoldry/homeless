/**
 * CWT-023a — Frontline Advisory Group (FAG) feedback capture.
 *
 * Pure parse/validate helpers for the in-app feedback modal. No DB or React
 * here so they're unit-testable and safe to deep-import from a client
 * component (`@/lib/cwt/fag-feedback`).
 */

/** Feedback categories — mirrors the `fag_feedback_category` pgEnum. */
export const FAG_FEEDBACK_CATEGORIES = [
  'service_gap',
  'tool_issue',
  'process_suggestion',
  'other',
] as const;

export type FagFeedbackCategory = (typeof FAG_FEEDBACK_CATEGORIES)[number];

export const FAG_FEEDBACK_CATEGORY_LABELS: Record<FagFeedbackCategory, string> = {
  service_gap: 'Service gap',
  tool_issue: 'Tool issue',
  process_suggestion: 'Process suggestion',
  other: 'Other',
};

export const COMMENT_MAX = 2000;
export const MIN_RATING = 1;
export const MAX_RATING = 5;

export function isFagFeedbackCategory(v: unknown): v is FagFeedbackCategory {
  return typeof v === 'string' && (FAG_FEEDBACK_CATEGORIES as readonly string[]).includes(v);
}

/**
 * Coerce a form value into an integer star rating in [1, 5], or null if it
 * isn't a clean whole number in range. Accepts number or numeric string.
 */
export function parseRating(v: unknown): number | null {
  if (typeof v === 'number') {
    return Number.isInteger(v) && v >= MIN_RATING && v <= MAX_RATING ? v : null;
  }
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (trimmed === '' || !/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= MIN_RATING && n <= MAX_RATING ? n : null;
}

export interface FeedbackSubmission {
  route: string;
  rating: number;
  category: FagFeedbackCategory;
  comment: string | null;
}

export type ParseResult = { ok: true; value: FeedbackSubmission } | { ok: false; error: string };

/** Shape accepted from a FormData-like object or plain record. */
export interface RawFeedbackInput {
  route?: unknown;
  rating?: unknown;
  category?: unknown;
  comment?: unknown;
}

export function parseFeedbackSubmission(input: RawFeedbackInput): ParseResult {
  const route = typeof input.route === 'string' ? input.route.trim() : '';
  if (route === '') return { ok: false, error: 'Could not detect the current page.' };

  const rating = parseRating(input.rating);
  if (rating === null) return { ok: false, error: 'Choose a star rating from 1 to 5.' };

  if (!isFagFeedbackCategory(input.category)) {
    return { ok: false, error: 'Choose a feedback category.' };
  }

  const rawComment = typeof input.comment === 'string' ? input.comment.trim() : '';
  if (rawComment.length > COMMENT_MAX) {
    return { ok: false, error: `Comment must be ${COMMENT_MAX} characters or fewer.` };
  }
  const comment = rawComment === '' ? null : rawComment;

  return { ok: true, value: { route, rating, category: input.category, comment } };
}
