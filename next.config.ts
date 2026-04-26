import path from 'node:path';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin Turbopack root to this repo so it doesn't pick up a stray lockfile higher
  // in the directory tree.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default withSentryConfig(nextConfig, {
  // Quiet unless the source-map upload token is set.
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
});
