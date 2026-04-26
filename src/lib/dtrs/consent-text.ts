/**
 * Plain-language consent text shown to subjects. Reading-level target:
 * Flesch-Kincaid grade 6 or below. Reviewed in DTRS-005 advisor sessions
 * before any client traffic flows.
 *
 * Bump `CURRENT_CONSENT_VERSION` (in src/db/schema/consents.ts) every
 * time the wording materially changes. Old consent rows keep their
 * version stamp; the dashboard can flag them as "out of date" and the
 * subject can be re-prompted.
 */

import type { ConsentType } from '@/db/schema/enums';

export const CURRENT_CONSENT_VERSION = '2026-04-1';

/** Short data-class vocabulary the consent form lets subjects scope. */
export const DATA_CLASSES = [
  { id: 'identity', label: 'My name and contact info' },
  { id: 'health', label: 'My health visits' },
  { id: 'housing_history', label: 'Where I have stayed' },
  { id: 'service_events', label: 'Help I have received (food, utility, shelter)' },
] as const;

export type DataClassId = (typeof DATA_CLASSES)[number]['id'];

export type ConsentCopy = {
  /** One-line title shown at the top of the form. */
  title: string;
  /** 1-3 short sentences explaining what the subject is agreeing to. */
  intro: string;
  /** Bullet list of plain-language commitments / rights. */
  bullets: string[];
  /** Footer text — opt-out instructions. */
  footer: string;
};

const PHI_COPY: ConsentCopy = {
  title: 'Can we share your info with your case team?',
  intro:
    "Saying yes lets the people helping you talk to each other about your situation, so you don't have to repeat your story.",
  bullets: [
    'We will only share what you check off below.',
    'Only people on your case team will see it.',
    "We won't sell or give it to anyone else.",
    'You can change your mind any time. Reply STOP or call 270-555-COAL.',
    "If you don't say yes, you still get help. We just won't share between agencies.",
  ],
  footer:
    'Your name on the line at the bottom counts as your signature, like signing a paper form.',
};

const SMS_COPY: ConsentCopy = {
  title: 'Can we text you?',
  intro: "Saying yes lets us text you about beds, food, and your case. We won't share your number.",
  bullets: [
    'We text only about your situation.',
    "Reply STOP at any time and we won't text again.",
    'Standard text rates from your phone company may apply.',
  ],
  footer: 'Your name on the line below counts as your signature.',
};

const PROGRAM_EVAL_COPY: ConsentCopy = {
  title: 'Can we use your info to make this program better?',
  intro:
    "We learn what works by looking at the patterns in everyone's stories. Saying yes lets us count what helped without sharing your name.",
  bullets: [
    'Your name and contact info are removed before we count.',
    'We share only the patterns, not the people.',
    'You can say no and still get every service.',
  ],
  footer: 'Your name on the line below counts as your signature.',
};

export function consentTextFor(consentType: ConsentType): ConsentCopy {
  if (consentType === 'phi_share_within_coalition') return PHI_COPY;
  if (consentType === 'sms_communication') return SMS_COPY;
  return PROGRAM_EVAL_COPY;
}
