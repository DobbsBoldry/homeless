/**
 * S1 — Public consent grant flow.
 *
 * The /p/[ref]/consent/grant page is a public surface. Auth gate is either
 * a bound access token or INDC_CONSENT_OPEN_MODE=1 (see #272 / DTRS-002).
 * Open mode is enabled in the e2e config so we can exercise the form
 * without minting tokens.
 *
 * Verifies:
 *   - The page loads for a valid synthetic ref
 *   - Submitting the form creates a row in `consents`
 *   - The submission writes a `consent.granted` audit_log entry
 *   - 404 on an invalid ref (no leak that the route exists)
 */

import { dbClient } from '../fixtures/db';
import { expect, test } from '../fixtures/test-base';

const REF = 'SYN-PERSON-E2E1'; // unused-by-seed ref so we don't collide with seeded consents

test.describe('S1 consent grant flow', () => {
  test('invalid ref -> 404', async ({ page }) => {
    const resp = await page.goto('/p/NOT-A-REAL-REF/consent/grant?type=phi_share_within_coalition');
    expect(resp?.status()).toBe(404);
  });

  test('valid ref -> form -> consent row + audit event', async ({ page }) => {
    const sql = dbClient();
    try {
      const beforeConsents = (
        await sql`select count(*)::int as n from consents where subject_external_id = ${REF}`
      )[0]!.n;
      const beforeAudits = (
        await sql`
          select count(*)::int as n
          from audit_log al
          join consents c on c.id = al.target_id::uuid
          where al.action = 'consent.granted' and c.subject_external_id = ${REF}
        `
      )[0]!.n;

      const resp = await page.goto(`/p/${REF}/consent/grant?type=phi_share_within_coalition`);
      expect(resp?.status()).toBeLessThan(400);

      // Form fields: at least one data-class checkbox is pre-checked,
      // and the user types a signature. The form sets `name` from the
      // signature input.
      await page.getByLabel(/your name/i).fill('E2E Smoke Tester');
      await page.getByRole('button', { name: /^I agree$/ }).click();

      // The success panel replaces the form and contains "Thank you, <name>."
      await expect(page.getByText('Thank you, E2E Smoke Tester.', { exact: false })).toBeVisible({
        timeout: 10_000,
      });

      const afterConsents = (
        await sql`select count(*)::int as n from consents where subject_external_id = ${REF}`
      )[0]!.n;
      expect(afterConsents).toBeGreaterThan(beforeConsents);

      const afterAudits = (
        await sql`
          select count(*)::int as n
          from audit_log al
          join consents c on c.id = al.target_id::uuid
          where al.action = 'consent.granted' and c.subject_external_id = ${REF}
        `
      )[0]!.n;
      expect(afterAudits).toBeGreaterThan(beforeAudits);
    } finally {
      await sql.end({ timeout: 1 });
    }
  });
});
