/**
 * Build-time content loader.
 *
 * All content lives as JSON/Markdown files in `content/` (outside `src/`) so
 * Decap CMS can edit it. Files are imported as raw strings through Vite so
 * that (a) invalid JSON produces a warning instead of a crash and (b) the dev
 * server hot-reloads when a file changes.
 */
import { parse as parseYaml } from 'yaml';
import { SHOW_DRAFTS } from './env';
import { computeDistribution } from './distribution';
import { renderMarkdown, splitFrontMatter } from './markdown';
import type { Artist, ArtistMember, Author, Category, Comment, Correction, PageDoc, SiteSettings, Song, Tag, Translation } from './types';
import {
  IssueCollector,
  crossValidate,
  formatIssue,
  isRecord,
  normalizeDate,
  parseArtist,
  parseAuthor,
  parseCategory,
  parseComment,
  parseCorrection,
  parseSettings,
  parseSong,
  parseTag,
  parseTranslation,
  type ContentBundle,
  type Issue,
} from './validate';

type RawFiles = Record<string, string>;

const rawArtists = import.meta.glob('/content/artists/*.json', { eager: true, query: '?raw', import: 'default' }) as RawFiles;
const rawSongs = import.meta.glob('/content/songs/*.json', { eager: true, query: '?raw', import: 'default' }) as RawFiles;
const rawCategories = import.meta.glob('/content/categories/*.json', { eager: true, query: '?raw', import: 'default' }) as RawFiles;
const rawTags = import.meta.glob('/content/tags/*.json', { eager: true, query: '?raw', import: 'default' }) as RawFiles;
const rawAuthors = import.meta.glob('/content/authors/*.json', { eager: true, query: '?raw', import: 'default' }) as RawFiles;
const rawTranslations = import.meta.glob('/content/translations/*.json', { eager: true, query: '?raw', import: 'default' }) as RawFiles;
const rawCorrections = import.meta.glob('/content/corrections/*.json', { eager: true, query: '?raw', import: 'default' }) as RawFiles;
const rawComments = import.meta.glob('/content/comments/*.json', { eager: true, query: '?raw', import: 'default' }) as RawFiles;
const rawPages = import.meta.glob('/content/pages/*.md', { eager: true, query: '?raw', import: 'default' }) as RawFiles;
const rawSettings = import.meta.glob('/content/settings/site.json', { eager: true, query: '?raw', import: 'default' }) as RawFiles;

export interface MemberProfile {
  member: ArtistMember;
  artist: Artist;
  slug: string;
  url: string;
}

export interface SiteData {
  settings: SiteSettings;
  artists: Artist[];
  /** Songs visible on the site (published, plus drafts when SHOW_DRAFTS). */
  songs: Song[];
  categories: Category[];
  tags: Tag[];
  authors: Author[];
  translations: Translation[];
  corrections: Correction[];
  comments: Comment[];
  pages: PageDoc[];
  members: MemberProfile[];
  issues: Issue[];
}

function fileLabel(path: string): string {
  return path.replace(/^\/content\//, '');
}

function fileStem(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.(json|md)$/, '');
}

function parseJsonFiles<T>(files: RawFiles, c: IssueCollector, parser: (raw: unknown, file: string, c: IssueCollector, stem: string) => T | null): Map<T, string> {
  const out = new Map<T, string>();
  for (const path of Object.keys(files).sort()) {
    const label = fileLabel(path);
    let data: unknown;
    try {
      data = JSON.parse(files[path] ?? '');
    } catch (err) {
      c.error(label, `Invalid JSON — ${(err as Error).message}`);
      continue;
    }
    const parsed = parser(data, label, c, fileStem(path));
    if (parsed) out.set(parsed, label);
  }
  return out;
}

function parsePages(files: RawFiles, c: IssueCollector): PageDoc[] {
  const pages: PageDoc[] = [];
  for (const path of Object.keys(files).sort()) {
    const label = fileLabel(path);
    const { frontMatter, body } = splitFrontMatter(files[path] ?? '');
    let meta: Record<string, unknown> = {};
    try {
      const parsed: unknown = frontMatter ? parseYaml(frontMatter) : {};
      if (isRecord(parsed)) meta = parsed;
    } catch (err) {
      c.error(label, `Invalid front matter — ${(err as Error).message}`);
    }
    const slug = typeof meta.slug === 'string' && meta.slug.trim() ? meta.slug.trim() : fileStem(path);
    const title = typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : slug;
    if (!meta.title) c.warn(label, 'Missing "title" in front matter.');
    pages.push({
      slug,
      title,
      description: typeof meta.description === 'string' ? meta.description.trim() : undefined,
      updated: normalizeDate(meta.updated) || undefined,
      html: renderMarkdown(body),
      inFooter: meta.inFooter === true,
      order: typeof meta.order === 'number' ? meta.order : 100,
    });
  }
  return pages.sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title));
}

