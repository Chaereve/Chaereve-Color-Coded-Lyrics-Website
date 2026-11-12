/**
 * Cấu hình thương hiệu & tích hợp — KHÔNG chứa secret.
 * - Tên site/tagline: sửa tại đây.
 * - Domain / repo / OAuth: dùng environment variables (xem .env.example).
 */
import { execSync } from 'node:child_process';

export const SITE_NAME = 'Chaereve';
export const SITE_TAGLINE = 'Color-Coded Lyrics & Line Distribution';
export const SITE_DESCRIPTION =
  'Xem lyrics tô màu theo từng thành viên, line distribution minh bạch, romanization và translation — dữ liệu minh bạch, có nguồn, có quy trình correction.';

/** URL gốc tuyệt đối cho SEO/sitemap/OG. */
export function getSiteUrl(): string {
  const raw =
    process.env.PUBLIC_SITE_URL ||
    import.meta.env.PUBLIC_SITE_URL ||
    'https://example.pages.dev';
  return raw.replace(/\/+$/, '');
}

/**
 * Repository GitHub dạng `owner/repo`.
 * Ưu tiên PUBLIC_GITHUB_REPO; nếu chưa set thì suy ra từ `git remote` lúc build
 * (không hardcode username/repo trong source).
 */
export function getGithubRepo(): string {
  const fromEnv = (process.env.PUBLIC_GITHUB_REPO || import.meta.env.PUBLIC_GITHUB_REPO || '').trim();
  if (fromEnv && !fromEnv.includes('your-username')) return fromEnv.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  try {
    const url = execSync('git remote get-url origin', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const m = url.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
    if (m && m[1]) return m[1];
  } catch {
    // Không có git remote — để trống, trang correction sẽ hiển thị hướng dẫn cấu hình.
  }
  return '';
}

/** URL tuyệt đối tới một đường dẫn nội bộ (bắt đầu bằng /). */
export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
