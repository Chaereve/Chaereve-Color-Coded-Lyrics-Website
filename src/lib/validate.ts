/**
 * Pure (Node/Vite-agnostic) validation + normalisation of the JSON content.
 *
 * Design goals:
 *  - Never throw for bad data: coerce to safe defaults and report an Issue.
 *  - Referential integrity is checked in `crossValidate` so the build can warn
 *    about unknown memberIds, artistIds, categories, tags and authors.
 *  - Used by both the Astro content loader (src/lib/content.ts) and the CLI
 *    script (scripts/validate-content.ts).
 */
import {
  AUDIO_TYPES,
  AUTHOR_ROLES,
  COMMENT_STATUSES,
  CORRECTION_STATUSES,
  CORRECTION_TYPES,
  LANGUAGES,
  LINE_TYPES,
  REVIEW_STATUSES,
  SONG_STATUSES,
  type Artist,
  type ArtistMember,
  type Author,
  type Category,
  type Comment,
  type Correction,
  type Credits,
  type LyricLine,
  type LyricSection,
  type SiteSettings,
  type SocialLink,
  type Song,
  type SongMember,
  type SongVersion,
  type Tag,
  type Translation,
} from './types';

export type IssueLevel = 'error' | 'warn' | 'hint';

export interface Issue {
  level: IssueLevel;
  file: string;
  message: string;
}

export class IssueCollector {
  readonly issues: Issue[] = [];

  error(file: string, message: string): void {
    this.issues.push({ level: 'error', file, message });
  }
  warn(file: string, message: string): void {
    this.issues.push({ level: 'warn', file, message });
  }
  hint(file: string, message: string): void {
    this.issues.push({ level: 'hint', file, message });
  }
  get errors(): Issue[] {
    return this.issues.filter((i) => i.level === 'error');
  }
  get warnings(): Issue[] {
    return this.issues.filter((i) => i.level === 'warn');
  }
  get hints(): Issue[] {
    return this.issues.filter((i) => i.level === 'hint');
  }
}

/* ------------------------------------------------------------------ */
/* Primitive helpers                                                   */
/* ------------------------------------------------------------------ */

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function strOr(v: unknown, fallback: string): string {
  return str(v) ?? fallback;
}

function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter((s): s is string => typeof s === 'string' && s.trim() !== '');
  if (typeof v === 'string' && v.trim() !== '') return [v.trim()];
  return [];
}

function bool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

function enumValue<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Normalise "2026-11-07T00:00:00.000Z" or "2026-11-07" to "2026-11-07". */
export function normalizeDate(v: unknown): string {
  const s = str(v);
  if (!s) return '';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s.trim());
  if (m?.[1]) return m[1];
  const t = Date.parse(s);
  return Number.isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10);
}

