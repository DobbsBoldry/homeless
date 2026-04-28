// Public API barrel for the coordination domain.
// Cross-domain consumers MUST import from '@/lib/coordination' (this file),
// not from '@/lib/coordination/<internal>'. Enforced by
// scripts/check-domain-boundaries.mts (FND-040b, ADR 0001).

export * from './bed-availability';
