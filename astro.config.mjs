// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Astro static site — KHÔNG dùng adapter, KHÔNG dùng output: 'server'.
 * Build: `npm run build`  →  output: dist/ (deploy trên Cloudflare Pages).
 *
 * PUBLIC_SITE_URL: URL gốc của site (ví dụ https://your-project.pages.dev
 * hoặc https://your-domain.com). Dùng cho canonical URL, Open Graph, sitemap.
 */
const site = process.env.PUBLIC_SITE_URL || 'https://example.pages.dev';

const config = {
  site,
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  // Cho phép live preview của Arena (host dạng *.e2b.app) khi chạy preview/dev.
  preview: {
    allow: ['.e2b.app'],
  },
  server: {
    allowedHosts: ['.e2b.app'],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
    },
  },
};

// Ép kiểu: `preview.allow` là option host-check của preview server (dùng cho live preview).
export default defineConfig(/** @type {Parameters<typeof defineConfig>[0]} */ (config));