export function normalizeHex(v: unknown): string | undefined {
  const s = str(v)?.trim();
  if (!s || !HEX_RE.test(s)) return undefined;
  if (s.length === 4) {
    const [, r, g, b] = s;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return s.toLowerCase();
}

export function isValidId(id: string): boolean {
  return ID_RE.test(id);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

function socials(v: unknown, file: string, c: IssueCollector, path: string): SocialLink[] {
  if (!Array.isArray(v)) return [];
  const out: SocialLink[] = [];
  v.forEach((item, i) => {
    if (!isRecord(item)) return;
    const label = str(item.label)?.trim();
    const url = str(item.url)?.trim();
    if (!label || !url) {
      c.warn(file, `${path}[${i}] needs both "label" and "url" — skipped.`);
      return;
    }
    out.push({ label, url });
  });
  return out;
}

function requireId(raw: Record<string, unknown>, file: string, c: IssueCollector, fallback?: string): string | null {
  const id = str(raw.id)?.trim();
  if (!id) {
    if (fallback) {
      c.warn(file, `Missing "id" — using "${fallback}" derived from the file name.`);
      return fallback;
    }
    c.error(file, 'Missing "id".');
    return null;
  }
  if (!isValidId(id)) {
    c.error(file, `Invalid id "${id}". Use lowercase letters, digits, "-" or "_" (no spaces, no accents).`);
    return null;
  }
  return id;
}

function requireSlug(raw: Record<string, unknown>, file: string, c: IssueCollector, fallback: string): string {
  const slug = str(raw.slug)?.trim();
  if (!slug) {
    c.warn(file, `Missing "slug" — using "${fallback}".`);
    return fallback;
  }
  if (!isValidSlug(slug)) {
    c.warn(file, `Slug "${slug}" is not URL-safe (expected lowercase a-z, 0-9 and single hyphens).`);
  }
  return slug;
}

/* ------------------------------------------------------------------ */
/* Artists                                                             */
/* ------------------------------------------------------------------ */

function parseArtistMember(raw: unknown, file: string, c: IssueCollector, index: number): ArtistMember | null {
  if (!isRecord(raw)) {
    c.warn(file, `members[${index}] is not an object — skipped.`);
    return null;
  }
  const id = str(raw.id)?.trim();
  if (!id || !isValidId(id)) {
    c.warn(file, `members[${index}] has a missing/invalid id ("${id ?? ''}") — skipped.`);
    return null;
  }
  const name = str(raw.name)?.trim() || id;
  const color = normalizeHex(raw.color);
  if (!color) {
    c.warn(file, `members[${index}] ("${name}") has no valid hex color — falling back to #6b7280.`);
  }
  const officialColor = normalizeHex(raw.officialColor);
  const slug = str(raw.slug)?.trim();
  if (slug && !isValidSlug(slug)) c.warn(file, `members[${index}] slug "${slug}" is not URL-safe.`);
  return {
    id,
    name,
    nativeName: str(raw.nativeName)?.trim() || undefined,
    romanized: str(raw.romanized)?.trim() || undefined,
    slug: slug || undefined,
    color: color ?? '#6b7280',
    officialColor,
    colorSource: str(raw.colorSource)?.trim() || undefined,
    role: str(raw.role)?.trim() || undefined,
    bio: str(raw.bio)?.trim() || undefined,
    socials: socials(raw.socials, file, c, `members[${index}].socials`),
  };
}

export function parseArtist(raw: unknown, file: string, c: IssueCollector, fileStem: string): Artist | null {
  if (!isRecord(raw)) {
    c.error(file, 'Artist file must contain a JSON object.');
    return null;
  }
  const id = requireId(raw, file, c, fileStem);
  if (!id) return null;
  const name = str(raw.name)?.trim();
  if (!name) c.warn(file, 'Missing "name" — using the id.');
  const members: ArtistMember[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.members)) {
    raw.members.forEach((m, i) => {
      const parsed = parseArtistMember(m, file, c, i);
      if (!parsed) return;
      if (seen.has(parsed.id)) {
        c.warn(file, `Duplicate member id "${parsed.id}" — only the first one is kept.`);
        return;
      }
      seen.add(parsed.id);
      members.push(parsed);
    });
  }
  const type = enumValue(raw.type, ['solo', 'group'] as const, members.length > 1 ? 'group' : 'solo');
  if (raw.type !== undefined && raw.type !== type) c.warn(file, `Unknown artist type "${String(raw.type)}" — using "${type}".`);
  const slug = requireSlug(raw, file, c, id);
  if (slug !== id) c.hint(file, `Artist id ("${id}") and slug ("${slug}") differ. Keeping them identical makes CMS preview links work.`);
  const cover = str(raw.cover)?.trim();
  if (!cover) c.warn(file, 'Missing "cover" image — a placeholder will be shown.');
  return {
    id,
    name: name || id,
    nativeName: str(raw.nativeName)?.trim() || undefined,
    romanized: str(raw.romanized)?.trim() || undefined,
    slug,
    type,
    description: strOr(raw.description, '').trim(),
    cover: cover || '',
    debut: normalizeDate(raw.debut) || undefined,
    label: str(raw.label)?.trim() || undefined,
    socials: socials(raw.socials, file, c, 'socials'),
    members,
    relatedArtistIds: strArray(raw.relatedArtistIds),
  };
}

/* ------------------------------------------------------------------ */
/* Songs                                                               */
/* ------------------------------------------------------------------ */

function parseSongMembers(raw: unknown, file: string, c: IssueCollector, path: string): SongMember[] {
  const out: SongMember[] = [];
  if (!Array.isArray(raw)) return out;
  const seen = new Set<string>();
  raw.forEach((m, i) => {
    if (!isRecord(m)) {
      c.warn(file, `${path}[${i}] is not an object — skipped.`);
      return;
    }
    const id = str(m.id)?.trim();
    if (!id || !isValidId(id)) {
      c.warn(file, `${path}[${i}] has a missing/invalid id — skipped.`);
      return;
    }
    if (seen.has(id)) {
      c.warn(file, `${path}: duplicate member id "${id}" — only the first one is kept.`);
      return;
    }
    seen.add(id);
    const color = normalizeHex(m.color);
    if (!color) c.warn(file, `${path}[${i}] ("${id}") has no valid hex color — falling back to #6b7280.`);
    out.push({ id, name: str(m.name)?.trim() || id, color: color ?? '#6b7280' });
  });
  return out;
}

function parseLine(raw: unknown, file: string, c: IssueCollector, path: string, index: number): LyricLine | null {
  if (!isRecord(raw)) {
    c.warn(file, `${path}.lines[${index}] is not an object — skipped.`);
    return null;
  }
  let memberIds: string[];
  if (Array.isArray(raw.memberIds)) {
    memberIds = raw.memberIds.map(str).filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim());
  } else if (typeof raw.memberIds === 'string') {
    c.warn(file, `${path}.lines[${index}].memberIds should be an array of strings — splitting "${raw.memberIds}" by comma.`);
    memberIds = raw.memberIds.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    if (raw.memberIds !== undefined && raw.memberIds !== null) {
      c.warn(file, `${path}.lines[${index}].memberIds must be an array — treated as "All".`);
    }
    memberIds = [];
  }
  const type = enumValue(raw.type, LINE_TYPES, 'lyric');
  if (raw.type !== undefined && raw.type !== type) {
    c.warn(file, `${path}.lines[${index}] has unknown type "${String(raw.type)}" — using "lyric".`);
  }
  const id = str(raw.id)?.trim();
  return {
    id: id || undefined,
    memberIds: Array.from(new Set(memberIds)),
    text: strOr(raw.text, ''),
    romanization: str(raw.romanization) || undefined,
    translation: str(raw.translation) || undefined,
    type,
    note: str(raw.note)?.trim() || undefined,
  };
}

