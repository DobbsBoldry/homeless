import type { BedFilter } from '@/lib/coordination';

/**
 * Inbound SMS commands the bed-finder understands. Every command maps
 * to a single intent; modifiers stack inside `BED ...`. Examples:
 *   BED                → find any open bed (multi-turn, asks location)
 *   BED FAMILY         → family-accepting + open
 *   BED PET            → pet-friendly + open
 *   BED MEN PET        → men + pet-friendly + open
 *   BED WOMEN SUD      → women + SUD-friendly + open
 *   STATUS / BOARD     → coalition-wide bed dashboard (one-shot, for
 *                        211 dispatchers and caseworkers; COOR-006).
 *                        No location prompt, no hold flow.
 *   HELP               → help text
 *   STOP / END / QUIT  → opt-out (Twilio handles delivery; we still log it)
 */
export type ParsedSmsCommand =
  | { kind: 'bed'; filter: BedFilter }
  | { kind: 'status' }
  | { kind: 'food' }
  | { kind: 'story' }
  | { kind: 'hold'; resultIndex: number }
  | { kind: 'release' }
  | { kind: 'help' }
  | { kind: 'stop' }
  | { kind: 'unknown'; raw: string };

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'END', 'QUIT']);
const HELP_WORDS = new Set(['HELP', 'INFO', '?']);
const FOOD_WORDS = new Set(['FOOD', 'EAT', 'PANTRY', 'MEAL', 'MEALS', 'HUNGRY']);
const STORY_WORDS = new Set(['STORY', 'ABOUT', 'WHO', 'WHAT']);
const HOLD_WORDS = new Set(['HOLD', 'RESERVE', 'CONFIRM']);
const RELEASE_WORDS = new Set(['RELEASE', 'CANCEL', 'NEVERMIND']);
const STATUS_WORDS = new Set(['STATUS', 'BOARD', 'SUMMARY', 'DASH', 'DASHBOARD']);

const POPULATION_TOKENS: Record<string, NonNullable<BedFilter['population']>> = {
  MEN: 'men',
  MAN: 'men',
  MALE: 'men',
  WOMEN: 'women',
  WOMAN: 'women',
  FEMALE: 'women',
  FAMILY: 'families',
  FAMILIES: 'families',
  KIDS: 'families',
  CHILDREN: 'families',
};

const PET_TOKENS = new Set(['PET', 'PETS', 'DOG', 'CAT', 'PETFRIENDLY']);
const SUD_TOKENS = new Set(['SUD', 'SOBER', 'RECOVERY', 'DRUGS', 'CLEAN']);

export function parseSmsCommand(raw: string): ParsedSmsCommand {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'unknown', raw };

  const tokens = trimmed.toUpperCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { kind: 'unknown', raw };

  const head = tokens[0];

  if (STOP_WORDS.has(head)) return { kind: 'stop' };
  if (HELP_WORDS.has(head)) return { kind: 'help' };
  if (STATUS_WORDS.has(head)) return { kind: 'status' };
  if (FOOD_WORDS.has(head)) return { kind: 'food' };
  if (STORY_WORDS.has(head)) return { kind: 'story' };

  if (HOLD_WORDS.has(head)) {
    // Accept `HOLD 1`, `HOLD #2`, `RESERVE 3`. Default to slot 1 when
    // unspecified — the most-recent top result.
    const arg = tokens[1];
    let n = 1;
    if (arg) {
      const cleaned = arg.replace(/[^0-9]/g, '');
      const parsed = Number.parseInt(cleaned, 10);
      if (Number.isInteger(parsed) && parsed >= 1) n = parsed;
    }
    return { kind: 'hold', resultIndex: n - 1 };
  }
  if (RELEASE_WORDS.has(head)) return { kind: 'release' };

  if (head === 'BED' || head === 'BEDS' || head === 'SHELTER') {
    const filter: BedFilter = { minFreeBeds: 1 };
    for (const t of tokens.slice(1)) {
      const pop = POPULATION_TOKENS[t];
      if (pop && !filter.population) {
        filter.population = pop;
        continue;
      }
      if (PET_TOKENS.has(t)) {
        filter.petFriendly = true;
        continue;
      }
      if (SUD_TOKENS.has(t)) {
        filter.sudFriendly = true;
      }
      // Unknown modifiers are ignored — we still treat the message as
      // a BED request rather than rejecting on a typo.
    }
    return { kind: 'bed', filter };
  }

  return { kind: 'unknown', raw };
}
