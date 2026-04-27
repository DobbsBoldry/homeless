import type { IntakeProfile } from '@/ai/prompts/intake-extraction';
import type { Household } from '@/lib/cwt/benefits';

export type ScreenerPrefill = {
  initialHousehold: Partial<Household>;
  prefillFields: Array<keyof Household>;
  contextNote: string | null;
};

/**
 * Map an extracted intake profile to a benefits-screener prefill.
 *
 * Only fields we can map cleanly get carried over. Income is left
 * as a free-text context note (income_summary) rather than guessed
 * into cents — the caseworker types the dollar amount themselves
 * after the conversation, with the AI's transcript-derived
 * summary visible for reference.
 */
export function intakeProfileToScreenerPrefill(profile: IntakeProfile): ScreenerPrefill {
  const initialHousehold: Partial<Household> = {};
  const prefillFields: Array<keyof Household> = [];

  if (typeof profile.household_size === 'number' && profile.household_size > 0) {
    initialHousehold.householdSize = profile.household_size;
    prefillFields.push('householdSize');
  }
  if (typeof profile.has_children_under_18 === 'boolean') {
    initialHousehold.hasChildrenUnder18 = profile.has_children_under_18;
    prefillFields.push('hasChildrenUnder18');
  }

  // Income is free-text in the profile; surface it as a context note
  // rather than guessing a number.
  const contextParts: string[] = [];
  if (profile.income_summary) contextParts.push(`Income: ${profile.income_summary}`);
  if (profile.presenting_issue) contextParts.push(`Presenting issue: ${profile.presenting_issue}`);
  if (profile.flags.dv_concern) {
    contextParts.push('DV concern flagged in intake — check OASIS routing.');
  }
  if (profile.flags.has_caseworker_relationship) {
    contextParts.push('Already working with another caseworker.');
  }

  return {
    initialHousehold,
    prefillFields,
    contextNote: contextParts.length > 0 ? contextParts.join(' · ') : null,
  };
}