function songDate(song: Song): string {
  return song.createdAt || song.released || '';
}

export function sortSongsNewestFirst(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => songDate(b).localeCompare(songDate(a)) || a.title.localeCompare(b.title));
}

let cache: SiteData | undefined;
let reported = false;

function load(): SiteData {
  const c = new IssueCollector();

  const artists = parseJsonFiles(rawArtists, c, parseArtist);
  const songs = parseJsonFiles(rawSongs, c, parseSong);
  const categories = parseJsonFiles(rawCategories, c, parseCategory);
  const tags = parseJsonFiles(rawTags, c, parseTag);
  const authors = parseJsonFiles(rawAuthors, c, parseAuthor);
  const translations = parseJsonFiles(rawTranslations, c, parseTranslation);
  const corrections = parseJsonFiles(rawCorrections, c, parseCorrection);
  const comments = parseJsonFiles(rawComments, c, parseComment);

  let settingsRaw: unknown;
  const settingsPath = Object.keys(rawSettings)[0];
  try {
    settingsRaw = settingsPath ? JSON.parse(rawSettings[settingsPath] ?? '') : undefined;
  } catch (err) {
    c.error('settings/site.json', `Invalid JSON — ${(err as Error).message}`);
  }
  const settings = parseSettings(settingsRaw, 'settings/site.json', c);

  const bundle: ContentBundle = crossValidate(
    {
      artists: Array.from(artists.keys()),
      songs: Array.from(songs.keys()),
      categories: Array.from(categories.keys()),
      tags: Array.from(tags.keys()),
      authors: Array.from(authors.keys()),
      translations: Array.from(translations.keys()),
      corrections: Array.from(corrections.keys()),
      comments: Array.from(comments.keys()),
      settings,
    },
    { artists, songs },
    c,
  );

  const pages = parsePages(rawPages, c);

  const visibleSongs = sortSongsNewestFirst(bundle.songs.filter((s) => s.status === 'published' || SHOW_DRAFTS));

  const members: MemberProfile[] = [];
  for (const artist of bundle.artists) {
    for (const member of artist.members) {
      const slug = member.slug ?? member.id;
      members.push({ member, artist, slug, url: `/member/${slug}/` });
    }
  }
  members.sort((a, b) => a.member.name.localeCompare(b.member.name));

  if (!reported) {
    reported = true;
    for (const issue of c.issues) {
      if (issue.level === 'hint') continue;
      console.warn(formatIssue(issue));
    }
    if (c.hints.length > 0) {
      console.info(`[content] ${c.hints.length} hint(s) — run \`npm run validate\` for details.`);
    }
  }

  return {
    settings: bundle.settings,
    artists: [...bundle.artists].sort((a, b) => a.name.localeCompare(b.name)),
    songs: visibleSongs,
    categories: [...bundle.categories].sort((a, b) => a.name.localeCompare(b.name)),
    tags: [...bundle.tags].sort((a, b) => a.name.localeCompare(b.name)),
    authors: [...bundle.authors].sort((a, b) => a.name.localeCompare(b.name)),
    translations: bundle.translations.sort((a, b) => (b.reviewedAt ?? b.submittedAt).localeCompare(a.reviewedAt ?? a.submittedAt)),
    corrections: bundle.corrections.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    comments: bundle.comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    pages,
    members,
    issues: c.issues,
  };
}

export function getSite(): SiteData {
  if (!cache) cache = load();
  return cache;
}

/* ------------------------------------------------------------------ */
/* URL helpers                                                         */
/* ------------------------------------------------------------------ */

export function artistUrl(artist: Artist): string {
  return `/artist/${artist.slug}/`;
}

export function songUrl(song: Song, artist?: Artist): string {
  const a = artist ?? getArtist(song.artistId);
  return `/lyrics/${a?.slug ?? song.artistId}/${song.slug}/`;
}

export function categoryUrl(category: Category): string {
  return `/category/${category.slug}/`;
}

export function tagUrl(tag: Tag): string {
  return `/tag/${tag.slug}/`;
}

export function authorUrl(author: Author): string {
  return `/author/${author.slug}/`;
}

