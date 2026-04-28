// Public API barrel for the eviction domain.
// Cross-domain consumers MUST import from '@/lib/eviction' (this file),
// not from '@/lib/eviction/<internal>'. Enforced by
// scripts/check-domain-boundaries.mts (FND-040b, ADR 0001).

export * from './attorney-triage';
export * from './case-qa';
export * from './children-detection';
export * from './docket-ranking';
export * from './outreach-letter-pdf';
export * from './packet-pdf';
export * from './parser';
export * from './plaintiff-patterns';
export * from './response-packet';
export * from './risk-band';
export * from './risk-score';
export * from './sources';
export * from './tenant-outreach';
export * from './upsert';
export * from './upsert-rules';
