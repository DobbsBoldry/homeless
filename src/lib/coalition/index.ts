// Public API barrel for the coalition domain.
// Cross-domain consumers MUST import from '@/lib/coalition' (this file),
// not from '@/lib/coalition/<internal>'. Enforced by
// scripts/check-domain-boundaries.mts (FND-040b, ADR 0001).

export * from './coordination-qa';
export * from './steering-agenda';
export * from './weekly-insights';