export function pageUrl(page: PageDoc): string {
  return `/pages/${page.slug}/`;
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function getArtist(id: string): Artist | undefined {
  return getSite().artists.find((a) => a.id === id);
}

export function getArtistBySlug(slug: string): Artist | undefined {
  return getSite().artists.find((a) => a.slug === slug);
}

export function getSongById(id: string): Song | undefined {
  return getSite().songs.find((s) => s.id === id);
}

export function getCategory(id: string): Category | undefined {
  return getSite().categories.find((x) => x.id === id);
}

export function getTag(id: string): Tag | undefined {
  return getSite().tags.find((x) => x.id === id);
}

export function getAuthor(id: string): Author | undefined {
  return getSite().authors.find((x) => x.id === id);
}

export function getMember(id: string): MemberProfile | undefined {
  return getSite().members.find((m) => m.member.id === id);
}

export function getMemberBySlug(slug: string): MemberProfile | undefined {
  return getSite().members.find((m) => m.slug === slug);
}

export function getPage(slug: string): PageDoc | undefined {
  return getSite().pages.find((p) => p.slug === slug);
}

export function getSongsByArtist(artistId: string): Song[] {
  return getSite().songs.filter((s) => s.artistId === artistId);
}

export function getSongsByCategory(categoryId: string): Song[] {
  return getSite().songs.filter((s) => s.categories.includes(categoryId));
}

export function getSongsByTag(tagId: string): Song[] {
  return getSite().songs.filter((s) => s.tags.includes(tagId));
}

export function getSongsByAuthor(authorId: string): Song[] {
  return getSite().songs.filter((s) => s.authorId === authorId);
}

export function getApprovedTranslations(songId?: string): Translation[] {
  return getSite().translations.filter((t) => t.status === 'approved' && (!songId || t.songId === songId));
}

export function getApprovedComments(songId: string): Comment[] {
  return getSite().comments.filter((cm) => cm.status === 'approved' && cm.songId === songId);
}

export function getCorrectionsForSong(songId: string): Correction[] {
  return getSite().corrections.filter((cr) => cr.songId === songId);
}

/* ------------------------------------------------------------------ */
/* Home page selections                                                */
/* ------------------------------------------------------------------ */

export function getLatestSongs(limit: number): Song[] {
  return getSite().songs.slice(0, limit);
}

export function getFeaturedSongs(limit: number): Song[] {
  return getSite().songs.filter((s) => s.featured).slice(0, limit);
}

export function getTrendingSongs(limit: number): Song[] {
  const { settings, songs } = getSite();
  const curated = settings.trendingSongIds.map((id) => songs.find((s) => s.id === id)).filter((s): s is Song => Boolean(s));
  const rest = songs.filter((s) => !curated.includes(s));
  return [...curated, ...rest].slice(0, limit);
}

export function getPopularArtists(limit: number): Artist[] {
  const { settings, artists, songs } = getSite();
  const curated = settings.popularArtistIds.map((id) => artists.find((a) => a.id === id)).filter((a): a is Artist => Boolean(a));
  const bySongs = [...artists]
    .filter((a) => !curated.includes(a))
    .sort((a, b) => songs.filter((s) => s.artistId === b.id).length - songs.filter((s) => s.artistId === a.id).length || a.name.localeCompare(b.name));
  return [...curated, ...bySongs].slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Song relations                                                      */
/* ------------------------------------------------------------------ */

export function getRelatedSongs(song: Song, limit = 6): Song[] {
  const { songs } = getSite();
  const scored = songs
    .filter((s) => s.id !== song.id)
    .map((s) => {
      let score = 0;
      if (s.artistId === song.artistId) score += 4;
      score += s.tags.filter((t) => song.tags.includes(t)).length * 2;
      score += s.categories.filter((c) => song.categories.includes(c)).length;
      if (s.language === song.language) score += 1;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || songDate(b.s).localeCompare(songDate(a.s)));
  return scored.slice(0, limit).map((x) => x.s);
}

/** Newer / older song in the site-wide chronological order. */
export function getAdjacentSongs(song: Song): { newer?: Song; older?: Song } {
  const { songs } = getSite();
  const index = songs.findIndex((s) => s.id === song.id);
  if (index < 0) return {};
  return { newer: songs[index - 1], older: songs[index + 1] };
}

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

export interface MemberSongStat {
  song: Song;
  artist: Artist;
  lines: number;
  percent: number;
  countedLines: number;
}

/** Songs a member participates in (main version), with line counts. */
export function getMemberSongStats(memberId: string): MemberSongStat[] {
  const out: MemberSongStat[] = [];
  for (const song of getSite().songs) {
    if (!song.members.some((m) => m.id === memberId)) continue;
    const artist = getArtist(song.artistId);
    if (!artist) continue;
    const dist = computeDistribution(song.members, song.sections);
    const row = dist.rows.find((r) => r.memberId === memberId);
    out.push({ song, artist, lines: row?.lines ?? 0, percent: row?.percent ?? 0, countedLines: dist.countedLines });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function getSongYears(): string[] {
  const years = new Set<string>();
  for (const s of getSite().songs) {
    const y = s.released.slice(0, 4);
    if (y) years.add(y);
  }
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

export function artistsByLetter(): { letter: string; artists: Artist[] }[] {
  const groups = new Map<string, Artist[]>();
  for (const artist of getSite().artists) {
    const first = artist.name.trim().charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : /[0-9]/.test(first) ? '0-9' : '#';
    const list = groups.get(letter) ?? [];
    list.push(artist);
    groups.set(letter, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, artists]) => ({ letter, artists }));
}
