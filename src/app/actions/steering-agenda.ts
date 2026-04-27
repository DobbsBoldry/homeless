'use server';

import * as Sentry from '@sentry/nextjs';
import { getCoalitionWeeklyDigest } from '@/db/queries/coalition-weekly-digest';
import { getMostRecentPostedMeeting, getSteeringMeetingById } from '@/db/queries/steering-meetings';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { draftSteeringAgenda } from '@/lib/coalition/steering-agenda';
import { recordAiGeneration } from '@/lib/dtrs/data-access';

export type DraftSteeringAgendaResult =
  | { ok: true; agendaMd: string; modelId: string; promptVersion: string }
  | { ok: false; error: string };

const ROLES = ['admin', 'attorney', 'caseworker', 'ed_coordinator', 'shelter_staff'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WINDOW_DAYS = 14;

export async function draftSteeringAgendaAction(
  meetingId: string,
): Promise<DraftSteeringAgendaResult> {
  const actor = await requireRole(ROLES);

  if (!UUID_RE.test(meetingId)) {
    return { ok: false, error: 'Invalid meeting id.' };
  }

  const meeting = await getSteeringMeetingById(meetingId);
  if (!meeting) return { ok: false, error: 'Meeting not found.' };

  try {
    const [priorMeeting, digest] = await Promise.all([
      getMostRecentPostedMeeting(meetingId),
      getCoalitionWeeklyDigest({ windowDays: WINDOW_DAYS }),
    ]);

    const result = await draftSteeringAgenda({
      meetingTitle: meeting.title,
      meetingHeldOn: meeting.heldOn,
      priorMeeting,
      digest,
    });

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'steering_agenda.drafted',
      targetTable: 'steering_meetings',
      targetId: meeting.id,
      metadata: {
        promptVersion: result.promptVersion,
        priorMeetingId: priorMeeting?.id ?? null,
        windowDays: WINDOW_DAYS,
        digestCrossOrgCount: digest.crossOrgTouchpoints.length,
      },
    });
    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'steering_agenda',
      resourceId: meeting.id,
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { priorMeetingId: priorMeeting?.id ?? null },
    });

    return {
      ok: true,
      agendaMd: result.agendaMd,
      modelId: result.modelId,
      promptVersion: result.promptVersion,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'draftSteeringAgendaAction', meetingId } });
    return { ok: false, error: 'Agenda draft failed. Please try again.' };
  }
}
