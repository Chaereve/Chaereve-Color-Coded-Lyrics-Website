export interface Page<T> {
  items: T[];
  /** 1-based page number. */
  page: number;
  totalPages: number;
  totalItems: number;
  perPage: number;
  /** URL of this page. */
  url: string;
  prevUrl?: string;
  nextUrl?: string;
  /** URL of the first page (the archive root). */
  firstUrl: string;
}

/**
 * Splits items into pages using the `/page/N/` convention:
 *   base            -> page 1
 *   base + page/2/  -> page 2 ...
 * `base` must end with a slash.
 */
export function paginateItems<T>(items: T[], perPage: number, base: string): Page<T>[] {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const urlFor = (n: number) => (n <= 1 ? base : `${base}page/${n}/`);
  const pages: Page<T>[] = [];
  for (let n = 1; n <= totalPages; n += 1) {
    pages.push({
      items: items.slice((n - 1) * perPage, n * perPage),
      page: n,
      totalPages,
      totalItems: items.length,
      perPage,
      url: urlFor(n),
      prevUrl: n > 1 ? urlFor(n - 1) : undefined,
      nextUrl: n < totalPages ? urlFor(n + 1) : undefined,
      firstUrl: base,
    });
  }
  return pages;
}

/** Rest-param value for Astro routes of the form `[slug]/[...page]`. */
export function pageParam(page: number): string | undefined {
  return page <= 1 ? undefined : `page/${page}`;
}
