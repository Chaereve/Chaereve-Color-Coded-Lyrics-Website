/**
 * Small, dependency-free text helpers shared by build-time code and the
 * client-side search bundle (keep this file free of Node/Vite-only APIs).
 */

const VI_D_RE = /đ/g;
const VI_D_UPPER_RE = /Đ/g;
const COMBINING_RE = /[\u0300-\u036f]/g;
const WS_RE = /\s+/g;

/**
 * Accent-insensitive, case-insensitive normalisation:
 *   "Tiếng Việt  có dấu" -> "tieng viet co dau"
 * Korean / Japanese / Chinese characters are left untouched.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_RE, '')
    .replace(VI_D_RE, 'd')
    .replace(VI_D_UPPER_RE, 'D')
    .toLowerCase()
    .replace(WS_RE, ' ')
    .trim();
}

/** Tokenise a normalised query into unique non-empty tokens. */
export function tokenize(input: string): string[] {
  return Array.from(new Set(normalizeText(input).split(' ').filter(Boolean)));
}

export function slugify(input: string): string {
  return normalizeText(input)
    .replace(/[^a-z0-9\u3131-\uD79D\u3040-\u30ff\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(input: string, max = 160): string {
  const s = input.replace(WS_RE, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format "2026-11-07" as "Nov 7, 2026" without relying on Intl data at build time. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return 'Unknown';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const year = m[1];
  const month = Number(m[2]);
  const day = Number(m[3]);
  const monthName = MONTHS[month - 1];
  if (!monthName) return iso;
  return `${monthName} ${day}, ${year}`;
}

export function yearOf(iso: string | undefined): string {
  const m = /^(\d{4})/.exec(iso ?? '');
  return m?.[1] ?? '';
}

const LANGUAGE_NAMES: Record<string, string> = {
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
  en: 'English',
  vi: 'Vietnamese',
  es: 'Spanish',
  id: 'Indonesian',
  th: 'Thai',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  ru: 'Russian',
  tl: 'Filipino',
  other: 'Other',
};

export function languageName(code: string | undefined): string {
  if (!code) return 'Unknown';
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

/** Short uppercase badge label for a language code. */
export function languageBadge(code: string | undefined): string {
  if (!code || code === 'other') return 'OTHER';
  return code.toUpperCase();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Strip the `|` separators used for multi-member lines from a text. */
export function stripPartSeparators(text: string): string {
  return text.replace(/\s*\|\s*/g, ' ').replace(WS_RE, ' ').trim();
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Sanitise an id for use inside a CSS custom property name. */
export function cssIdent(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}
