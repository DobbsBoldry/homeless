'use server';

import * as Sentry from '@sentry/nextjs';
import {
  type CoalitionWeeklyDigest,
  getCoalitionWeeklyDigest,
} from '@/db/queries/coalition-weekly-digest';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { generateCoalitionInsights } from '@/lib/coalition';
import { recordAiGeneration } from '@/lib/dtrs';

export type CoalitionInsightsResult =
  | {
      ok: true;
      text: string;
      modelId: string;
      promptVersion: string;
      digest: CoalitionWeeklyDigest;
    }
  | { ok: false; error: string };

const ROLES = ['admin', 'attorney'] as const;

const DAYS_MIN = 1;
const DAYS_MAX = 90;

export async function generateCoalitionInsightsAction(
  windowDays = 7,
): Promise<CoalitionInsightsResult> {
  const actor = await requireRole(ROLES);

  const days = Math.max(DAYS_MIN, Math.min(DAYS_MAX, Math.round(windowDays)));

  try {
    const digest = await getCoalitionWeeklyDigest({ windowDays: days });
    const result = await generateCoalitionInsights(digest);

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'coalition_insights.generated',
      targetTable: 'partner_service_events',
      metadata: {
        promptVersion: result.promptVersion,
        windowDays: days,
        newFilings: digest.newFilings,
        newIntakes: digest.newIntakes,
        crossOrg: digest.crossOrgTouchpoints.length,
      },
    });
    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'coalition_insights',
      resourceId: 'weekly',
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { windowDays: days },
    });

    return {
      ok: true,
      text: result.text,
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      digest,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'generateCoalitionInsightsAction' } });
    return { ok: false, error: 'Insights generation failed. Please try again.' };
  }
}
