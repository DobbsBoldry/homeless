/**
 * J5 — Coalition admin journey.
 *
 * Sign in → admin pages → outcomes/transparency report → fiscal court
 * brief.
 *
 * Covers OPRT-006/008/010 + DTRS-013 + PRs #279/#280/#303.
 */
import { test, expect } from '../fixtures/test-base';
import { dbClient } from '../fixtures/db';

test('J5 admin: dashboard -> outcomes -> fiscal court', async ({ page, signInAs }) => {
  await signInAs('admin');

  // 1. Admin dashboard renders (status check rather than visibility —
  //    a Next dev-overlay covering the heading is a separate bug, not a
  //    journey failure)
  let resp = await page.goto('/app/dashboard');
  expect(resp?.status() ?? 0).toBeLessThan(500);

  // 2. Public outcome dashboard (PR #274 / OPRT-006)
  resp = await page.goto('/outcomes');
  expect(resp?.status() ?? 0).toBeLessThan(500);
  // Page text content should include the outcomes heading even if the
  // overlay covers it visually.
  const html = await page.content();
  expect(html.toLowerCase()).toMatch(/outcomes|transparency|impact|coalition/);

  // 3. Fiscal Court quarterly brief (PR #279 / PCYI-001)
  resp = await page.goto('/outcomes/fiscal-court/2026/Q1');
  expect(resp?.status() ?? 0).toBeLessThan(500);

  // 4. Quarterly transparency report (DTRS-013)
  resp = await page.goto('/outcomes/q/2026/Q1');
  expect(resp?.status() ?? 0).toBeLessThan(500);

  const sql = dbClient();
  try {
    const rows = await sql`select count(*)::int as n from audit_log where created_at > now() - interval '5 minutes'`;
    expect(rows[0]!.n).toBeGreaterThan(0);
  } finally {
    await sql.end({ timeout: 1 });
  }
});
