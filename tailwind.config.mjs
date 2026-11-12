/**
 * Tailwind CSS v4 is configured CSS-first in `src/styles/global.css`.
 * This legacy-format config is loaded from that file via `@config` and is the
 * single place where design tokens are mapped to Tailwind utilities:
 *   bg-page, bg-surface, border-line, text-fg, text-muted, text-accent, ...
 * The actual color values live in CSS custom properties so that dark mode
 * (`[data-theme="dark"]`) flips every token at once.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./src/**/*.{astro,html,ts,md}', './admin/index.html'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        page: 'var(--bg)',
        surface: 'var(--surface)',
        line: 'var(--border)',
        fg: 'var(--text)',
        muted: 'var(--muted)',
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'Noto Sans KR',
          'Noto Sans JP',
          'Noto Sans SC',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '14px',
      },
      maxWidth: {
        site: '72rem',
        prose: '44rem',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
    },
  },
};
