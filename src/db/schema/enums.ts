import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'attorney',
  'caseworker',
  'ed_coordinator',
  'shelter_staff',
  'admin',
]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
