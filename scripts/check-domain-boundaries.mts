#!/usr/bin/env tsx
/**
 * Domain-boundary lint — FND-020 + FND-040b
 *
 * Two rules, both rooted in ADR 0001 (docs/adr/0001-modular-monolith.md):
 *
 *   1. Allow-list (FND-020): inside src/lib/{domain}/, imports from
 *      src/lib/{otherDomain}/ are forbidden unless otherDomain is on
 *      this domain's allow-list below.
 *
 *   2. Barrel-only (FND-040b): every cross-domain import — anywhere in
 *      the repo, including the composition layer (src/app, src/components,
 *      src/db, etc.) — must target the domain's public API barrel
 *      `@/lib/{domain}` (i.e. src/lib/{domain}/index.ts), not a deep
 *      path like `@/lib/{domain}/<internal>`. Same-domain imports inside
 *      src/lib/{domain}/ may still go deep — internals are free to
 *      reach each other directly.
 *
 *      EXEMPTION: files starting with `'use client'` may use deep
 *      paths. The barrel `export *` aggregates server-only code
 *      (postgres, AI clients, etc.) into the client bundle, which
 *      Next.js can't tree-shake. Client components must keep their
 *      import surface narrow. The allow-list rule still applies.
 *
 * Imports of non-domain shared code at the top of src/lib/ (utils.ts,
 * audit.ts, auth.ts, email/, etc.) are always fine — those are kernel,
 * not a domain.
 *
 *   3. Restricted-table imports (ADR 0007 — abuser-blind discipline):
 *      certain table symbols are restricted to a narrow allowlist of
 *      directories. The `dv_survivors` and `dv_safety_events` schema
 *      symbols are the cornerstone: direct query access from outside
 *      `src/lib/subp/` would bypass the abuser-blind middleware and
 *      open an enumeration vector. The schema definition itself
 *      (src/db/schema/) and its barrel re-export are exempt; everything
 *      else must go through the subp domain's public queries.
 *
 * Run via: pnpm lint:boundaries
 *
 * Adding a new cross-domain dep: amend ADR 0001 first, then update
 * ALLOW. The ADR is the source of truth; this script enforces it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname;
const LIB_ROOT = join(REPO_ROOT, 'src/lib');
const SRC_ROOT = join(REPO_ROOT, 'src');

const ALLOW: Record<string, readonly string[]> = {
  coordination: [],
  coalition: ['coordination'],
  cwt: ['coordination', 'dtrs'],
  dtrs: [],
  esuc: ['coordination', 'dtrs'],
  eviction: ['dtrs'],
  indc: ['coordination'],
  oprt: ['coalition', 'coordination', 'cwt', 'esuc', 'eviction', 'indc'],
  subp: ['dtrs'],
};

const DOMAINS = new Set(Object.keys(ALLOW));

// Captures: target domain (group 1), optional sub-path beyond domain (group 2).
//   `from '@/lib/eviction'`              → group1=eviction, group2=undefined  (barrel — fine)
//   `from '@/lib/eviction/risk-band'`    → group1=eviction, group2='risk-band' (deep — flag if cross-domain)
const IMPORT_RE = /from\s+['"]@\/lib\/([a-z][a-z0-9-]*)(?:\/([^'"]+))?['"]/g;

type Violation =
  | { kind: 'allow-list'; file: string; fromDomain: string; toDomain: string; line: number }
  | {
      kind: 'deep-import';
      file: string;
      fromDomain: string | null;
      toDomain: string;
      subPath: string;
      line: number;
    }
  | { kind: 'restricted-table'; file: string; symbol: string; line: number };

/**
 * Restricted DB schema symbols: callers outside `src/lib/subp/` (or the
 * schema definition itself) must NOT import these. Per ADR 0007, the
 * abuser-blind middleware in `src/lib/subp/abuser-blind.ts` is the only
 * authorized access path; direct table reads bypass the gate.
 */
