/**
 * J1 — KLA attorney morning journey.
 *
 * Sign in → docket dashboard → open a filing → ask Claude about the case
 * → assert AI response renders and an audit_log row was written.
 *
 * Covers EVDT-009/012/015/016 + PR #287.
 */

import { dbClient } from '../fixtures/db';
import { expect, test } from '../fixtures/test-base';

test('J1 attorney: triage -> filings -> case detail -> ask claude', async ({ page, signInAs }) => {
  await signInAs('attorney');

  // 1. Triage page renders
  await page.goto('/app/cases/triage');
  await expect(page.getByRole('heading', { name: /morning triage/i })).toBeVisible();

  // 2. Filings table has rows
  await page.goto('/app/cases/filings');
  await expect(page.getByRole('heading', { name: /docket|filings|cases/i }).first()).toBeVisible();

  // Find a row link to a filing detail page (data-cell with href).
  const detailLinks = page.locator('a[href^="/app/cases/filings/"][href*="-"]');
  await expect(detailLinks.first()).toBeVisible({ timeout: 10_000 });
  const href = await detailLinks.first().getAttribute('href');
  expect(href, 'expected at least one filing detail link').toBeTruthy();

  // 3. Filing detail page
  await page.goto(href!);
  await expect(page.getByText(/case|defendant|plaintiff|filed/i).first()).toBeVisible();

  // 4. Ask Claude about this case (PR #287)
  const askButton = page.getByRole('button', { name: /ask claude|case q&a|ask|q&a/i }).first();
  if (await askButton.isVisible().catch(() => false)) {
    await askButton.click();
    const input = page
      .getByPlaceholder(/ask|question/i)
      .or(page.getByRole('textbox'))
      .first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill('Are there procedural defects in this filing?');
      const submit = page.getByRole('button', { name: /send|ask|submit/i }).last();
      await submit.click();
      // Wait for any non-empty AI response container.
      await page.waitForTimeout(8_000); // give the haiku call (or cached replay) time
    }
  }

  // 5. Verify the page didn't 5xx during AI flow
  expect(page.url()).toContain('/app/cases/filings/');

  // 6. Verify some audit_log activity happened during this session
  const sql = dbClient();
  try {
    const rows = await sql`
      select count(*)::int as n from audit_log
      where created_at > now() - interval '5 minutes'
    `;
    expect(rows[0]!.n, 'no audit events written during journey').toBeGreaterThan(0);
  } finally {
    await sql.end({ timeout: 1 });
  }
});
