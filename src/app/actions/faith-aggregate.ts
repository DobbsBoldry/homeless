'use server';

import { revalidatePath } from 'next/cache';
import { createFaithAggregateSubmission, getFaithMinistry } from '@/db/queries/faith-aggregate';
import { requireRole } from '@/lib/auth';
import { processBreakouts, processMetrics } from '@/lib/dtrs';
import { parseIntakeFormData } from './faith-aggregate-parse';

export type { ParsedIntakeInput } from './faith-aggregate-parse';

export type SubmitFaithAggregateResult =
  | { ok: true; submissionId: string; suppressedCount: number }
  | { ok: false; error: string };

/**
 * Admin-only server action: parse the DTRS-008 intake FormData and persist
 * via `createFaithAggregateSubmission` (cell-size suppression + audit log
 * happen inside that query — see ADR 0003).
 *
 * Parsing is delegated to `parseIntakeFormData` (faith-aggregate-parse.ts)
 * so the input validation logic can be unit-tested without Next.js
 * server-action wrapping.
 */
export async function submitFaithAggregateAction(
  formData: FormData,
): Promise<SubmitFaithAggregateResult> {
  const user = await requireRole(['admin']);

  const parsed = parseIntakeFormData(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    const ministry = await getFaithMinistry(parsed.input.ministryId);
    if (!ministry) return { ok: false, error: 'Ministry not found.' };

    const minCellSize = ministry.minCellSize;
    const suppressedCount =
      processMetrics(parsed.input.metrics, minCellSize).filter((m) => m.suppressed).length +
      processBreakouts(parsed.input.breakouts, minCellSize).filter((b) => b.suppressed).length;

    const submission = await createFaithAggregateSubmission({
      ...parsed.input,
      submittedByUserId: user.id,
    });

    revalidatePath('/app/admin/faith-aggregate');
    return { ok: true, submissionId: submission.id, suppressedCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Submission failed.';
    return { ok: false, error: msg };
  }
}
