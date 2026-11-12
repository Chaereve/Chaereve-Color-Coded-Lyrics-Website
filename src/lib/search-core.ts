/**
 * Search index types + ranking, shared by the build-time index generator and
 * the client bundle. Keep free of Node/Vite-only imports.
 */
import { tokenize } from './text';

export interface SearchSong {
  id: string;
  title: string;
  nativeTitle?: string;
  artist: string;
  artistId: string;
  album?: string;
  members: string[];
  memberIds: string[];
  language: string;
  year: string;
  categories: string[];
  tags: string[];
  url: string;
  cover?: string;
  date: string;
  /** normalised title + native title + artist + album + member names */
  s: string;
  /** normalised original lyrics */
  ly: string;
  /** normalised romanization */
  ro: string;
  /** normalised translation */
  tr: string;
}

export interface SearchArtist {
  id: string;
  name: string;
  url: string;
  type: string;
  cover?: string;
  s: string;
}

export interface SearchMember {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  url: string;
  color: string;
  s: string;
}

export interface SearchFacet {
  id: string;
  name: string;
}

export interface SearchIndex {
  v: 1;
  generatedAt: string;
  songs: SearchSong[];
  artists: SearchArtist[];
  members: SearchMember[];
  categories: SearchFacet[];
  tags: SearchFacet[];
  languages: SearchFacet[];
  years: string[];
}

export interface SearchFilters {
  artistId?: string;
  language?: string;
  categoryId?: string;
  year?: string;
  memberId?: string;
}

export interface ScoredSong {
  song: SearchSong;
  score: number;
  /** Which field produced the best match (for result snippets). */
  matchedIn: 'title' | 'artist' | 'members' | 'album' | 'lyrics' | 'romanization' | 'translation' | 'filter';
}

function scoreToken(song: SearchSong, token: string): { score: number; field: ScoredSong['matchedIn'] } | null {
  const title = song.s;
  if (title.startsWith(token)) return { score: 12, field: 'title' };
  const nt = song.nativeTitle ? song.nativeTitle.toLowerCase() : '';
  if (nt && nt.includes(token)) return { score: 10, field: 'title' };
  if (title.includes(token)) {
    const artist = song.artist.toLowerCase();
    if (artist.includes(token)) return { score: 7, field: 'artist' };
    if (song.members.some((m) => m.toLowerCase().includes(token))) return { score: 6, field: 'members' };
    if (song.album && song.album.toLowerCase().includes(token)) return { score: 5, field: 'album' };
    return { score: 8, field: 'title' };
  }
  if (song.ly.includes(token)) return { score: 3, field: 'lyrics' };
  if (song.ro.includes(token)) return { score: 3, field: 'romanization' };
  if (song.tr.includes(token)) return { score: 2, field: 'translation' };
  return null;
}

export function matchesFilters(song: SearchSong, f: SearchFilters): boolean {
  if (f.artistId && song.artistId !== f.artistId) return false;
  if (f.language && song.language !== f.language) return false;
  if (f.categoryId && !song.categories.includes(f.categoryId)) return false;
  if (f.year && song.year !== f.year) return false;
  if (f.memberId && !song.memberIds.includes(f.memberId)) return false;
  return true;
}

/** Ranks songs for a free-text query (AND of tokens) plus optional filters. */
export function searchSongs(index: SearchIndex, query: string, filters: SearchFilters = {}, limit = 50): ScoredSong[] {
  const tokens = tokenize(query);
  const out: ScoredSong[] = [];
  for (const song of index.songs) {
    if (!matchesFilters(song, filters)) continue;
    if (tokens.length === 0) {
      out.push({ song, score: 0, matchedIn: 'filter' });
      continue;
    }
    let total = 0;
    let best: { score: number; field: ScoredSong['matchedIn'] } | null = null;
    let ok = true;
    for (const token of tokens) {
      const r = scoreToken(song, token);
      if (!r) {
        ok = false;
        break;
      }
      total += r.score;
      if (!best || r.score > best.score) best = r;
    }
    if (!ok || !best) continue;
    out.push({ song, score: total, matchedIn: best.field });
  }
  out.sort((a, b) => b.score - a.score || b.song.date.localeCompare(a.song.date) || a.song.title.localeCompare(b.song.title));
  return out.slice(0, limit);
}

export function searchArtists(index: SearchIndex, query: string, limit = 5): SearchArtist[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return index.artists
    .map((a) => ({ a, score: tokens.every((t) => a.s.includes(t)) ? (a.s.startsWith(tokens[0] ?? '') ? 2 : 1) : 0 }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.a.name.localeCompare(y.a.name))
    .slice(0, limit)
    .map((x) => x.a);
}

export function searchMembers(index: SearchIndex, query: string, limit = 5): SearchMember[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return index.members
    .map((m) => ({ m, score: tokens.every((t) => m.s.includes(t)) ? (m.s.startsWith(tokens[0] ?? '') ? 2 : 1) : 0 }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.m.name.localeCompare(y.m.name))
    .slice(0, limit)
    .map((x) => x.m);
}
