/**
 * Validates every content file (JSON + Markdown pages) the same way the build
 * does: strict referential integrity, warnings for unknown memberIds,
 * duplicate IDs, invalid slugs, missing credits…
 *
 * Usage: npm run validate
 * Exits non-zero only on hard errors (the build itself always warns and
 * continues, but a broken repo should fail CI).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IssueCollector,
  crossValidate,
  formatIssue,
  isRecord,
  parseArtist,
  parseAuthor,
  parseCategory,
  parseComment,
  parseCorrection,
  parseSettings,
  parseSong,
  parseTag,
  parseTranslation,
} from '../src/lib/validate';
import type { Artist, Author, Category, Comment, Correction, Song, Tag, Translation } from '../src/lib/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const c = new IssueCollector();

function loadJsonDir<T>(rel: string, parser: (raw: unknown, file: string, col: IssueCollector, stem: string) => T | null): Map<T, string> {
  const dir = join(root, 'content', rel);
  const out = new Map<T, string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const label = `${rel}/${file}`;
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
    } catch (err) {
      c.error(label, `Invalid JSON — ${(err as Error).message}`);
      continue;
    }
    if (!isRecord(data)) {
      c.error(label, 'File must contain a JSON object.');
      continue;
    }
    const parsed = parser(data, label, c, file.replace(/\.json$/, ''));
    if (parsed) out.set(parsed, label);
  }
  return out;
}

const artists = loadJsonDir<Artist>('artists', parseArtist);
const songs = loadJsonDir<Song>('songs', parseSong);
const categories = loadJsonDir<Category>('categories', parseCategory);
const tags = loadJsonDir<Tag>('tags', parseTag);
const authors = loadJsonDir<Author>('authors', parseAuthor);
const translations = loadJsonDir<Translation>('translations', parseTranslation);
const corrections = loadJsonDir<Correction>('corrections', parseCorrection);
const comments = loadJsonDir<Comment>('comments', parseComment);

let settingsRaw: unknown;
try {
  settingsRaw = JSON.parse(readFileSync(join(root, 'content', 'settings', 'site.json'), 'utf-8'));
} catch (err) {
  c.error('settings/site.json', `Missing or invalid — ${(err as Error).message}`);
}
const settings = parseSettings(settingsRaw, 'settings/site.json', c);

const bundle = crossValidate(
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

// Song quality checks that are not needed at build time.
for (const song of bundle.songs) {
  const label = `songs/${song.id}`;
  if (song.status === 'published' && song.sections.length === 0) {
    c.warn(label, 'Published song has no sections.');
  }
  if (song.status === 'published' && song.members.length < 1) {
    c.warn(label, 'Published song has no members — every line renders as "All".');
  }
  const lineCount = song.sections.reduce((acc, s) => acc + s.lines.length, 0);
  if (song.status === 'published' && lineCount < 10) {
    c.hint(label, `Published song has only ${lineCount} lines.`);
  }
}

let exitCode = 0;
for (const issue of c.issues) {
  if (issue.level === 'error') exitCode = 1;
  console.log(formatIssue(issue));
}
console.log(
  `\nValidation finished: ${c.errors.length} error(s), ${c.warnings.length} warning(s), ${c.hints.length} hint(s) — ` +
    `${bundle.artists.length} artists, ${bundle.songs.length} songs, ${bundle.categories.length} categories, ` +
    `${bundle.tags.length} tags, ${bundle.authors.length} authors, ${bundle.translations.length} translations, ` +
    `${bundle.corrections.length} corrections, ${bundle.comments.length} comments.`,
);
process.exit(exitCode);