const RESTRICTED_TABLES: ReadonlyArray<{
  symbol: string;
  allowedPathPrefixes: readonly string[];
}> = [
  {
    symbol: 'dvSurvivors',
    allowedPathPrefixes: ['src/lib/subp/', 'src/db/schema/', 'scripts/gen-synthetic-dv-survivors'],
  },
  {
    symbol: 'dvSafetyEvents',
    allowedPathPrefixes: ['src/lib/subp/', 'src/db/schema/', 'scripts/gen-synthetic-dv-survivors'],
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
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

/** Return the domain name if `file` lives inside src/lib/{domain}/, else null. */
function domainOf(file: string): string | null {
  const rel = relative(LIB_ROOT, file);
  if (rel.startsWith('..') || rel.startsWith('/')) return null;
  const top = rel.split('/')[0];
  return DOMAINS.has(top) ? top : null;
}

function isRestrictedTableImportLine(
  line: string,
): { matched: false } | { matched: true; symbol: string } {
  // Only flag identifier mentions inside `import { ... }` clauses. This
  // avoids false positives on prose comments / doc strings that happen
  // to mention the symbol.
  if (!/^\s*import\b/.test(line)) return { matched: false };
  for (const r of RESTRICTED_TABLES) {
    const re = new RegExp(String.raw`(?:^|[^A-Za-z0-9_$])${r.symbol}(?:[^A-Za-z0-9_$]|$)`);
    if (re.test(line)) return { matched: true, symbol: r.symbol };
  }
  return { matched: false };
}

function isFileAllowedForRestrictedSymbol(relPath: string, symbol: string): boolean {
  const r = RESTRICTED_TABLES.find((t) => t.symbol === symbol);
  if (!r) return true;
  return r.allowedPathPrefixes.some((p) => relPath.startsWith(p));
}

function check(): Violation[] {
  const violations: Violation[] = [];
  const srcFiles = walk(SRC_ROOT);
  // Walk scripts/ separately — only the restricted-table rule applies
  // there. The allow-list and barrel-only rules don't extend into ops
  // scripts (they predate the barrel convention and rewrite is out of
  // scope for any single story).
  const scriptFiles = walk(join(REPO_ROOT, 'scripts'));

  // Restricted-table rule: applies to BOTH src/ and scripts/.
  for (const file of [...srcFiles, ...scriptFiles]) {
    const src = readFileSync(file, 'utf8');
    const relPath = relative(REPO_ROOT, file);
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const restricted = isRestrictedTableImportLine(line);
      if (restricted.matched && !isFileAllowedForRestrictedSymbol(relPath, restricted.symbol)) {
        violations.push({
          kind: 'restricted-table',
          file: relPath,
          symbol: restricted.symbol,
          line: i + 1,
        });
      }
    }
  }

  // Allow-list + barrel-only rules: src/ only.
  for (const file of srcFiles) {
    const fromDomain = domainOf(file);
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    // Client components are exempt from the barrel-only rule (rule 2).
    // The `export *` barrel pulls server-only code (postgres, etc.) into
    // the client bundle. Allow deep paths for these so Next.js can keep
    // the bundle small. Allow-list (rule 1) still applies.
    const isClient = /^['"]use client['"];?\s*$/.test(lines[0] ?? '');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      IMPORT_RE.lastIndex = 0;
      let m = IMPORT_RE.exec(line);
      while (m !== null) {
        const target = m[1];
        const subPath = m[2];
        if (DOMAINS.has(target)) {
          // Rule 1: allow-list (only inside src/lib/{domain}/)
          if (fromDomain !== null && fromDomain !== target) {
            const allowed = ALLOW[fromDomain];
            if (!allowed.includes(target)) {
              violations.push({
                kind: 'allow-list',
                file: relative(REPO_ROOT, file),
                fromDomain,
                toDomain: target,
                line: i + 1,
              });
            }
          }
          // Rule 2: barrel-only — deep imports across domain boundaries are forbidden,
          // EXCEPT inside `'use client'` files (see header). Same-domain deep imports
          // inside src/lib/{domain}/ are fine — internals reach each other directly.
          if (subPath && fromDomain !== target && !isClient) {
            violations.push({
              kind: 'deep-import',
              file: relative(REPO_ROOT, file),
              fromDomain,
              toDomain: target,
              subPath,
              line: i + 1,
            });
          }
        }
        m = IMPORT_RE.exec(line);
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

  const allowList = violations.filter((v) => v.kind === 'allow-list');
  const deepImport = violations.filter((v) => v.kind === 'deep-import');
  const restrictedTable = violations.filter((v) => v.kind === 'restricted-table');

  console.error(`✗ ${violations.length} domain-boundary violation(s):\n`);
  if (allowList.length) {
    console.error(`  allow-list (${allowList.length}):`);
    for (const v of allowList) {
      if (v.kind !== 'allow-list') continue;
      console.error(
        `    ${v.file}:${v.line}  ${v.fromDomain} → ${v.toDomain}  (not on allow-list)`,
      );
    }
  }
  if (deepImport.length) {
    console.error(`  deep-import (${deepImport.length}) — must use '@/lib/{domain}' barrel:`);
    for (const v of deepImport) {
      if (v.kind !== 'deep-import') continue;
      const from = v.fromDomain ?? '<composition>';
      console.error(`    ${v.file}:${v.line}  ${from} → @/lib/${v.toDomain}/${v.subPath}`);
    }
  }
  if (restrictedTable.length) {
    console.error(`  restricted-table (${restrictedTable.length}) — see ADR 0007:`);
    for (const v of restrictedTable) {
      if (v.kind !== 'restricted-table') continue;
      console.error(
        `    ${v.file}:${v.line}  imports '${v.symbol}' — must route through src/lib/subp/`,
      );
    }
  }
  console.error(
    '\nSee docs/adr/0001-modular-monolith.md. Cross-domain imports must go through' +
      " the domain's public API at src/lib/{domain}/index.ts.",
  );
  process.exit(1);
}

main();
