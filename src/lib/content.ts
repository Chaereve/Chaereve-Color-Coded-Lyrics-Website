/**
 * Đọc & kiểm tra dữ liệu nội dung từ thư mục /content lúc build.
 *
 * Quy tắc:
 * - Mỗi nghệ sĩ / bài hát là một file JSON riêng.
 * - Lỗi dữ liệu KHÔNG làm crash build: chỉ console.warn (build vẫn thành công).
 * - Cảnh báo khi artistId hoặc memberIds không khớp dữ liệu nghệ sĩ.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Artist, Song, SongLine } from './types';

const ROOT = process.cwd();
const ARTISTS_DIR = path.join(ROOT, 'content', 'artists');
const SONGS_DIR = path.join(ROOT, 'content', 'songs');

const warnings: string[] = [];

function warn(message: string): void {
  if (!warnings.includes(message)) {
    warnings.push(message);
    console.warn(`[content] ⚠ ${message}`);
  }
}

function readJsonDir<T>(dir: string, kind: string): T[] {
  if (!fs.existsSync(dir)) {
    warn(`Thư mục ${kind} không tồn tại: ${dir}`);
    return [];
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const items: T[] = [];
  for (const file of files) {
    const full = path.join(dir, file);
    try {
      const raw = fs.readFileSync(full, 'utf8');
      items.push(JSON.parse(raw) as T);
    } catch (err) {
      warn(`Không đọc được JSON "${file}": ${(err as Error).message}`);
    }
  }
  return items;
}

function asArray<T>(v: T[] | undefined | null): T[] {
  return Array.isArray(v) ? v : [];
}

/** Toàn bộ cảnh báo dữ liệu đã gặp trong lần build hiện tại. */
export function getContentWarnings(): string[] {
  return [...warnings];
}

let cache: { artists: Artist[]; songs: Song[] } | null = null;

function validate(artists: Artist[], songs: Song[]): void {
  const artistIds = new Set<string>();
  for (const a of artists) {
    if (!a.id) warn(`Artists: một file thiếu trường "id".`);
    if (artistIds.has(a.id)) warn(`Artists: id trùng lặp "${a.id}".`);
    artistIds.add(a.id);
    if (!a.slug) warn(`Artists "${a.id}": thiếu "slug".`);
    const memberIds = new Set<string>();
    for (const m of asArray(a.members)) {
      if (memberIds.has(m.id)) warn(`Artists "${a.id}": member id trùng lặp "${m.id}".`);
      memberIds.add(m.id);
      if (!m.color) warn(`Artists "${a.id}", member "${m.id}": thiếu color.`);
    }
  }

  const songIds = new Set<string>();
  const slugs = new Set<string>();
  for (const s of songs) {
    if (!s.id) warn(`Songs: một file thiếu trường "id".`);
    if (songIds.has(s.id)) warn(`Songs: id trùng lặp "${s.id}".`);
    songIds.add(s.id);
    if (!s.slug) warn(`Songs "${s.id}": thiếu "slug".`);
    if (slugs.has(s.slug)) warn(`Songs: slug trùng lặp "${s.slug}".`);
    slugs.add(s.slug);

    if (!artistIds.has(s.artistId)) {
      warn(`Bài "${s.slug}": artistId "${s.artistId}" không tồn tại trong content/artists/.`);
    }

    const artist = artists.find((a) => a.id === s.artistId);
    const artistMemberIds = new Set(asArray(artist?.members).map((m) => m.id));
    const songMemberIds = new Set(asArray(s.members).map((m) => m.id));
    const lineIds = new Set<string>();

    for (const sec of asArray(s.sections)) {
      for (const line of asArray(sec.lines) as SongLine[]) {
        if (lineIds.has(line.id)) warn(`Bài "${s.slug}": line id trùng lặp "${line.id}".`);
        lineIds.add(line.id);
        for (const mid of asArray(line.memberIds)) {
          if (!songMemberIds.has(mid)) {
            warn(
              `Bài "${s.slug}" (line "${line.id}"): memberIds chứa "${mid}" không có trong members[].id của bài hát.`,
            );
          } else if (artistMemberIds.size > 0 && !artistMemberIds.has(mid)) {
            warn(
              `Bài "${s.slug}" (line "${line.id}"): member "${mid}" không thuộc danh sách members của nghệ sĩ "${s.artistId}".`,
            );
          }
        }
      }
    }
  }
}

/** Toàn bộ nghệ sĩ (đã cache trong một lần build). */
export function getArtists(): Artist[] {
  if (!cache) load();
  return cache?.artists ?? [];
}

/** Toàn bộ bài hát (đã cache trong một lần build). */
export function getSongs(): Song[] {
  if (!cache) load();
  return cache?.songs ?? [];
}

function load(): void {
  const artists = readJsonDir<Artist>(ARTISTS_DIR, 'artists');
  const songs = readJsonDir<Song>(SONGS_DIR, 'songs');
  validate(artists, songs);
  cache = { artists, songs };
}

export function getArtistById(id: string): Artist | undefined {
  return getArtists().find((a) => a.id === id);
}

export function getArtistBySlug(slug: string): Artist | undefined {
  return getArtists().find((a) => a.slug === slug);
}

export function getSongBySlug(slug: string): Song | undefined {
  return getSongs().find((s) => s.slug === slug);
}

/** Bài hát đã publish, sắp xếp mới nhất trước. */
export function getPublishedSongs(): Song[] {
  return getSongs()
    .filter((s) => s.status === 'published')
    .sort((a, b) => (b.released ?? '').localeCompare(a.released ?? '') || a.slug.localeCompare(b.slug));
}

/** Bài hát của một nghệ sĩ (đã publish), mới nhất trước. */
export function getSongsByArtist(artistId: string): Song[] {
  return getPublishedSongs().filter((s) => s.artistId === artistId);
}
