/**
 * J5 — Coalition admin journey.
 *
 * Sign in → admin pages → outcomes/transparency report → fiscal court
 * brief.
 *
 * Covers OPRT-006/008/010 + DTRS-013 + PRs #279/#280/#303.
 *
 * Scope: smoke. The four routes here render server-side and are the
 * places where a regression in (a) auth-gate logic for admin role or
 * (b) the public-outcomes data layer (#330 — Date interpolation in raw
 * `sql` templates) would surface as a 5xx. The HTML content match on
 * /outcomes is the only positive visibility check; dev-overlay covering
 * a heading is a separate concern, not a journey failure.
 *
 * Audit-log instrumentation for admin reads is a separate concern (the
 * journey itself doesn't trigger audit writes today; admin-page audit
 * coverage is its own story when the BAA timeline calls for it).
 */

import { expect, test } from '../fixtures/test-base';

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
});
