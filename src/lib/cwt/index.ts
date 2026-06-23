// Public API barrel for the cwt domain.
// Cross-domain consumers MUST import from '@/lib/cwt' (this file),
// not from '@/lib/cwt/<internal>'. Enforced by
// scripts/check-domain-boundaries.mts (FND-040b, ADR 0001).

export * from './benefits';
export * from './case-note-generator';
export * from './cwt-triage';
export * from './document-extraction';
export * from './fag-feedback';
export * from './followup-sms';
export * from './intake-extraction';
export * from './intake-to-screener';
export * from './person-qa';
export * from './post-meeting-notes';
export * from './pre-meeting-summary';
export * from './time-saved-metric';
export * from './triage';
