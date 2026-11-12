// @ts-check
import { execFileSync } from 'node:child_process';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/**
 * Canonical site URL.
 * - Set SITE_URL in Cloudflare Pages (or .env) when you use a custom domain.
 * - CF_PAGES_URL is injected automatically by Cloudflare Pages builds.
 * - Falls back to the local dev URL so nothing is hardcoded in the source.
 */
const site = process.env.SITE_URL || process.env.CF_PAGES_URL || 'http://localhost:4321';

/**
 * Regenerates src/styles/member-colors.generated.css (contrast-adjusted member
 * color variables, light + dark) before the build/dev server starts. If the
 * generation script fails, the committed file is used as-is.
 */
const memberColors = {
  name: 'chaereve:member-colors',
  hooks: {
    'astro:build:setup': () => regenerateColors(),
    'astro:dev:setup': () => regenerateColors(),
  },
};

function regenerateColors() {
  try {
    execFileSync('npx', ['--no-install', 'tsx', 'scripts/generate-member-colors.ts'], {
      stdio: 'inherit',
    });
  } catch (err) {
    console.warn('[chaereve] member-colors generation failed — using the committed file.', err?.message ?? err);
  }
}

// Static output only: Cloudflare Pages serves `dist/` as plain static assets.
// Do NOT add @astrojs/cloudflare or `output: 'server'` to this project.
export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  preview: {
    host: '0.0.0.0',
  },
  // Applies to `astro dev` / `astro preview` only (the deployed site is
  // static). Allowing any Host header lets sandboxed/tunneled preview URLs
  // reach the local server; loopback is always allowed by default.
  server: {
    allowedHosts: true,
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin/') && !/\/page\/1\/$/.test(page),
    }),
    memberColors,
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