function parseSections(raw: unknown, file: string, c: IssueCollector, path: string): LyricSection[] {
  const out: LyricSection[] = [];
  if (!Array.isArray(raw)) {
    if (raw !== undefined) c.warn(file, `${path} must be an array of sections.`);
    return out;
  }
  raw.forEach((s, i) => {
    if (!isRecord(s)) {
      c.warn(file, `${path}[${i}] is not an object — skipped.`);
      return;
    }
    const label = str(s.label)?.trim() || `Section ${i + 1}`;
    const sectionPath = `${path}[${i}] (${label})`;
    const lines: LyricLine[] = [];
    if (Array.isArray(s.lines)) {
      s.lines.forEach((l, li) => {
        const parsed = parseLine(l, file, c, sectionPath, li);
        if (parsed) lines.push(parsed);
      });
    } else {
      c.warn(file, `${sectionPath} has no "lines" array.`);
    }
    out.push({ id: str(s.id)?.trim() || undefined, label, lines });
  });
  return out;
}

function parseCredits(raw: unknown): Credits {
  const r = isRecord(raw) ? raw : {};
  return {
    lyrics: strArray(r.lyrics),
    composition: strArray(r.composition),
    arrangement: strArray(r.arrangement),
    translation: strArray(r.translation),
    romanization: strArray(r.romanization),
    colorCoding: strArray(r.colorCoding),
    source: strOr(r.source, '').trim(),
  };
}

