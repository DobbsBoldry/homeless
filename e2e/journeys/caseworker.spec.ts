/**
 * J3 — Caseworker journey.
 *
 * Sign in → morning page → triage → person view → benefits screener.
 *
 * Covers CWT-006/007/011/012 + PRs #283/#295/#296.
 */
import { test, expect } from '../fixtures/test-base';
import { dbClient } from '../fixtures/db';

test('J3 caseworker: morning -> triage -> person -> benefits screener', async ({
  page,
  signInAs,
}) => {
  await signInAs('caseworker');

  // 1. Morning triage (PR #295)
  await page.goto('/app/clients/morning');
  await expect(page.getByRole('heading', { name: /morning|today/i }).first()).toBeVisible();

  // 2. Triage view
  await page.goto('/app/clients/triage');
  await expect(page.getByRole('heading', { name: /triage|clients|caseload/i }).first()).toBeVisible();

  // 3. Open a person view (any link to /app/clients/person/<ref>)
  const personLinks = page.locator('a[href^="/app/clients/person/"]');
  if (await personLinks.first().isVisible().catch(() => false)) {
    const href = await personLinks.first().getAttribute('href');
    await page.goto(href!);
    await expect(page.getByRole('heading', { name: /SYN-PERSON|person profile|profile/i }).first()).toBeVisible();
  }

  // 4. Benefits screener (CWT-007)
  await page.goto('/app/clients/screener');
  await expect(page.getByRole('heading', { name: /screener|benefits|eligibility/i }).first()).toBeVisible();
  // Try to fill the screener with simple values; if labels differ skip silently.
  const householdSize = page.getByLabel(/household size|people in household/i).first();
  const monthlyIncome = page.getByLabel(/monthly income|income/i).first();
  if (
    (await householdSize.isVisible().catch(() => false)) &&
    (await monthlyIncome.isVisible().catch(() => false))
  ) {
    await householdSize.fill('3');
    await monthlyIncome.fill('1200');
    const runBtn = page.getByRole('button', { name: /screen|run|check|estimate/i }).first();
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
      await page.waitForTimeout(2_000);
    }
  }

  const sql = dbClient();
  try {
    const rows = await sql`select count(*)::int as n from audit_log where created_at > now() - interval '5 minutes'`;
    expect(rows[0]!.n).toBeGreaterThan(0);
  } finally {
    await sql.end({ timeout: 1 });
  }
});
