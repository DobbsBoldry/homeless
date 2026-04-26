import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import type { EvictionFiling } from '@/db/schema/eviction-filings';
import {
  type RentalAssistanceProgram,
  rentalAssistancePrograms,
} from '@/db/schema/rental-assistance-programs';

/**
 * Phase-1 implementation: returns ALL active programs. Eligibility text
 * is shown alongside each so the attorney can decide which apply — we
 * don't have the structured household data needed for real matching.
 *
 * `_filing` is unused today but is part of the signature so the EVDT-014
 * follow-up can narrow without changing every caller.
 */
export async function matchAssistancePrograms(
  _filing: EvictionFiling,
): Promise<RentalAssistanceProgram[]> {
  return await db
    .select()
    .from(rentalAssistancePrograms)
    .where(eq(rentalAssistancePrograms.active, true))
    .orderBy(asc(rentalAssistancePrograms.agency));
}
