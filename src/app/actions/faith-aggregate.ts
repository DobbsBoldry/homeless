'use server';

import { revalidatePath } from 'next/cache';
import { createFaithAggregateSubmission } from '@/db/queries/faith-aggregate';
import { requireRole } from '@/lib/auth';
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
    const submission = await createFaithAggregateSubmission({
      ...parsed.input,
      submittedByUserId: user.id,
    });

    revalidatePath('/app/admin/faith-aggregate');
    return { ok: true, submissionId: submission.id, suppressedCount: 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Submission failed.';
    return { ok: false, error: msg };
  }
}
