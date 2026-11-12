import type { Artist, ArtistMember, Song } from './types';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function absoluteUrl(path: string, site: URL | undefined): string {
  if (!site) return path;
  return new URL(path, site).toString();
}

export function breadcrumbJsonLd(items: BreadcrumbItem[], site: URL | undefined): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.url, site),
    })),
  };
}

export function websiteJsonLd(name: string, description: string, site: URL | undefined): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    description,
    url: absoluteUrl('/', site),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl('/search/', site)}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function musicGroupJsonLd(artist: Artist, url: string, site: URL | undefined): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.name,
    alternateName: [artist.nativeName, artist.romanized].filter(Boolean),
    description: artist.description,
    url: absoluteUrl(url, site),
    image: artist.cover ? absoluteUrl(artist.cover, site) : undefined,
    sameAs: artist.socials?.map((s) => s.url),
  };
  if (artist.type === 'group') {
    data.member = artist.members.map((m) => ({ '@type': 'Person', name: m.name, alternateName: m.nativeName }));
  }
  return data;
}

export function personJsonLd(member: ArtistMember, artist: Artist, url: string, site: URL | undefined): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: member.name,
    alternateName: [member.nativeName, member.romanized].filter(Boolean),
    description: member.bio,
    jobTitle: member.role,
    url: absoluteUrl(url, site),
    memberOf: { '@type': 'MusicGroup', name: artist.name, url: absoluteUrl(`/artist/${artist.slug}/`, site) },
    sameAs: member.socials?.map((s) => s.url),
  };
}

export function musicRecordingJsonLd(song: Song, artist: Artist, url: string, site: URL | undefined): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: song.title,
    alternateName: song.nativeTitle,
    byArtist: { '@type': 'MusicGroup', name: artist.name, url: absoluteUrl(`/artist/${artist.slug}/`, site) },
    datePublished: song.released || undefined,
    inLanguage: song.language === 'other' ? undefined : song.language,
    url: absoluteUrl(url, site),
    image: song.cover ? absoluteUrl(song.cover, site) : undefined,
    sameAs: song.youtube,
  };
  if (song.album) data.inAlbum = { '@type': 'MusicAlbum', name: song.album };
  if (song.credits.lyrics.length) data.lyricist = song.credits.lyrics.map((n) => ({ '@type': 'Person', name: n }));
  if (song.credits.composition.length) data.composer = song.credits.composition.map((n) => ({ '@type': 'Person', name: n }));
  return data;
}

/** Remove undefined / empty values so the emitted JSON-LD stays clean. */
export function compactJsonLd(value: unknown): unknown {
  if (Array.isArray(value)) {
    const arr = value.map(compactJsonLd).filter((v) => v !== undefined && v !== null && v !== '');
    return arr.length ? arr : undefined;
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cv = compactJsonLd(v);
      if (cv !== undefined && cv !== null && cv !== '') out[k] = cv;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}
