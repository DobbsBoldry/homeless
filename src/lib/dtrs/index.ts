// Public API barrel for the dtrs domain.
// Cross-domain consumers MUST import from '@/lib/dtrs' (this file),
// not from '@/lib/dtrs/<internal>'. Enforced by
// scripts/check-domain-boundaries.mts (FND-040b, ADR 0001).

export * from './consent';
export * from './consent-events';
export * from './consent-text';
export * from './consent-token';
export * from './data-access';
export * from './dv-blind';
export * from './faith-aggregate';
export * from './ferpa-consent-text';
export * from './fiscal-court-brief';
export * from './partner-agreements';
export * from './rate-limit';
export * from './school-referral-insights';
export * from './school-referral-policy';
export * from './transparency-report';