function checkMemberIds(sections: LyricSection[], members: SongMember[], file: string, c: IssueCollector, scope: string): void {
  const known = new Set(members.map((m) => m.id));
  let counter = 0;
  for (const section of sections) {
    for (const line of section.lines) {
      counter += 1;
      for (const id of line.memberIds) {
        if (!known.has(id)) {
          const ref = line.id ? `line "${line.id}"` : `line #${counter}`;
          c.warn(file, `${scope}: ${ref} in section "${section.label}" references unknown memberId "${id}" (not in members[]).`);
        }
      }
    }
  }
}

function parseVersion(raw: unknown, file: string, c: IssueCollector, index: number, songMembers: SongMember[]): SongVersion | null {
  if (!isRecord(raw)) {
    c.warn(file, `versions[${index}] is not an object — skipped.`);
    return null;
  }
  const id = str(raw.id)?.trim() || `version-${index + 1}`;
  if (!isValidId(id)) {
    c.warn(file, `versions[${index}] has an invalid id "${id}" — skipped.`);
    return null;
  }
  const name = str(raw.name)?.trim() || id;
  const audioType = enumValue(raw.audioType, AUDIO_TYPES, 'studio');
  if (raw.audioType !== undefined && raw.audioType !== audioType) {
    c.warn(file, `versions[${index}] has unknown audioType "${String(raw.audioType)}" — using "studio".`);
  }
  const members = Array.isArray(raw.members) && raw.members.length > 0 ? parseSongMembers(raw.members, file, c, `versions[${index}].members`) : undefined;
  const sections = parseSections(raw.sections, file, c, `versions[${index}].sections`);
  checkMemberIds(sections, members ?? songMembers, file, c, `version "${name}"`);
  const notes = strArray(raw.notes);
  if (audioType === 'live' && notes.length === 0) {
    c.hint(file, `versions[${index}] ("${name}") is a live version without notes — explain how the live color coding differs from the studio version.`);
  }
  const language = raw.language === undefined ? undefined : enumValue(raw.language, LANGUAGES, 'other');
  return {
    id,
    name,
    language,
    audioType,
    youtube: str(raw.youtube)?.trim() || undefined,
    members,
    sections,
    notes,
    credits: isRecord(raw.credits) ? parseCredits(raw.credits) : undefined,
  };
}

