#!/usr/bin/env tsx
/**
 * Demo seed: load realistic synthetic state into staging so the eviction
 * pipeline is browseable end-to-end without manual SQL.
 *
 * What this produces (idempotent — re-running adds nothing):
 *  - Up to 50 synthetic filings from fixtures/eviction-filings.json
 *  - Risk scores on every filing (real Claude API calls — paid)
 *  - 3 response packets in 'draft', 1 in 'approved', 1 in 'filed' (also paid)
 *  - Demo attorney user (email from DEMO_ATTORNEY_EMAIL or default), promoted
 *    to role=attorney and added to the KLA Owensboro org
 *
 * Usage:
 *   pnpm tsx scripts/seed-demo.ts
 *   DEMO_ATTORNEY_EMAIL=you@example.com pnpm tsx scripts/seed-demo.ts
 *
 * Prereqs:
 *   - pnpm db:migrate has run (KLA org exists)
 *   - ANTHROPIC_API_KEY set (for scoring + packet generation)
 *   - DATABASE_URL set
 *
 * Cost note:
 *   Up to ~50 score calls (~10K tokens each on Opus 4.7) and 5 packet
 *   generations (~3K tokens each). Order of magnitude: $0.50–1 per run.
 *   Idempotent caching means re-runs are free after the first.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { listRecentFilings } from '@/db/queries/eviction-filings';
import { evictionResponsePackets } from '@/db/schema/eviction-response-packets';
import { orgMemberships } from '@/db/schema/org-memberships';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { users } from '@/db/schema/users';
import { KLA_OWENSBORO_SLUG } from '@/lib/auth';
import { parseEvictionFiling } from '@/lib/eviction/parser';
import { generateResponsePacket } from '@/lib/eviction/response-packet';
import { scoreFiling } from '@/lib/eviction/risk-score';
import { upsertFiling } from '@/lib/eviction/upsert';

config({ path: ['.env.local', '.env'], override: true });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[demo] ANTHROPIC_API_KEY is not set');
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    file: { type: 'string', default: 'fixtures/eviction-filings.json' },
    'max-filings': { type: 'string', default: '50' },
    'packet-count': { type: 'string', default: '5' },
  },
});

const maxFilings = Math.max(1, Number.parseInt(values['max-filings'] ?? '50', 10));
const packetCount = Math.max(0, Number.parseInt(values['packet-count'] ?? '5', 10));
const demoEmail = process.env.DEMO_ATTORNEY_EMAIL?.trim() || 'demo-attorney+seed@example.test';

async function ensureDemoAttorney() {
  console.log(`[demo] ensuring demo attorney user ${demoEmail}…`);

  const [klaOrg] = await db
    .select()
    .from(partnerOrgs)
    .where(eq(partnerOrgs.slug, KLA_OWENSBORO_SLUG))
    .limit(1);
  if (!klaOrg) {
    throw new Error(
      `[demo] partner_org slug='${KLA_OWENSBORO_SLUG}' not found — run pnpm db:seed first`,
    );
  }

  const [existing] = await db.select().from(users).where(eq(users.email, demoEmail)).limit(1);
  let user = existing;
  if (!user) {
    const fakeClerkId = `seed_demo_attorney_${Date.now().toString(36)}`;
    [user] = await db
      .insert(users)
      .values({
        clerkUserId: fakeClerkId,
        email: demoEmail,
        firstName: 'Demo',
        lastName: 'Attorney',
        role: 'attorney',
      })
      .returning();
    console.log(`[demo]   + user ${user.email}`);
  } else if (user.role !== 'attorney') {
    [user] = await db
      .update(users)
      .set({ role: 'attorney', updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    console.log(`[demo]   = user ${user.email} promoted to attorney`);
  } else {
    console.log(`[demo]   = user ${user.email} (exists, already attorney)`);
  }

  await db
    .insert(orgMemberships)
    .values({ userId: user.id, partnerOrgId: klaOrg.id, role: 'attorney' })
    .onConflictDoNothing({ target: [orgMemberships.userId, orgMemberships.partnerOrgId] });
  console.log(`[demo]   = membership in ${klaOrg.slug}`);

  return user;
}

async function loadFilings(): Promise<number> {
  const filePath = resolve(process.cwd(), values.file ?? 'fixtures/eviction-filings.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as { filings: unknown[] };
  const slice = raw.filings.slice(0, maxFilings);
  console.log(`[demo] loading ${slice.length} filings from ${filePath}…`);

  const counts = { inserted: 0, updated: 0, unchanged: 0, superseded: 0, parse_errors: 0 };
  for (const record of slice) {
    const result = parseEvictionFiling(record, 'synthetic');
    if (!result.ok) {
      counts.parse_errors++;
      continue;
    }
    const { action } = await upsertFiling(result.filing);
    counts[action]++;
  }
  console.log(`[demo]   ${JSON.stringify(counts)}`);
  return slice.length;
}

async function scoreAll(): Promise<number> {
  const filings = await listRecentFilings({ limit: maxFilings });
  console.log(`[demo] scoring up to ${filings.length} filings…`);
  let scored = 0;
  for (const f of filings) {
    await scoreFiling(f);
    scored += 1;
    if (scored % 10 === 0) console.log(`[demo]   ${scored}/${filings.length} scored`);
  }
  console.log(`[demo]   ${scored} scored`);
  return scored;
}

async function generatePackets(userId: string): Promise<void> {
  const filings = await listRecentFilings({ limit: packetCount });
  if (filings.length < packetCount) {
    console.warn(`[demo]   only ${filings.length} filings exist; generating that many packets`);
  }
  console.log(`[demo] generating ${filings.length} response packets…`);

  const targetStatuses: Array<'draft' | 'approved' | 'filed'> = [];
  for (let i = 0; i < filings.length; i++) {
    if (i === filings.length - 1) targetStatuses.push('filed');
    else if (i === filings.length - 2) targetStatuses.push('approved');
    else targetStatuses.push('draft');
  }

  for (let i = 0; i < filings.length; i++) {
    const f = filings[i];
    const target = targetStatuses[i];
    const packet = await generateResponsePacket(f, userId);
    if (packet.status !== target) {
      await db
        .update(evictionResponsePackets)
        .set({ status: target, updatedAt: new Date() })
        .where(eq(evictionResponsePackets.id, packet.id));
      console.log(`[demo]   ${f.caseNumber}: packet -> ${target}`);
    } else {
      console.log(`[demo]   ${f.caseNumber}: packet already ${target}`);
    }
  }
}

async function main() {
  console.log('[demo] starting…');
  const user = await ensureDemoAttorney();
  await loadFilings();
  await scoreAll();
  if (packetCount > 0) await generatePackets(user.id);
  console.log('[demo] done.');
  console.log('');
  console.log(`Demo attorney login: ${demoEmail}`);
  console.log('  - role:        attorney');
  console.log(`  - org:         ${KLA_OWENSBORO_SLUG}`);
  console.log('  - clerk:       fake (DB-only — Bo signs in via Clerk, then promotes himself');
  console.log('                  via the upcoming admin UI [ADMIN-001] or via Supabase SQL).');
  process.exit(0);
}

main().catch((err) => {
  console.error('[demo] failed', err);
  process.exit(1);
});
