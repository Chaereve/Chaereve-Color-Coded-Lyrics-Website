import { artistUrl, getArtist, getSite, songUrl } from './content';
import { languageName, normalizeText, stripPartSeparators, yearOf } from './text';
import type { SearchIndex, SearchSong } from './search-core';

function joinNormalized(parts: Array<string | undefined>): string {
  return normalizeText(parts.filter((p): p is string => Boolean(p && p.trim())).join(' '));
}

/** Builds the client-side search index from the published content. */
export function buildSearchIndex(): SearchIndex {
  const site = getSite();
  const songs: SearchSong[] = [];
  const languages = new Map<string, string>();

  for (const song of site.songs) {
    const artist = getArtist(song.artistId);
    if (!artist) continue;
    const memberNames = song.members.map((m) => m.name);
    const lines = song.sections.flatMap((s) => s.lines);
    languages.set(song.language, languageName(song.language));
    songs.push({
      id: song.id,
      title: song.title,
      nativeTitle: song.nativeTitle,
      artist: artist.name,
      artistId: artist.id,
      album: song.album,
      members: memberNames,
      memberIds: song.members.map((m) => m.id),
      language: song.language,
      year: yearOf(song.released),
      categories: song.categories,
      tags: song.tags,
      url: songUrl(song, artist),
      cover: song.cover,
      date: song.createdAt || song.released,
      s: joinNormalized([song.title, song.nativeTitle, artist.name, artist.nativeName, artist.romanized, song.album, ...memberNames, song.slug]),
      ly: joinNormalized(lines.map((l) => stripPartSeparators(l.text))),
      ro: joinNormalized(lines.map((l) => (l.romanization ? stripPartSeparators(l.romanization) : undefined))),
      tr: joinNormalized(lines.map((l) => (l.translation ? stripPartSeparators(l.translation) : undefined))),
    });
  }

  return {
    v: 1,
    generatedAt: new Date().toISOString(),
    songs,
    artists: site.artists.map((a) => ({
      id: a.id,
      name: a.name,
      url: artistUrl(a),
      type: a.type,
      cover: a.cover || undefined,
      s: joinNormalized([a.name, a.nativeName, a.romanized, a.slug]),
    })),
    members: site.members.map((m) => ({
      id: m.member.id,
      name: m.member.name,
      artist: m.artist.name,
      artistId: m.artist.id,
      url: m.url,
      color: m.member.color,
      s: joinNormalized([m.member.name, m.member.nativeName, m.member.romanized, m.artist.name]),
    })),
    categories: site.categories.map((c) => ({ id: c.id, name: c.name })),
    tags: site.tags.map((t) => ({ id: t.id, name: t.name })),
    languages: Array.from(languages.entries()).map(([id, name]) => ({ id, name })),
    years: Array.from(new Set(songs.map((s) => s.year).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
  };
}