export function parseSong(raw: unknown, file: string, c: IssueCollector, fileStem: string): Song | null {
  if (!isRecord(raw)) {
    c.error(file, 'Song file must contain a JSON object.');
    return null;
  }
  const id = requireId(raw, file, c, `song-${fileStem}`);
  if (!id) return null;
  const title = str(raw.title)?.trim();
  if (!title) c.warn(file, 'Missing "title" — using the id.');
  const artistId = str(raw.artistId)?.trim();
  if (!artistId) {
    c.error(file, 'Missing "artistId" — the song cannot be routed and is skipped.');
    return null;
  }
  const slug = requireSlug(raw, file, c, fileStem);
  const status = enumValue(raw.status, SONG_STATUSES, 'draft');
  if (raw.status !== undefined && raw.status !== status) {
    c.warn(file, `Unknown status "${String(raw.status)}" — treated as "draft" (not published).`);
  }
  const released = normalizeDate(raw.released);
  if (!released) c.warn(file, 'Missing or invalid "released" date (expected YYYY-MM-DD).');
  const language = enumValue(raw.language, LANGUAGES, 'other');
  if (raw.language !== undefined && raw.language !== language) {
    c.warn(file, `Unknown language "${String(raw.language)}" — using "other".`);
  }
  const members = parseSongMembers(raw.members, file, c, 'members');
  if (members.length === 0) c.warn(file, 'No "members" defined — every line will render as "All".');
  const sections = parseSections(raw.sections, file, c, 'sections');
  if (sections.length === 0) c.warn(file, 'No "sections" — the lyrics area will be empty.');
  checkMemberIds(sections, members, file, c, 'main version');
  const hasAdlib = sections.some((s) => s.lines.some((l) => l.type === 'adlib'));
  const notes = strArray(raw.notes);
  if (hasAdlib && notes.length === 0) {
    c.hint(file, 'This song has adlib lines but no notes. Adlibs should only be added when necessary, with a note explaining the source.');
  }
  const versions: SongVersion[] = [];
  if (Array.isArray(raw.versions)) {
    const seen = new Set<string>(['main']);
    raw.versions.forEach((v, i) => {
      const parsed = parseVersion(v, file, c, i, members);
      if (!parsed) return;
      if (seen.has(parsed.id)) {
        c.warn(file, `Duplicate version id "${parsed.id}" — only the first one is kept.`);
        return;
      }
      seen.add(parsed.id);
      versions.push(parsed);
    });
  }
  const youtube = str(raw.youtube)?.trim() || undefined;
  if (youtube && !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(youtube)) {
    c.warn(file, `"youtube" does not look like a YouTube URL: ${youtube}`);
  }
  return {
    id,
    title: title || id,
    nativeTitle: str(raw.nativeTitle)?.trim() || undefined,
    artistId,
    slug,
    status,
    released,
    createdAt: normalizeDate(raw.createdAt) || undefined,
    youtube,
    cover: str(raw.cover)?.trim() || undefined,
    language,
    album: str(raw.album)?.trim() || undefined,
    categories: strArray(raw.categories),
    tags: strArray(raw.tags),
    authorId: str(raw.authorId)?.trim() || undefined,
    featured: bool(raw.featured),
    credits: parseCredits(raw.credits),
    members,
    sections,
    versions,
    notes,
    sources: strArray(raw.sources),
  };
}

/* ------------------------------------------------------------------ */
/* Taxonomies, authors, community content                              */
/* ------------------------------------------------------------------ */

function parseTaxonomy(raw: unknown, file: string, c: IssueCollector, fileStem: string, kind: string): Category | Tag | null {
  if (!isRecord(raw)) {
    c.error(file, `${kind} file must contain a JSON object.`);
    return null;
  }
  const id = requireId(raw, file, c, fileStem);
  if (!id) return null;
  const name = str(raw.name)?.trim() || id;
  return { id, name, slug: requireSlug(raw, file, c, id), description: str(raw.description)?.trim() || undefined };
}

export function parseCategory(raw: unknown, file: string, c: IssueCollector, fileStem: string): Category | null {
  return parseTaxonomy(raw, file, c, fileStem, 'Category');
}

export function parseTag(raw: unknown, file: string, c: IssueCollector, fileStem: string): Tag | null {
  return parseTaxonomy(raw, file, c, fileStem, 'Tag');
}

export function parseAuthor(raw: unknown, file: string, c: IssueCollector, fileStem: string): Author | null {
  if (!isRecord(raw)) {
    c.error(file, 'Author file must contain a JSON object.');
    return null;
  }
  const id = requireId(raw, file, c, fileStem);
  if (!id) return null;
  const role = enumValue(raw.role, AUTHOR_ROLES, 'editor');
  if (raw.role !== undefined && raw.role !== role) c.warn(file, `Unknown role "${String(raw.role)}" — using "editor".`);
  return {
    id,
    name: str(raw.name)?.trim() || id,
    slug: requireSlug(raw, file, c, id),
    avatar: str(raw.avatar)?.trim() || undefined,
    bio: str(raw.bio)?.trim() || undefined,
    role,
    socials: socials(raw.socials, file, c, 'socials'),
  };
}

