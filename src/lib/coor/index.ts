/**
 * COOR domain barrel — coordination workflows that route information
 * between coalition partner orgs (consent-gated handoffs, future:
 * referral routing, demand forecasting). Distinct from `coordination/`
 * which owns the bed-availability primitive.
 *
 * Per ADR 0001, server-only code only — `'use client'` files must use
 * deep imports (`@/lib/coor/handoff` etc.) to avoid pulling postgres
 * into the browser bundle.
 */
export * from './handoff';
export * from './handoff-context';
