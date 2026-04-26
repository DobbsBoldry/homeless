import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { esucCarePlanStatusEnum } from './enums';
import { users } from './users';

/**
 * AI-drafted care plan for an ED super-utilizer, generated from the
 * patient's encounter history by the ESUC-011 service. One row per
 * (patient_id, prompt_version) — re-running the generator with the
 * same prompt version no-ops via the unique index. Bumping the prompt
 * version inserts a new draft alongside the old; a coordinator can
 * compare plans during prompt iteration.
 *
 * Status flow:
 *   draft (default) -> approved -> active -> archived
 *                                \-> archived
 *
 * `patient_id` is the SAME opaque identifier used in `ed_encounters`
 * (SYN-PAT-* synthetic, hashed real id post-BAA). We never store the
 * real Epic name on the plan, by design. The cross-reference happens
 * inside Epic for the care coordinator, not on this platform.
 *
 * `generated_by_user_id` is the care coordinator who triggered the
 * generation; SET NULL on user delete so the plan survives staff turnover.
 */
export const esucCarePlans = pgTable(
  'esuc_care_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Opaque — synthetic prefix today, hash post-BAA. Never a real name. */
    patientId: text('patient_id').notNull(),
    planMd: text('plan_md').notNull(),
    promptVersion: text('prompt_version').notNull(),
    generatedByUserId: uuid('generated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: esucCarePlanStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('care_plans_patient_version_idx').on(t.patientId, t.promptVersion),
    index('care_plans_patient_idx').on(t.patientId),
    index('care_plans_status_idx').on(t.status),
  ],
);

export type EsucCarePlan = typeof esucCarePlans.$inferSelect;
export type NewEsucCarePlan = typeof esucCarePlans.$inferInsert;