export function parseTranslation(raw: unknown, file: string, c: IssueCollector, fileStem: string): Translation | null {
  if (!isRecord(raw)) {
    c.error(file, 'Translation file must contain a JSON object.');
    return null;
  }
  const id = requireId(raw, file, c, fileStem);
  if (!id) return null;
  const songId = str(raw.songId)?.trim();
  if (!songId) {
    c.error(file, 'Missing "songId" — skipped.');
    return null;
  }
  const status = enumValue(raw.status, REVIEW_STATUSES, 'submitted');
  if (raw.status !== undefined && raw.status !== status) c.warn(file, `Unknown status "${String(raw.status)}" — treated as "submitted".`);
  const translator = str(raw.translator)?.trim();
  if (!translator) c.warn(file, 'Missing "translator" — translations must credit their translator.');
  return {
    id,
    songId,
    language: (str(raw.language)?.trim() || 'other').toLowerCase(),
    languageName: str(raw.languageName)?.trim() || undefined,
    translator: translator || 'Anonymous',
    translatorUrl: str(raw.translatorUrl)?.trim() || undefined,
    sourceUrl: str(raw.sourceUrl)?.trim() || undefined,
    status,
    submittedAt: normalizeDate(raw.submittedAt),
    reviewedAt: normalizeDate(raw.reviewedAt) || undefined,
    content: strOr(raw.content, ''),
    notes: str(raw.notes)?.trim() || undefined,
  };
}

export function parseCorrection(raw: unknown, file: string, c: IssueCollector, fileStem: string): Correction | null {
  if (!isRecord(raw)) {
    c.error(file, 'Correction file must contain a JSON object.');
    return null;
  }
  const id = requireId(raw, file, c, fileStem);
  if (!id) return null;
  const status = enumValue(raw.status, CORRECTION_STATUSES, 'open');
  if (raw.status !== undefined && raw.status !== status) c.warn(file, `Unknown status "${String(raw.status)}" — treated as "open".`);
  const type = enumValue(raw.type, CORRECTION_TYPES, 'other');
  return {
    id,
    songId: str(raw.songId)?.trim() || undefined,
    songUrl: strOr(raw.songUrl, '').trim(),
    type,
    title: str(raw.title)?.trim() || `Correction ${id}`,
    issue: strOr(raw.issue, '').trim(),
    excerpt: str(raw.excerpt)?.trim() || undefined,
    suggestion: str(raw.suggestion)?.trim() || undefined,
    evidence: str(raw.evidence)?.trim() || undefined,
    reporter: str(raw.reporter)?.trim() || undefined,
    status,
    createdAt: normalizeDate(raw.createdAt),
    resolvedAt: normalizeDate(raw.resolvedAt) || undefined,
    issueUrl: str(raw.issueUrl)?.trim() || undefined,
    resolution: str(raw.resolution)?.trim() || undefined,
  };
}

export function parseComment(raw: unknown, file: string, c: IssueCollector, fileStem: string): Comment | null {
  if (!isRecord(raw)) {
    c.error(file, 'Comment file must contain a JSON object.');
    return null;
  }
  const id = requireId(raw, file, c, fileStem);
  if (!id) return null;
  const songId = str(raw.songId)?.trim();
  if (!songId) {
    c.error(file, 'Missing "songId" — skipped.');
    return null;
  }
  if (raw.email !== undefined) {
    c.warn(file, 'Comment JSON contains an "email" field. Emails must stay in the private moderation issue, never in the public repository — the field is ignored.');
  }
  const status = enumValue(raw.status, COMMENT_STATUSES, 'pending');
  return {
    id,
    songId,
    name: str(raw.name)?.trim() || 'Anonymous',
    content: strOr(raw.content, '').trim(),
    createdAt: normalizeDate(raw.createdAt),
    status,
    issueUrl: str(raw.issueUrl)?.trim() || undefined,
  };
}

