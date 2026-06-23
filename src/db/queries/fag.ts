import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import type { FagFeedbackCategory } from '@/db/schema/enums';
import {
  type FagCompensationEntry,
  type FagFeedback,
  type FagMember,
  fagCompensationEntries,
  fagFeedback,
  fagMembers,
} from '@/db/schema/fag-members';

export async function listFagMembers(): Promise<FagMember[]> {
  return await db
    .select()
    .from(fagMembers)
    .orderBy(asc(fagMembers.status), asc(fagMembers.fullName));
}

export async function getFagMemberById(id: string): Promise<FagMember | null> {
  const [row] = await db.select().from(fagMembers).where(eq(fagMembers.id, id)).limit(1);
  return row ?? null;
}

/**
 * CWT-023a: resolve the *active* advisory-member row linked to a platform
 * user, or null. This is the gate for the in-app feedback button — only an
 * active member with a linked account sees it.
 */
export async function getActiveFagMemberForUser(userId: string): Promise<FagMember | null> {
  const [row] = await db
    .select()
    .from(fagMembers)
    .where(and(eq(fagMembers.userId, userId), eq(fagMembers.status, 'active')))
    .limit(1);
  return row ?? null;
}

export interface InsertFagFeedbackInput {
  fagMemberId: string;
  userId: string;
  route: string;
  rating: number;
  comment: string | null;
  category: FagFeedbackCategory;
}

export async function insertFagFeedback(input: InsertFagFeedbackInput): Promise<FagFeedback> {
  const [row] = await db.insert(fagFeedback).values(input).returning();
  return row;
}

/** A member's own past submissions, newest first. */
export async function listFeedbackForMember(fagMemberId: string): Promise<FagFeedback[]> {
  return await db
    .select()
    .from(fagFeedback)
    .where(eq(fagFeedback.fagMemberId, fagMemberId))
    .orderBy(desc(fagFeedback.createdAt));
}

export async function listEntriesForMember(memberId: string): Promise<FagCompensationEntry[]> {
  return await db
    .select()
    .from(fagCompensationEntries)
    .where(eq(fagCompensationEntries.memberId, memberId))
    .orderBy(desc(fagCompensationEntries.occurredOn));
}

export type FagMemberSummary = {
  member: FagMember;
  totalCents: number;
  unpaidCents: number;
  entryCount: number;
};

/**
 * One-shot per-member roll-up for the FAG dashboard. Aggregates total
 * earned and total still-unpaid in cents.
 */
export async function listFagMemberSummaries(): Promise<FagMemberSummary[]> {
  const rows = await db
    .select({
      member: fagMembers,
      totalCents: sql<number>`COALESCE(SUM(${fagCompensationEntries.totalCents}), 0)::int`.as(
        'total_cents',
      ),
      unpaidCents:
        sql<number>`COALESCE(SUM(${fagCompensationEntries.totalCents}) FILTER (WHERE ${fagCompensationEntries.status} = 'unpaid'), 0)::int`.as(
          'unpaid_cents',
        ),
      entryCount: sql<number>`COUNT(${fagCompensationEntries.id})::int`.as('entry_count'),
    })
    .from(fagMembers)
    .leftJoin(fagCompensationEntries, eq(fagCompensationEntries.memberId, fagMembers.id))
    .groupBy(fagMembers.id)
    .orderBy(asc(fagMembers.status), asc(fagMembers.fullName));
  return rows.map((r) => ({
    member: r.member,
    totalCents: Number(r.totalCents),
    unpaidCents: Number(r.unpaidCents),
    entryCount: Number(r.entryCount),
  }));
}

export type FagAggregates = {
  activeMemberCount: number;
  totalPaidCents: number;
  totalUnpaidCents: number;
};

/** Coalition-wide FAG aggregates for the dashboard headline. */
export async function getFagAggregates(): Promise<FagAggregates> {
  const [memberRow] = await db.execute<{ active: number }>(sql`
    SELECT COUNT(*)::int AS active FROM ${fagMembers} WHERE status = 'active'
  `);
  const [moneyRow] = await db.execute<{ paid: number; unpaid: number }>(sql`
    SELECT
      COALESCE(SUM(total_cents) FILTER (WHERE status = 'paid'), 0)::int AS paid,
      COALESCE(SUM(total_cents) FILTER (WHERE status = 'unpaid'), 0)::int AS unpaid
    FROM ${fagCompensationEntries}
  `);
  return {
    activeMemberCount: Number(memberRow.active),
    totalPaidCents: Number(moneyRow.paid),
    totalUnpaidCents: Number(moneyRow.unpaid),
  };
}
