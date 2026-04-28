// Public API barrel for the indc domain.
// Cross-domain consumers MUST import from '@/lib/indc' (this file),
// not from '@/lib/indc/<internal>'. Enforced by
// scripts/check-domain-boundaries.mts (FND-040b, ADR 0001).

export * from './bed-finder';
export * from './bed-summary';
export * from './sms-bed-holds';
export * from './sms-conversation';
export * from './sms-formatter';
export * from './sms-parser';
export * from './sms-pipeline';
export * from './twilio-signature';
