#!/usr/bin/env tsx
/**
 * Smoke test for the audit_log append-only trigger (#198).
 *
 * Inserts a throwaway row, then attempts UPDATE and DELETE — both must
 * raise. If either succeeds, the trigger is broken; we exit non-zero.
 *
 * Cleans up after itself by raw SQL (cleanup is the only DELETE allowed —
 * it requires bypassing the trigger via ALTER TABLE ... DISABLE TRIGGER,
 * which only the table owner can do; this script connects as that role).
 *
 * Run: pnpm tsx scripts/verify-audit-log-trigger.ts
 */
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLog } from '@/db/schema/audit-log';

config({ path: ['.env.local', '.env'], override: true });

function flattenError(err: unknown): string {
  const seen = new Set<unknown>();
  const parts: string[] = [];
  let cur: unknown = err;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (cur instanceof Error) {
      parts.push(cur.message);
      cur = (cur as { cause?: unknown }).cause;
    } else if (typeof cur === 'object' && cur !== null) {
      parts.push(JSON.stringify(cur));
      break;
    } else {
      parts.push(String(cur));
      break;
    }
  }
  return parts.join(' | ');
}

async function expectThrows(fn: () => Promise<unknown>, label: string): Promise<boolean> {
  try {
    await fn();
    console.error(`[verify] ✗ ${label} did NOT throw — trigger is not blocking`);
    return false;
  } catch (err) {
    const msg = flattenError(err);
    if (msg.includes('append-only')) {
      console.log(`[verify] ✓ ${label} blocked by trigger`);
      return true;
    }
    console.error(`[verify] ✗ ${label} threw an unexpected error: ${msg}`);
    return false;
  }
}

async function main() {
  const [inserted] = await db
    .insert(auditLog)
    .values({
      action: 'system.trigger_smoke_test',
      metadata: { source: 'verify-audit-log-trigger.ts' },
    })
    .returning();
  console.log(`[verify] inserted test row ${inserted.id}`);

  let allPassed = true;
  allPassed =
    (await expectThrows(
      () =>
        db
          .update(auditLog)
          .set({ action: 'system.trigger_smoke_tampered' })
          .where(sql`id = ${inserted.id}`),
      'UPDATE',
    )) && allPassed;
  allPassed =
    (await expectThrows(() => db.delete(auditLog).where(sql`id = ${inserted.id}`), 'DELETE')) &&
    allPassed;
  allPassed =
    (await expectThrows(() => db.execute(sql`TRUNCATE audit_log`), 'TRUNCATE')) && allPassed;

  // Clean up the test row by temporarily disabling triggers (table owner only).
  await db.execute(sql`ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_delete`);
  try {
    await db.execute(sql`DELETE FROM audit_log WHERE id = ${inserted.id}`);
    console.log('[verify] cleaned up test row');
  } finally {
    await db.execute(sql`ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_delete`);
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('[verify] failed', err);
  process.exit(1);
});
