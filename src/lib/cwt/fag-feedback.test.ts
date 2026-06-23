import { describe, expect, it } from 'vitest';
import {
  FAG_FEEDBACK_CATEGORIES,
  isFagFeedbackCategory,
  parseFeedbackSubmission,
  parseRating,
} from './fag-feedback';

describe('parseRating', () => {
  it('accepts integer strings 1–5', () => {
    expect(parseRating('1')).toBe(1);
    expect(parseRating('5')).toBe(5);
    expect(parseRating(3)).toBe(3);
  });

  it('rejects out-of-range, non-integer, and junk', () => {
    expect(parseRating('0')).toBeNull();
    expect(parseRating('6')).toBeNull();
    expect(parseRating('3.5')).toBeNull();
    expect(parseRating('')).toBeNull();
    expect(parseRating('abc')).toBeNull();
    expect(parseRating(null)).toBeNull();
    expect(parseRating(undefined)).toBeNull();
  });
});

describe('isFagFeedbackCategory', () => {
  it('recognizes the four valid categories', () => {
    for (const c of FAG_FEEDBACK_CATEGORIES) {
      expect(isFagFeedbackCategory(c)).toBe(true);
    }
  });
  it('rejects anything else', () => {
    expect(isFagFeedbackCategory('bogus')).toBe(false);
    expect(isFagFeedbackCategory('')).toBe(false);
    expect(isFagFeedbackCategory(null)).toBe(false);
  });
});

describe('parseFeedbackSubmission', () => {
  const good = {
    route: '/app/clients/123',
    rating: '4',
    category: 'tool_issue',
    comment: '  the screener timed out  ',
  };

  it('parses a valid submission and trims the comment', () => {
    const r = parseFeedbackSubmission(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({
        route: '/app/clients/123',
        rating: 4,
        category: 'tool_issue',
        comment: 'the screener timed out',
      });
    }
  });

  it('treats an empty/whitespace comment as null (optional)', () => {
    const r = parseFeedbackSubmission({ ...good, comment: '   ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.comment).toBeNull();
    const r2 = parseFeedbackSubmission({ route: good.route, rating: '2', category: 'other' });
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.value.comment).toBeNull();
  });

  it('requires a non-empty route', () => {
    const r = parseFeedbackSubmission({ ...good, route: '   ' });
    expect(r.ok).toBe(false);
  });

  it('requires a rating in 1–5', () => {
    expect(parseFeedbackSubmission({ ...good, rating: '0' }).ok).toBe(false);
    expect(parseFeedbackSubmission({ ...good, rating: '9' }).ok).toBe(false);
    expect(parseFeedbackSubmission({ ...good, rating: '' }).ok).toBe(false);
  });

  it('requires a valid category', () => {
    expect(parseFeedbackSubmission({ ...good, category: 'nonsense' }).ok).toBe(false);
    expect(parseFeedbackSubmission({ ...good, category: '' }).ok).toBe(false);
  });

  it('rejects an over-long comment', () => {
    const r = parseFeedbackSubmission({ ...good, comment: 'x'.repeat(2001) });
    expect(r.ok).toBe(false);
  });
});
