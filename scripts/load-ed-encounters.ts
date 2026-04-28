#!/usr/bin/env tsx
/**
 * Idempotent loader for the ESUC-024 synthetic ED encounters fixture.
 * Mirror of load-fixtures.ts.
 *
 * Usage:
 *   pnpm tsx scripts/load-ed-encounters.ts
 *   pnpm tsx scripts/load-ed-encounters.ts --file fixtures/ed-encounters.json
 *
 * Upserts on (encounter_external_id, source) so re-running is safe.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import {
  EdEncounterBatchSchema,
  type SyntheticEdEncounter,
} from '@/ai/prompts/synthetic-ed-encounters';
import { db } from '@/db/client';
import { edEncounters, type NewEdEncounter } from '@/db/schema/ed-encounters';
import { scrubClinicalNote } from '@/lib/esuc/scrub';

config({ path: ['.env.local', '.env'], override: true });

const { values } = parseArgs({
  options: {
    file: { type: 'string', default: 'fixtures/ed-encounters.json' },
  },
});

function toRow(e: SyntheticEdEncounter): NewEdEncounter {
  const arrived = new Date(e.arrived_at);
  const discharged = e.discharged_at ? new Date(e.discharged_at) : null;
  return {
    patientId: e.patient_id,
    encounterExternalId: e.encounter_external_id,
    arrivedAt: arrived,
    dischargedAt: discharged,
    chiefComplaint: e.chief_complaint,
    disposition: e.disposition,
    housingStatus: e.housing_status,
    chargeCents: e.charge_cents,
    // Ingest-time scrub (#247 / ADR 0002). The DB column never sees
    // raw clinical notes — names, addresses, phones, MRNs, dates are
    // redacted before INSERT. care-plan.ts re-scrubs at prompt-build
    // as defense-in-depth.
    notes: scrubClinicalNote(e.notes ?? null),
    source: 'synthetic',
    rawJson: e as unknown as Record<string, unknown>,
  };
}

async function main() {
  const filePath = resolve(process.cwd(), values.file ?? 'fixtures/ed-encounters.json');
  console.log(`[load-ed] reading ${filePath}`);

  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  const parsed = EdEncounterBatchSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[load-ed] fixture failed schema validation', parsed.error.issues.slice(0, 5));
    process.exit(1);
  }

  const counts = { inserted: 0, updated: 0, unchanged: 0 };

  for (const e of parsed.data.encounters) {
    const row = toRow(e);
    const result = await db
      .insert(edEncounters)
      .values(row)
      .onConflictDoUpdate({
        target: [edEncounters.encounterExternalId, edEncounters.source],
        set: {
          housingStatus: row.housingStatus,
          disposition: row.disposition,
          chiefComplaint: row.chiefComplaint,
          chargeCents: row.chargeCents,
          // `row.notes` is already scrubbed by toRow() — see #247.
          notes: row.notes,
          dischargedAt: row.dischargedAt,
          updatedAt: new Date(),
        },
      })
      .returning({ id: edEncounters.id, createdAt: edEncounters.createdAt });
    const created = result[0];
    if (!created) {
      counts.unchanged++;
    } else {
      const isNew = Math.abs(Date.now() - created.createdAt.getTime()) < 5_000;
      if (isNew) counts.inserted++;
      else counts.updated++;
    }
  }

  console.log(`[load-ed] ${JSON.stringify(counts)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[load-ed] failed', err);
  process.exit(1);
});
