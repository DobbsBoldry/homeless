#!/usr/bin/env tsx
/**
 * Reads e2e/test-results/results.json (Playwright JSON reporter output)
 * and, for each failed test, prints a draft `gh issue create` invocation
 * the user can review and confirm before filing.
 *
 * Confirmation is interactive (prompts y/N per failure). Pass --yes to
 * file all without prompting (used in CI once the suite is stable).
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';

const REPORT = 'e2e/test-results/results.json';

interface PwError {
  message?: string;
}
interface PwAttachment {
  name: string;
  path?: string;
}
interface PwResult {
  status: string;
  error?: PwError;
  errors?: PwError[];
  attachments?: PwAttachment[];
}
interface PwTest {
  results: PwResult[];
  status: string;
}
interface PwSpec {
  title: string;
  file: string;
  line: number;
  tests: PwTest[];
}
interface PwSuite {
  title?: string;
  file?: string;
  suites?: PwSuite[];
  specs?: PwSpec[];
}
interface PwReport {
  suites?: PwSuite[];
}

function epicFromPath(path: string): string {
  if (path.includes('kla-attorney') || path.includes('eviction')) return 'epic:evdt';
  if (path.includes('coordinator') || path.includes('care')) return 'epic:esuc';
  if (path.includes('caseworker') || path.includes('cwt')) return 'epic:cwt';
  if (path.includes('dispatcher') || path.includes('sms') || path.includes('coor'))
    return 'epic:coor';
  if (path.includes('admin') || path.includes('outcomes') || path.includes('oprt'))
    return 'epic:oprt';
  if (path.includes('consent') || path.includes('dv-blind') || path.includes('audit'))
    return 'epic:dtrs';
  return 'epic:qa';
}

function walkSuites(suite: PwSuite, into: PwSpec[]): void {
  for (const s of suite.specs ?? []) into.push(s);
  for (const child of suite.suites ?? []) walkSuites(child, into);
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

async function main() {
  const yes = process.argv.includes('--yes');
  if (!existsSync(REPORT)) {
    console.error(`No ${REPORT} found. Run pnpm e2e first.`);
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(REPORT, 'utf8')) as PwReport;
  const specs: PwSpec[] = [];
  for (const suite of report.suites ?? []) walkSuites(suite, specs);

  const failed = specs.filter((s) =>
    s.tests.some((t) => t.results.some((r) => r.status === 'failed' || r.status === 'timedOut')),
  );

  if (failed.length === 0) {
    console.log('No failures to report — nothing to do.');
    return;
  }

  console.log(`\nFound ${failed.length} failed test(s).\n`);

  const rl = yes ? null : readline.createInterface({ input, output });

  for (const spec of failed) {
    const firstResult = spec.tests[0]?.results.find((r) => r.status !== 'passed');
    const firstError = firstResult?.error?.message ?? '(no error message)';
    const traceAttachment = firstResult?.attachments?.find((a) => a.name === 'trace');
    const tracePath = traceAttachment?.path ?? '(no trace recorded)';
    const epic = epicFromPath(spec.file);
    const idMatch = spec.title.match(/^[JS]\d+/);
    const id = idMatch ? idMatch[0] : 'TEST';
    const titleSnip = spec.title.length > 80 ? `${spec.title.slice(0, 77)}...` : spec.title;
    const issueTitle = `[e2e] ${id} — ${titleSnip}`;
    // Strip ANSI escape sequences from the captured error text.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI deliberately
    const cleanError = firstError.replace(/\u001b\[[0-9;]*m/g, '').slice(0, 2000);
    const body = [
      `Failing test: \`${spec.file}:${spec.line}\``,
      ``,
      `**Error:**`,
      '```',
      cleanError,
      '```',
      ``,
      `Trace: \`${tracePath}\``,
      ``,
      `Filed automatically by \`pnpm e2e:report\`. Review the trace before fixing.`,
    ].join('\n');

    console.log('---');
    console.log(`Title:  ${issueTitle}`);
    console.log(`Labels: bug, e2e, ${epic}`);
    console.log(`Body:`);
    console.log(body);
    console.log('');

    let proceed = yes;
    if (!proceed && rl) {
      const ans = (await rl.question('File this issue? [y/N] ')).trim().toLowerCase();
      proceed = ans === 'y' || ans === 'yes';
    }

    if (proceed) {
      const cmd = `gh issue create --title ${shellEscape(issueTitle)} --body ${shellEscape(body)} --label bug --label e2e --label ${epic}`;
      try {
        const url = execSync(cmd, { encoding: 'utf8' }).trim();
        console.log(`✓ filed: ${url}`);
      } catch (err) {
        console.error(`! failed to create issue:`, (err as Error).message);
      }
    } else {
      console.log('skipped.');
    }
  }
  rl?.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
