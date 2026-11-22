import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // A static site in out/, so that any file host can serve it.
  output: 'export',
  // For example "/codexed" on GitHub Pages. Empty at the root of a domain.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  reactStrictMode: true,
};

export default withMDX(config);
