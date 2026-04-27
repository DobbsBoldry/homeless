'use server';

import * as Sentry from '@sentry/nextjs';
import { getPersonProfileDelta } from '@/db/queries/person-profile';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { generateFollowupSms } from '@/lib/cwt/followup-sms';
import { recordAiGeneration } from '@/lib/dtrs/data-access';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export type FollowupSmsResult =
  | { ok: true; text: string; promptVersion: string }
  | { ok: false; error: string };

const ROLES = ['caseworker', 'shelter_staff', 'ed_coordinator', 'admin'] as const;

const PURPOSE_MIN = 4;
const PURPOSE_MAX = 500;
const DAYS_BACK = 30;

export async function generateFollowupSmsAction(
  syntheticPersonRef: string,
  purpose: string,
): Promise<FollowupSmsResult> {
  const actor = await requireRole(ROLES);

  if (!isValidSyntheticPersonRef(syntheticPersonRef)) {
    return { ok: false, error: 'Invalid synthetic-person reference.' };
  }
  const trimmed = purpose.trim();
  if (trimmed.length < PURPOSE_MIN) {
    return {
      ok: false,
      error: `Tell Claude what the message is about (min ${PURPOSE_MIN} chars).`,
    };
  }
  if (trimmed.length > PURPOSE_MAX) {
    return { ok: false, error: `Purpose too long (max ${PURPOSE_MAX} chars).` };
  }

  const since = new Date();
  since.setDate(since.getDate() - DAYS_BACK);

  try {
    const delta = await getPersonProfileDelta(syntheticPersonRef, since);
    const result = await generateFollowupSms({
      syntheticPersonRef,
      purpose: trimmed,
      delta,
    });

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'followup_sms.drafted',
      targetTable: 'partner_service_events',
      targetId: syntheticPersonRef,
      metadata: {
        promptVersion: result.promptVersion,
        purposeChars: trimmed.length,
        outputChars: result.text.length,
        eventCount: delta.serviceEvents.length,
      },
    });
    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'followup_sms',
      resourceId: syntheticPersonRef,
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { purposeChars: trimmed.length },
    });

    return { ok: true, text: result.text, promptVersion: result.promptVersion };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: 'generateFollowupSmsAction', ref: syntheticPersonRef },
    });
    return { ok: false, error: 'SMS draft generation failed. Try again in a moment.' };
  }
}
