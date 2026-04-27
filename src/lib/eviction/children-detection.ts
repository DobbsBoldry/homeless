/**
 * EVDT-011: detect a children-in-household signal in an eviction
 * filing's free-text notes. Pure function; no DB / no AI.
 *
 * Court records don't have a structured "kids in unit" field, but the
 * notes occasionally include language like "Defendant resides with
 * minor children" or "household includes two children". When that
 * language appears, a household-with-kids has measurably more at
 * stake (school enrollment, McKinney-Vento status, family-shelter
 * routing) and the risk score should reflect that.
 *
 * Conservative by design — false positives push the risk score in a
 * direction that affects how KLA prioritizes the case, so we'd rather
 * say "no signal" than flag wrongly. Confidence levels:
 *
 *  - 'high'   — explicit minor-child language ("minor children",
 *               "minor child", "with her two daughters")
 *  - 'medium' — child noun co-occurs with defendant/occupancy context
 *               ("Defendant lives with three kids", "household has
 *               children")
 *  - 'low'    — child word appears but context is ambiguous
 *  - 'none'   — no signal, OR an explicit negation ("no minor children")
 */

export type ChildrenSignal = {
  detected: boolean;
  confidence: 'none' | 'low' | 'medium' | 'high';
  /** Short snippet of the matched evidence so the UI can show it. */
  evidence: string | null;
};

const NEGATION_PATTERNS: RegExp[] = [
  /\bno\s+(?:minor\s+)?children\b/i,
  /\bno\s+children\s+in\s+the\s+household\b/i,
  /\bdefendant\s+(?:has|reports)\s+no\s+children\b/i,
  /\bzero\s+children\b/i,
  /\bnone\s+of\s+the\s+(?:occupants|residents)\s+are\s+minors\b/i,
];

const HIGH_PATTERNS: RegExp[] = [
  // Explicit minor-child language
  /\bminor\s+child(?:ren)?\b/i,
  /\b(?:Defendant|tenant|occupant)[^.\n]*\bwith\s+(?:her|his|their)\s+(?:\w+\s+){0,2}(?:son|daughter|sons|daughters|children|kids)\b/i,
  // Occupancy phrasing
  /\bhousehold\s+(?:includes?|contains?)\s+(?:minor|young)?\s*(?:children|child|kids)\b/i,
  /\b(?:two|three|four|five|six)\s+minor\s+children\b/i,
  /\b(?:school|grade)[ -](?:age|aged)\s+children\b/i,
  /\bunder\s+(?:the\s+)?age\s+of\s+18\b/i,
];

const MEDIUM_PATTERNS: RegExp[] = [
  // Child noun + defendant/occupancy context
  /\b(?:Defendant|tenant|occupant)[^.\n]*\b(?:lives|resides|stays|with)\b[^.\n]*\b(?:children|child|kids)\b/i,
  /\b(?:children|kids)[^.\n]*\b(?:reside|live|stay|are\s+at|in\s+the\s+(?:home|unit|premises))\b/i,
  /\bfamily\s+with\s+(?:children|kids)\b/i,
  /\b\d+\s+(?:children|kids)\s+(?:in\s+the\s+(?:home|unit|household))\b/i,
];

const LOW_PATTERNS: RegExp[] = [/\b(?:children|child|kids|son|daughter)\b/i];

const FALSE_POSITIVE_PATTERNS: RegExp[] = [
  // Legal/financial phrases that mention "child" but aren't about
  // occupancy. "Child support" is a court-context noun phrase that
  // commonly appears in eviction notes without implying kids in the
  // unit (it's about the defendant's existing obligations).
  /\bchild\s+support\b/i,
  /\bchildcare\s+(?:payment|cost|expense)\b/i,
];

function trimEvidence(text: string, match: RegExpMatchArray): string {
  const idx = match.index ?? 0;
  const start = Math.max(0, idx - 24);
  const end = Math.min(text.length, idx + match[0].length + 24);
  const ellipsisL = start > 0 ? '…' : '';
  const ellipsisR = end < text.length ? '…' : '';
  return `${ellipsisL}${text.slice(start, end).trim()}${ellipsisR}`;
}

export function detectChildrenSignal(text: string | null | undefined): ChildrenSignal {
  if (!text || text.trim().length === 0) {
    return { detected: false, confidence: 'none', evidence: null };
  }

  // Negation wins — explicit "no children" language overrides everything.
  for (const re of NEGATION_PATTERNS) {
    if (re.test(text)) {
      return { detected: false, confidence: 'none', evidence: null };
    }
  }

  // Knock out false-positive contexts before counting low-confidence
  // hits. We don't strip the matches; we just remove them from a
  // stripped copy used for the LOW pass so "child support" alone
  // doesn't lift to "low".
  let stripped = text;
  for (const re of FALSE_POSITIVE_PATTERNS) {
    stripped = stripped.replace(re, '');
  }

  for (const re of HIGH_PATTERNS) {
    const m = text.match(re);
    if (m) return { detected: true, confidence: 'high', evidence: trimEvidence(text, m) };
  }
  for (const re of MEDIUM_PATTERNS) {
    const m = text.match(re);
    if (m) return { detected: true, confidence: 'medium', evidence: trimEvidence(text, m) };
  }
  for (const re of LOW_PATTERNS) {
    const m = stripped.match(re);
    if (m) {
      // Map the match back to the original text for evidence display.
      const origMatch = text.match(re);
      const evidence = origMatch ? trimEvidence(text, origMatch) : null;
      return { detected: true, confidence: 'low', evidence };
    }
  }

  return { detected: false, confidence: 'none', evidence: null };
}
