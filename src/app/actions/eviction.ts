'use server';

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import { CaseFilingsRoles } from '@/components/eviction/case-filings-roles';
import { getFilingById } from '@/db/queries/eviction-filings';
import { requireRole } from '@/lib/auth';
import { scoreFiling } from '@/lib/eviction/risk-score';

export type ScoreFilingResult = { ok: true } | { ok: false; error: string };

export async function scoreFilingAction(filingId: string): Promise<ScoreFilingResult> {
  await requireRole(CaseFilingsRoles);

  const filing = await getFilingById(filingId);
  if (!filing) return { ok: false, error: 'Filing not found.' };

  try {
    await scoreFiling(filing);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'scoreFilingAction', filingId } });
    return { ok: false, error: 'Scoring failed. Please try again.' };
  }

  revalidatePath(`/app/cases/filings/${filingId}`);
  return { ok: true };
}
