// Public API barrel for the subp domain (subpopulation pathways).
// Cross-domain consumers MUST import from '@/lib/subp' (this file),
// not from '@/lib/subp/<internal>'. Enforced by
// scripts/check-domain-boundaries.mts (FND-040b, ADR 0001).

export * from './aging-out-engine';
export * from './dcbs-gate';
export * from './supports-in-place';
