import { type BrowserContext, type Page } from '@playwright/test';
import { clerk, clerkSetup } from '@clerk/testing/playwright';

export type Persona = 'attorney' | 'caseworker' | 'coordinator' | 'shelter' | 'admin';

const EMAIL: Record<Persona, string> = {
  attorney: 'attorney+e2e@example.com',
  caseworker: 'caseworker+e2e@example.com',
  coordinator: 'coordinator+e2e@example.com',
  shelter: 'shelter+e2e@example.com',
  admin: 'admin+e2e@example.com',
};

let clerkSetupDone = false;

/**
 * Sign in as the given persona using Clerk's programmatic ticket-based
 * helper. The helper hits Clerk's backend API to mint a sign-in ticket
 * for the user's email, bypassing the UI flow entirely (and avoiding
 * any MFA / bot-detection / factor-two gates the test instance might
 * have configured).
 *
 * The persona must already exist in Clerk (provisioned by
 * scripts/e2e-setup.mts).
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
  // The helper requires the page to have loaded Clerk. Land on the home
  // page (public) before signing in.
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: EMAIL[persona] });
}
