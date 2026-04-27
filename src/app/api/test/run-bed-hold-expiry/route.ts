import { and, eq, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { bedHolds } from '@/db/schema/shelters';

/**
 * Test-mode trigger for the expire-bed-holds inngest cron (COOR-005).
 * Mirrors the cron's UPDATE; gated on E2E_MOCK_OUTBOUND so it can never
 * be hit in dev or prod.
 */
export async function POST() {
  if (process.env.E2E_MOCK_OUTBOUND !== '1') {
    return new NextResponse('forbidden', { status: 403 });
  }
  const now = new Date();
  const expired = await db
    .update(bedHolds)
    .set({ status: 'expired', updatedAt: now })
    .where(and(eq(bedHolds.status, 'active'), lt(bedHolds.expiresAt, now)))
    .returning({ id: bedHolds.id });
  return NextResponse.json({ ok: true, expired: expired.length });
}
