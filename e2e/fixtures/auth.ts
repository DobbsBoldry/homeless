import { type BrowserContext, type Page } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';

export type Persona = 'attorney' | 'caseworker' | 'coordinator' | 'shelter' | 'admin';

const EMAIL: Record<Persona, string> = {
  attorney: 'attorney+e2e@example.com',
  caseworker: 'caseworker+e2e@example.com',
  coordinator: 'coordinator+e2e@example.com',
  shelter: 'shelter+e2e@example.com',
  admin: 'admin+e2e@example.com',
};

const PASSWORD: Record<Persona, string> = {
  attorney: 'E2eTest!2026Aa',
  caseworker: 'E2eTest!2026Cw',
  coordinator: 'E2eTest!2026Co',
  shelter: 'E2eTest!2026Sh',
  admin: 'E2eTest!2026Ad',
};

let clerkSetupDone = false;

/**
 * Sign in as the given persona. The persona must already exist in Clerk
 * (provisioned by scripts/e2e-setup.mts).
 *
 * Uses Clerk testing tokens to bypass bot protection. The first call
 * lazily initializes Clerk testing.
 */
export async function signInAs(
  persona: Persona,
  page: Page,
  _context: BrowserContext,
): Promise<void> {
  if (!clerkSetupDone) {
    await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY });
    clerkSetupDone = true;
  }
  await setupClerkTestingToken({ page });

  await page.goto('/sign-in');
  // Clerk's sign-in flow varies — try the modern email-then-password layout first.
  const emailField = page.getByLabel(/email address|email/i).first();
  await emailField.waitFor({ state: 'visible', timeout: 15_000 });
  await emailField.fill(EMAIL[persona]);

  // The Continue button advances from email to password.
  const continueBtn = page.getByRole('button', { name: /continue/i });
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
  }

  const passwordField = page.getByLabel(/^password$/i);
  await passwordField.waitFor({ state: 'visible', timeout: 10_000 });
  await passwordField.fill(PASSWORD[persona]);

  const submitBtn = page
    .getByRole('button', { name: /continue|sign in/i })
    .last();
  await submitBtn.click();

  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 20_000 });
}
