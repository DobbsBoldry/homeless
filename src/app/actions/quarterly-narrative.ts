'use server';

import * as Sentry from '@sentry/nextjs';
import {
  getCoalitionAggregate,
  getGovernanceCountsForQuarter,
  listQuarterlyEvictionAggregates,
  type Quarter,
} from '@/db/queries/public-outcomes';
import { logAuditEvent } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { recordAiGeneration } from '@/lib/dtrs/data-access';
import { generateQuarterlyNarrative } from '@/lib/oprt/quarterly-narrative';

export type GenerateQuarterlyNarrativeResult =
  | { ok: true; text: string; modelId: string; promptVersion: string }
  | { ok: false; error: string };

export async function generateQuarterlyNarrativeAction(
  year: number,
  quarter: 1 | 2 | 3 | 4,
): Promise<GenerateQuarterlyNarrativeResult> {
  const actor = await requireUser();

  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    return { ok: false, error: 'Invalid year.' };
  }
  if (![1, 2, 3, 4].includes(quarter)) {
    return { ok: false, error: 'Invalid quarter.' };
  }

  const q: Quarter = { year, quarter, label: `${year} Q${quarter}` };

  try {
    const [eviction, coalitionSnapshot, governanceForQuarter] = await Promise.all([
      listQuarterlyEvictionAggregates([q]),
      getCoalitionAggregate(90),
      getGovernanceCountsForQuarter(q),
    ]);
    const evictionForQuarter = eviction[0];
    if (!evictionForQuarter) {
      return { ok: false, error: 'No eviction aggregate available for this quarter.' };
    }

    const result = await generateQuarterlyNarrative({
      quarter: q,
      evictionForQuarter,
      coalitionSnapshot,
      governanceForQuarter,
    });

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'quarterly_narrative.generated',
      targetTable: 'eviction_filings',
      metadata: {
        promptVersion: result.promptVersion,
        year,
        quarter,
      },
    });
    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'quarterly_narrative',
      resourceId: q.label,
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { year, quarter },
    });

    return {
      ok: true,
      text: result.text,
      modelId: result.modelId,
      promptVersion: result.promptVersion,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: 'generateQuarterlyNarrativeAction', quarter: q.label },
    });
    return { ok: false, error: 'Narrative generation failed. Please try again.' };
  }
}
