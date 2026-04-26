import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { db } from '@/db/client';
import { users } from '@/db/schema/users';
import { inngest } from '@/inngest/client';

export const dynamic = 'force-dynamic';

type ClerkEmailAddress = { id: string; email_address: string };
type ClerkUserPayload = {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ClerkEvent =
  | { type: 'user.created' | 'user.updated'; data: ClerkUserPayload }
  | { type: 'user.deleted'; data: { id: string } };

/**
 * Clerk webhook for production user sync (mirrors lazy upsert in src/lib/auth.ts).
 * Configure in Clerk Dashboard once a public URL exists (FND-005).
 * Until CLERK_WEBHOOK_SECRET is set, this returns 503 — the lazy upsert handles dev.
 */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
  }

  const hdrs = await headers();
  const svixId = hdrs.get('svix-id');
  const svixTs = hdrs.get('svix-timestamp');
  const svixSig = hdrs.get('svix-signature');
  if (!svixId || !svixTs || !svixSig) {
    return NextResponse.json({ error: 'missing svix headers' }, { status: 400 });
  }

  const body = await req.text();
  let event: ClerkEvent;
  try {
    event = new Webhook(secret).verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTs,
      'svix-signature': svixSig,
    }) as ClerkEvent;
  } catch (err) {
    console.error('[clerk webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  try {
    if (event.type === 'user.created' || event.type === 'user.updated') {
      const u = event.data;
      const email =
        u.email_addresses.find((e) => e.id === u.primary_email_address_id)?.email_address ??
        u.email_addresses[0]?.email_address ??
        '';
      await db
        .insert(users)
        .values({
          clerkUserId: u.id,
          email,
          firstName: u.first_name,
          lastName: u.last_name,
        })
        .onConflictDoUpdate({
          target: users.clerkUserId,
          set: { email, firstName: u.first_name, lastName: u.last_name, updatedAt: new Date() },
        });

      if (event.type === 'user.created') {
        await inngest.send({
          name: 'user.signed_up',
          data: { clerkUserId: u.id, email, firstName: u.first_name, lastName: u.last_name },
        });
      }
    } else if (event.type === 'user.deleted') {
      await db.delete(users).where(eq(users.clerkUserId, event.data.id));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[clerk webhook] handler error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
