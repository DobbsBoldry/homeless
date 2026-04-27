#!/usr/bin/env tsx
/**
 * FND-020 — domain-boundary lint
 *
 * Enforces ADR 0001 (docs/adr/0001-modular-monolith.md): a file under
 * src/lib/{domain}/ may not import from src/lib/{otherDomain}/ unless
 * otherDomain is on this domain's allow-list below.
 *
 * Files outside src/lib/{domain}/ (server actions, components, app routes)
 * are the composition layer and may import any domain — they are not
 * checked. Same-domain imports and imports of non-domain shared code at
 * the top of src/lib/ (utils.ts, audit.ts, auth.ts, etc.) are always fine.
 *
 * Run via: pnpm lint:boundaries
 *
 * To add a new allowed cross-domain dep: amend ADR 0001 first, then add
 * here. The ADR is the source of truth; this file enforces it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname;
const LIB_ROOT = join(REPO_ROOT, 'src/lib');

const ALLOW: Record<string, readonly string[]> = {
  coordination: [],
  coalition: ['coordination'],
  cwt: ['coordination', 'dtrs'],
  dtrs: [],
  esuc: ['coordination', 'dtrs'],
  eviction: ['dtrs'],
  indc: ['coordination'],
  oprt: ['coalition', 'coordination', 'cwt', 'esuc', 'eviction', 'indc'],
};

const DOMAINS = new Set(Object.keys(ALLOW));

const IMPORT_RE = /from\s+['"]@\/lib\/([a-z][a-z0-9-]*)(?:\/[^'"]*)?['"]/g;

type Violation = {
  file: string;
  fromDomain: string;
  toDomain: string;
  line: number;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full, out);
    } else if (
      (full.endsWith('.ts') || full.endsWith('.tsx')) &&
      !full.endsWith('.test.ts') &&
      !full.endsWith('.test.tsx')
    ) {
      out.push(full);
    }
  }
  return out;
}

function check(): Violation[] {
  const violations: Violation[] = [];

  for (const domain of DOMAINS) {
    const domainDir = join(LIB_ROOT, domain);
    let files: string[];
    try {
      files = walk(domainDir);
    } catch {
      continue; // domain folder doesn't exist yet — fine
    }

    const allowed = new Set([domain, ...ALLOW[domain]]);

    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        IMPORT_RE.lastIndex = 0;
        let m = IMPORT_RE.exec(line);
        while (m !== null) {
          const target = m[1];
          if (DOMAINS.has(target) && !allowed.has(target)) {
            violations.push({
              file: relative(REPO_ROOT, file),
              fromDomain: domain,
              toDomain: target,
              line: i + 1,
            });
          }
          m = IMPORT_RE.exec(line);
        }
      }
    }
  }

  return violations;
}

function main() {
  const violations = check();
  if (violations.length === 0) {
    console.log('✓ domain boundaries clean');
    return;
  }

  console.error(`✗ ${violations.length} domain-boundary violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.fromDomain} → ${v.toDomain}  (not on allow-list)`);
  }
  console.error(
    '\nSee docs/adr/0001-modular-monolith.md. To add an allowed dep,' +
      ' amend the ADR and update ALLOW in scripts/check-domain-boundaries.mts.',
  );
  process.exit(1);
}

main();
