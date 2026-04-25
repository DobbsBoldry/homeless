import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin Turbopack root to this repo so it doesn't pick up a stray lockfile higher
  // in the directory tree.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
