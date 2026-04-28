// Public API barrel for the oprt domain.
// Cross-domain consumers MUST import from '@/lib/oprt' (this file),
// not from '@/lib/oprt/<internal>'. Enforced by
// scripts/check-domain-boundaries.mts (FND-040b, ADR 0001).

export * from './outreach-priorities';
export * from './quarterly-narrative';
