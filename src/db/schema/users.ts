import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkUserId: text('clerk_user_id').notNull(),
    /**
     * Underlying column type is `citext` (case-insensitive text), enforced
     * by migration 0033. Drizzle's `text` is wire-compatible with `citext`
     * (both are strings client-side), and we keep the schema typed as
     * `text` here because Drizzle's `customType` for citext produces a
     * spurious `"undefined"."citext"` diff on every `db:generate`. The
     * citext invariant is asserted by `e2e/smoke/users-email-citext.spec.ts`
     * — if a future migration regresses the column to plain text, that
     * smoke test fails loudly.
     */
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    // Defaults to 'pending' so self-service signup never grants PHI access.
    // Admins promote to a real role via the Settings/Admin surface
    // (lands once that surface ships in Phase 1).
    role: userRoleEnum('role').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_clerk_user_id_idx').on(table.clerkUserId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
