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
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 },
    );
  }
}
