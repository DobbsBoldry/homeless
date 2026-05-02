// Public API barrel for the subp domain (subpopulation pathways).
// Cross-domain consumers MUST import from '@/lib/subp' (this file),
// not from '@/lib/subp/<internal>'. Enforced by
// scripts/check-domain-boundaries.mts (FND-040b, ADR 0001).

export * from './abuser-blind';
export * from './aging-out-engine';
export * from './dcbs-gate';
export * from './dv-survivors';
export * from './family-stability';
export * from './kydoc-gate';
export * from './medicaid-extension';
export * from './oasis-gate';
export * from './pre-release-engine';
export * from './pre-release-supports';
export * from './supports-in-place';
