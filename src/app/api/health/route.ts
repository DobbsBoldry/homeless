import { NextResponse } from 'next/server';
import { db, schema } from '@/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [row] = await db.insert(schema.healthCheck).values({}).returning();
    const count = await db.$count(schema.healthCheck);
    return NextResponse.json({
      ok: true,
      latestPingId: row.id,
      latestPingAt: row.createdAt,
      totalPings: count,
    });
  } catch (err) {
    // Log server-side; never leak DB error details (may include connection
    // string fragments or schema info) to clients.
    console.error('[/api/health] db error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
