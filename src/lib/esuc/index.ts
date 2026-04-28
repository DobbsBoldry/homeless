// Public API barrel for the esuc domain.
// Cross-domain consumers MUST import from '@/lib/esuc' (this file),
// not from '@/lib/esuc/<internal>'. Enforced by
// scripts/check-domain-boundaries.mts (FND-040b, ADR 0001).

export * from './care-plan';
export * from './ed-triage';
export * from './first-time-homeless';
export * from './patient-qa';
export * from './scrub';
export * from './super-utilizer-ranking';
