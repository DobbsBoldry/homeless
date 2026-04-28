import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  type NewSmsConversation,
  type SmsConversation,
  smsConversations,
} from '@/db/schema/sms-conversations';
import type { BedFilter } from '@/lib/coordination';

/** Conversation TTL: 10 minutes of silence rolls the user back to idle. */
export const CONVERSATION_TTL_MS = 10 * 60 * 1000;

const isExpired = (row: SmsConversation): boolean =>
  new Date(row.expiresAt).getTime() <= Date.now();

export async function getConversation(fromNumber: string): Promise<SmsConversation | null> {
  const [row] = await db
    .select()
    .from(smsConversations)
    .where(eq(smsConversations.fromNumber, fromNumber))
    .limit(1);
  if (!row) return null;
  if (isExpired(row)) {
    // Lazy-expire on read so a caller after the TTL gets a clean slate
    // even if the cron hasn't fired yet.
    await db
      .update(smsConversations)
      .set({
        state: 'idle',
        pendingFilter: null,
        updatedAt: new Date(),
      })
      .where(eq(smsConversations.id, row.id));
    return { ...row, state: 'idle', pendingFilter: null };
  }
  return row;
}

export async function setAwaitingLocation(
  fromNumber: string,
  filter: BedFilter,
): Promise<SmsConversation> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONVERSATION_TTL_MS);
  const values: NewSmsConversation = {
    fromNumber,
    state: 'awaiting_location',
    pendingFilter: filter,
    lastMessageAt: now,
    expiresAt,
  };
  const [row] = await db
    .insert(smsConversations)
    .values(values)
    .onConflictDoUpdate({
      target: smsConversations.fromNumber,
      set: {
        state: 'awaiting_location',
        pendingFilter: filter,
        lastMessageAt: now,
        expiresAt,
        updatedAt: now,
      },
    })
    .returning();
  return row;
}

export async function markIdle(
  fromNumber: string,
  opts: {
    capturedLocation?: string | null;
    lastResults?: Array<{ shelterId: string; name: string }> | null;
  } = {},
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONVERSATION_TTL_MS);
  const lastLocation = opts.capturedLocation ?? null;
  const lastResults = opts.lastResults ?? null;
  const values: NewSmsConversation = {
    fromNumber,
    state: 'idle',
    pendingFilter: null,
    lastLocation,
    lastResults,
    lastMessageAt: now,
    expiresAt,
  };
  await db
    .insert(smsConversations)
    .values(values)
    .onConflictDoUpdate({
      target: smsConversations.fromNumber,
      set: {
        state: 'idle',
        pendingFilter: null,
        lastLocation,
        lastResults,
        lastMessageAt: now,
        expiresAt,
        updatedAt: now,
      },
    });
}

export async function setLastHoldId(fromNumber: string, holdId: string | null): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONVERSATION_TTL_MS);
  await db
    .update(smsConversations)
    .set({ lastHoldId: holdId, lastMessageAt: now, expiresAt, updatedAt: now })
    .where(eq(smsConversations.fromNumber, fromNumber));
}

export async function clearConversation(fromNumber: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONVERSATION_TTL_MS);
  const values: NewSmsConversation = {
    fromNumber,
    state: 'idle',
    pendingFilter: null,
    lastMessageAt: now,
    expiresAt,
  };
  await db
    .insert(smsConversations)
    .values(values)
    .onConflictDoUpdate({
      target: smsConversations.fromNumber,
      set: { state: 'idle', pendingFilter: null, lastMessageAt: now, expiresAt, updatedAt: now },
    });
}

const SKIP_TOKENS = new Set(['ANYWHERE', 'ANY', 'SKIP', 'WHATEVER', 'NEAR']);

/**
 * Returns true if the location body is a "doesn't matter" answer. The
 * pipeline treats this as: keep the original filter, drop location.
 */
export function isLocationSkip(body: string): boolean {
  const head = body.trim().toUpperCase().split(/\s+/)[0];
  return SKIP_TOKENS.has(head);
}

const LOCATION_MAX_LEN = 80;

/** Tidy a location string for storage / inclusion in replies. */
export function normalizeLocation(body: string): string {
  return body.trim().replace(/\s+/g, ' ').slice(0, LOCATION_MAX_LEN);
}