export function parseSettings(raw: unknown, file: string, c: IssueCollector): SiteSettings {
  const r = isRecord(raw) ? raw : {};
  if (!isRecord(raw)) c.warn(file, 'Settings file is missing or invalid — using defaults.');
  const perPage = Number(r.songsPerPage);
  return {
    name: str(r.name)?.trim() || 'Chaereve Lyrics',
    tagline: str(r.tagline)?.trim() || 'Color-coded lyrics & line distribution',
    description: str(r.description)?.trim() || 'Color-coded lyrics, romanization, translations and line distribution.',
    locale: str(r.locale)?.trim() || 'en',
    ogImage: str(r.ogImage)?.trim() || '/uploads/og-default.png',
    trendingSongIds: strArray(r.trendingSongIds),
    popularArtistIds: strArray(r.popularArtistIds),
    songsPerPage: Number.isFinite(perPage) && perPage >= 4 && perPage <= 60 ? Math.floor(perPage) : 12,
    socials: socials(r.socials, file, c, 'socials'),
    footerNote: str(r.footerNote)?.trim() || '',
  };
}

/* ------------------------------------------------------------------ */
/* Cross-file validation                                               */
/* ------------------------------------------------------------------ */

export interface ContentBundle {
  artists: Artist[];
  songs: Song[];
  categories: Category[];
  tags: Tag[];
  authors: Author[];
  translations: Translation[];
  corrections: Correction[];
  comments: Comment[];
  settings: SiteSettings;
}

export interface ContentFiles {
  artists: Map<Artist, string>;
  songs: Map<Song, string>;
}

/**
 * Checks references between files, removes dangling references so pages never
 * link to 404s, and drops songs whose artist does not exist.
 * Mutates the bundle in place and returns it.
 */
