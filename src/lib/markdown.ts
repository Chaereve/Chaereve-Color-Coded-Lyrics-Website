import { marked } from 'marked';

marked.use({
  gfm: true,
  breaks: false,
});

/**
 * Renders trusted markdown (content committed to the repository) to HTML.
 * Content goes through the same review workflow as everything else, so no
 * runtime sanitiser is applied; keep raw HTML out of markdown files anyway.
 */
export function renderMarkdown(src: string): string {
  const html = marked.parse(src, { async: false });
  return typeof html === 'string' ? html : '';
}

/** Very small front matter splitter: returns the YAML block and the body. */
export function splitFrontMatter(src: string): { frontMatter: string; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) return { frontMatter: '', body: src };
  return { frontMatter: m[1] ?? '', body: m[2] ?? '' };
}
