import { logAuditEvent } from '@/lib/audit';

/**
 * Record-access audit (DTRS-003). Writes a row to audit_log every
 * time a user views or computes against a piece of identifiable data,
 * so the DTRS-015 annual independent audit can answer "who saw what,
 * when?" The append-only trigger on audit_log is the durability
 * guarantee.
 *
 * Conventions:
 *   - `purpose` is a free-form short string the calling page chose.
 *     Example: 'attorney_case_detail', 'caseworker_intake_view',
 *     'ed_coordinator_queue'. Not enforced — meaningful copy beats
 *     locked-down enums when investigating an incident.
 *   - This is intentionally a fire-and-forget thunk style: errors
 *     log to the server console but never throw, so a transient DB
 *     hiccup doesn't 500 a read view.
 */
export async function recordDataAccess(input: {
  actorUserId: string | null;
  /** Logical table or domain ('eviction_filings', 'ed_encounters'). */
  resourceType: string;
  /** Primary key OR opaque subject identifier; whichever the page reads. */
  resourceId: string;
  /** Free-form short string describing why the read happened. */
  purpose: string;
  /** Optional structured context (filter, page, etc). */
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await logAuditEvent({
      actorUserId: input.actorUserId,
      action: 'data.accessed',
      targetTable: input.resourceType,
      targetId: input.resourceId,
      metadata: { purpose: input.purpose, ...input.metadata },
    });
  } catch (err) {
    console.error('[recordDataAccess] failed', err);
  }
}

/**
 * Record an AI-generation event (DTRS-003 explicitly calls this out).
 * Goes through the same audit_log table so a single query gives you
 * "every read + every AI write touching subject X".
 *
 * The `model` and `prompt_version` fields are how the DTRS-015 audit
 * answers "did the AI see PHI it shouldn't have?" — the prompt
 * version pins the system-prompt text used at generation time.
 */
export async function recordAiGeneration(input: {
  actorUserId: string | null;
  resourceType: string;
  resourceId: string;
  model: string;
  promptVersion: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await logAuditEvent({
      actorUserId: input.actorUserId,
      action: 'ai.generated',
      targetTable: input.resourceType,
      targetId: input.resourceId,
      metadata: {
        model: input.model,
        promptVersion: input.promptVersion,
        ...input.metadata,
      },
    });
  } catch (err) {
    console.error('[recordAiGeneration] failed', err);
  }
}