export function crossValidate(bundle: ContentBundle, files: ContentFiles, c: IssueCollector): ContentBundle {
  const artistById = new Map<string, Artist>();
  const artistSlugs = new Set<string>();
  for (const artist of bundle.artists) {
    const file = files.artists.get(artist) ?? `artists/${artist.id}`;
    if (artistById.has(artist.id)) {
      c.error(file, `Duplicate artist id "${artist.id}" — this file is ignored.`);
      continue;
    }
    if (artistSlugs.has(artist.slug)) {
      c.error(file, `Duplicate artist slug "${artist.slug}" — this file is ignored.`);
      continue;
    }
    artistById.set(artist.id, artist);
    artistSlugs.add(artist.slug);
  }
  bundle.artists = Array.from(artistById.values());

  // Global member registry: ids should be unique across artists.
  const memberOwner = new Map<string, Artist>();
  const memberSlugs = new Map<string, string>();
  for (const artist of bundle.artists) {
    const file = files.artists.get(artist) ?? `artists/${artist.id}`;
    for (const member of artist.members) {
      const owner = memberOwner.get(member.id);
      if (owner) {
        c.warn(file, `Member id "${member.id}" is also used by artist "${owner.id}". Member ids must be unique across the whole site — the member page will use "${artist.slug}-${member.id}".`);
        member.slug = member.slug ?? `${artist.slug}-${member.id}`;
      } else {
        memberOwner.set(member.id, artist);
      }
      const slug = member.slug ?? member.id;
      const taken = memberSlugs.get(slug);
      if (taken) {
        const disambiguated = `${artist.slug}-${slug}`;
        c.warn(file, `Member slug "${slug}" is already used by "${taken}" — using "${disambiguated}".`);
        member.slug = disambiguated;
        memberSlugs.set(disambiguated, `${artist.id}/${member.id}`);
      } else {
        memberSlugs.set(slug, `${artist.id}/${member.id}`);
      }
    }
  }
  for (const artist of bundle.artists) {
    const file = files.artists.get(artist) ?? `artists/${artist.id}`;
    artist.relatedArtistIds = (artist.relatedArtistIds ?? []).filter((id) => {
      if (id === artist.id) return false;
      if (!artistById.has(id)) {
        c.warn(file, `relatedArtistIds references unknown artist "${id}" — removed.`);
        return false;
      }
      return true;
    });
  }

  const categoryIds = new Set(bundle.categories.map((x) => x.id));
  const tagIds = new Set(bundle.tags.map((x) => x.id));
  const authorIds = new Set(bundle.authors.map((x) => x.id));

  const songIds = new Set<string>();
  const routeKeys = new Set<string>();
  const keptSongs: Song[] = [];
  for (const song of bundle.songs) {
    const file = files.songs.get(song) ?? `songs/${song.id}`;
    if (songIds.has(song.id)) {
      c.error(file, `Duplicate song id "${song.id}" — this file is ignored.`);
      continue;
    }
    const artist = artistById.get(song.artistId);
    if (!artist) {
      c.error(file, `artistId "${song.artistId}" does not exist in content/artists — song skipped.`);
      continue;
    }
    const routeKey = `${artist.slug}/${song.slug}`;
    if (routeKeys.has(routeKey)) {
      c.error(file, `Another song already uses the URL /lyrics/${routeKey}/ — this file is ignored.`);
      continue;
    }
    songIds.add(song.id);
    routeKeys.add(routeKey);
    if (song.slug.startsWith(`${artist.slug}-`)) {
      c.hint(file, `Song slug "${song.slug}" repeats the artist slug; the URL becomes /lyrics/${artist.slug}/${song.slug}/. Consider "${song.slug.slice(artist.slug.length + 1)}".`);
    }
    for (const m of song.members) {
      if (!memberOwner.has(m.id)) {
        c.hint(file, `members[] id "${m.id}" has no member profile in any artist file (guest/feature?) — it will not link to a member page.`);
      }
    }
    song.categories = song.categories.filter((id) => {
      if (!categoryIds.has(id)) {
        c.warn(file, `Unknown category "${id}" — removed.`);
        return false;
      }
      return true;
    });
    song.tags = song.tags.filter((id) => {
      if (!tagIds.has(id)) {
        c.warn(file, `Unknown tag "${id}" — removed.`);
        return false;
      }
      return true;
    });
    if (song.authorId && !authorIds.has(song.authorId)) {
      c.warn(file, `Unknown authorId "${song.authorId}" — removed.`);
      song.authorId = undefined;
    }
    keptSongs.push(song);
  }
  bundle.songs = keptSongs;

  bundle.translations = bundle.translations.filter((t) => {
    if (!songIds.has(t.songId)) {
      c.warn(`translations/${t.id}`, `songId "${t.songId}" does not exist — translation ignored.`);
      return false;
    }
    return true;
  });
  for (const correction of bundle.corrections) {
    if (correction.songId && !songIds.has(correction.songId)) {
      c.warn(`corrections/${correction.id}`, `songId "${correction.songId}" does not exist — link removed.`);
      correction.songId = undefined;
    }
  }
  bundle.comments = bundle.comments.filter((cm) => {
    if (!songIds.has(cm.songId)) {
      c.warn(`comments/${cm.id}`, `songId "${cm.songId}" does not exist — comment ignored.`);
      return false;
    }
    return true;
  });

  const settingsFile = 'settings/site.json';
  bundle.settings.trendingSongIds = bundle.settings.trendingSongIds.filter((id) => {
    if (!songIds.has(id)) {
      c.warn(settingsFile, `trendingSongIds references unknown song "${id}" — removed.`);
      return false;
    }
    return true;
  });
  bundle.settings.popularArtistIds = bundle.settings.popularArtistIds.filter((id) => {
    if (!artistById.has(id)) {
      c.warn(settingsFile, `popularArtistIds references unknown artist "${id}" — removed.`);
      return false;
    }
    return true;
  });

  return bundle;
}

/** Format issues for console output. */
export function formatIssue(issue: Issue): string {
  const tag = issue.level === 'error' ? 'ERROR' : issue.level === 'warn' ? 'WARN ' : 'HINT ';
  return `[content] ${tag} ${issue.file}: ${issue.message}`;
}
