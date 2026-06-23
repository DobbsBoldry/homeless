'use server';

import { getActiveFagMemberForUser, insertFagFeedback } from '@/db/queries/fag';
import { logAuditEvent } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { parseFeedbackSubmission } from '@/lib/cwt';

export type SubmitFeedbackResult = { ok: true } | { ok: false; error: string };

/**
 * CWT-023a — an advisory member submits in-app feedback. Gated on an active
 * `fag_members` row linked to the signed-in user; anyone else is denied even
 * if they reach the action directly.
 */
export async function submitFagFeedbackAction(fd: FormData): Promise<SubmitFeedbackResult> {
  const user = await requireUser();

  const member = await getActiveFagMemberForUser(user.id);
  if (!member) {
    return {
      ok: false,
      error: 'Feedback is open to active Frontline Advisory Group members only.',
    };
  }

  const parsed = parseFeedbackSubmission({
    route: fd.get('route'),
    rating: fd.get('rating'),
    category: fd.get('category'),
    comment: fd.get('comment'),
  });
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const row = await insertFagFeedback({
    fagMemberId: member.id,
    userId: user.id,
    route: parsed.value.route,
    rating: parsed.value.rating,
    comment: parsed.value.comment,
    category: parsed.value.category,
  });

  await logAuditEvent({
    actorUserId: user.id,
    action: 'fag.feedback.submitted',
    targetTable: 'fag_feedback',
    targetId: row.id,
    metadata: {
      route: parsed.value.route,
      rating: parsed.value.rating,
      category: parsed.value.category,
    },
  });

  return { ok: true };
}
