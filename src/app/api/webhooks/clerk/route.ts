import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema/users';
import { inngest } from '@/inngest/client';

export const dynamic = 'force-dynamic';

/**
 * Runtime shape guard for the Clerk webhook payload.
 * Svix's verify() proves the body came from Clerk; this guard proves the body
 * has the fields we read. Otherwise a benign-but-malformed payload would crash
 * the handler at access time and Svix would retry forever (sevt loop).
 */
const ClerkEmailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string(),
});

const ClerkUserPayloadSchema = z.object({
  id: z.string(),
  email_addresses: z.array(ClerkEmailAddressSchema),
  primary_email_address_id: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
});

const ClerkEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('user.created'), data: ClerkUserPayloadSchema }),
  z.object({ type: z.literal('user.updated'), data: ClerkUserPayloadSchema }),
  z.object({ type: z.literal('user.deleted'), data: z.object({ id: z.string() }) }),
]);

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
  let verifiedRaw: unknown;
  try {
    verifiedRaw = new Webhook(secret).verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTs,
      'svix-signature': svixSig,
    });
  } catch (err) {
    console.error('[clerk webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  // Shape-check the verified payload — Svix verifies the source, not the
  // contract. A user.created event missing email_addresses would crash on
  // access without this guard, and Svix would retry the broken payload forever.
  const parsed = ClerkEventSchema.safeParse(verifiedRaw);
  if (!parsed.success) {
    // 200 (not 400) so Svix doesn't keep retrying a structurally-broken payload.
    // We logged it; investigate via Sentry / dashboard.
    console.warn('[clerk webhook] unexpected payload shape', {
      issues: parsed.error.issues,
      raw: typeof verifiedRaw === 'object' ? Object.keys(verifiedRaw ?? {}) : typeof verifiedRaw,
    });
    return NextResponse.json({ ok: true, ignored: 'unrecognized_payload' });
  }
  const event = parsed.data;

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
