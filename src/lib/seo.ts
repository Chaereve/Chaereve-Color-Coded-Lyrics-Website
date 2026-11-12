/** Helpers SEO: URL tuyệt đối, meta, JSON-LD. */
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from './config';

export function canonicalUrl(pathname: string): string {
  const p = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return absoluteUrl(p);
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: absoluteUrl('/search/?q={search_term_string}') },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export function musicRecordingJsonLd(input: {
  title: string;
  slug: string;
  artistName: string;
  artistSlug: string;
  released?: string;
  cover?: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: input.title,
    url: canonicalUrl(`/lyrics/${input.slug}/`),
    byArtist: {
      '@type': 'MusicGroup',
      name: input.artistName,
      url: canonicalUrl(`/artist/${input.artistSlug}/`),
    },
    ...(input.released ? { datePublished: input.released } : {}),
    ...(input.cover ? { image: absoluteUrl(input.cover) } : {}),
  };
}

export function musicGroupJsonLd(input: {
  name: string;
  slug: string;
  description?: string;
  cover?: string;
  members: { name: string }[];
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: input.name,
    url: canonicalUrl(`/artist/${input.slug}/`),
    ...(input.description ? { description: input.description } : {}),
    ...(input.cover ? { image: absoluteUrl(input.cover) } : {}),
    member: input.members.map((m) => ({ '@type': 'Person', name: m.name })),
  };
}

/** Serialize JSON-LD an toàn khi nhúng vào <script type="application/json">. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
