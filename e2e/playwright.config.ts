import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.e2e', override: true });

export default defineConfig({
  testDir: '.',
  fullyParallel: false, // tests share one DB; run serially for determinism
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: '.playwright/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  outputDir: '.traces',
  webServer: {
    command: 'pnpm dev',
    cwd: '..',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY!,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
      E2E_MOCK_OUTBOUND: '1',
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? 'e2e-test-token',
      TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? '+15555550100',
      RESEND_API_KEY: process.env.RESEND_API_KEY ?? 're_test_unused',
      // Open-mode lets e2e exercise the public consent surface without
      // minting access tokens. Same gate as dev demos.
      INDC_CONSENT_OPEN_MODE: '1',
      SENTRY_DSN: '',
      // Clerk redirect URLs from .env.local — needed so the dev server matches
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up',
      NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: '/app/dashboard',
      NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: '/app/dashboard',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
