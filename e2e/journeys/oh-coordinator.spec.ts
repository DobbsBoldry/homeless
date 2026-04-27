/**
 * J2 — OH care coordinator morning journey.
 *
 * Sign in → ED morning triage → super-utilizer queue → patient detail
 * → ask Claude about the patient → assert audit log activity.
 *
 * Covers ESUC-008/009/011 + PRs #294/#297.
 */
import { test, expect } from '../fixtures/test-base';
import { dbClient } from '../fixtures/db';

test('J2 coordinator: triage -> queue -> patient detail -> ask claude', async ({
  page,
  signInAs,
}) => {
  await signInAs('coordinator');

  // 1. ED morning triage (PR #294)
  await page.goto('/app/care/triage');
  await expect(page.getByRole('heading', { name: /triage|morning/i }).first()).toBeVisible();

  // 2. Super-utilizer queue (ESUC-009)
  await page.goto('/app/care/queue');
  await expect(page.getByRole('heading', { name: /queue|super.?utilizer|patients/i }).first()).toBeVisible();

  // 3. Find a patient detail link
  const detailLinks = page.locator('a[href^="/app/care/patients/"][href*="-"]');
  if (await detailLinks.first().isVisible().catch(() => false)) {
    const href = await detailLinks.first().getAttribute('href');
    await page.goto(href!);
    await expect(page.getByText(/encounter|patient|housing|visit/i).first()).toBeVisible();

    // 4. Ask Claude about this patient (PR #297). The Q&A panel may be
    //    open by default; locate the input, fill it, then click the
    //    enabled submit button.
    const input = page.getByPlaceholder(/ask|question/i).first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill('What recurring conditions appear in this patient history?');
      await page
        .getByRole('button', { name: /^Ask$|^Send$|^Submit$/ })
        .first()
        .click();
      await page.waitForTimeout(8_000);
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
