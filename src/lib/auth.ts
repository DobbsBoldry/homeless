import { auth, clerkClient } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { type User, users } from '@/db/schema/users';

/**
 * Server-only helper: returns the current user from our DB, lazy-creating
 * the row on first call (mirrors Clerk identity into Postgres).
 *
 * Use this from any protected server component or server action. Redirects
 * to /sign-in if no Clerk session is present (defense-in-depth — middleware
 * should have already protected the route).
 */
export async function requireUser(): Promise<User> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const existing = await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1);
  if (existing.length > 0) return existing[0];

  // First sign-in: mirror to DB. Pull canonical email + name from Clerk.
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    '';

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId: userId,
      email: primaryEmail,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
    })
    .returning();
  return created;
}
