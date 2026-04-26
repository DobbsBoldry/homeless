import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkUserId: text('clerk_user_id').notNull(),
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
