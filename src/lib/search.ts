/**
 * Chỉ mục tìm kiếm tạo lúc build, tìm phía client (không backend, không service paid).
 * Chuẩn hoá: lowercase, bỏ dấu (NFD), bỏ khoảng trắng thừa — hỗ trợ tìm không dấu.
 */
import type { Artist, Song } from './types';

export interface SearchEntry {
  type: 'song' | 'artist' | 'member';
  title: string;
  subtitle: string;
  url: string;
  keywords: string;
}

/** Bỏ dấu tiếng Việt + lowercase + trim khoảng trắng. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSearchIndex(artists: Artist[], songs: Song[]): SearchEntry[] {
  const entries: SearchEntry[] = [];

  for (const song of songs) {
    if (song.status !== 'published') continue;
    const artist = artists.find((a) => a.id === song.artistId);
    const memberNames = (song.members ?? []).map((m) => m.name).join(' ');
    entries.push({
      type: 'song',
      title: song.title,
      subtitle: artist?.name ?? '',
      url: `/lyrics/${song.slug}/`,
      keywords: normalize(
        [song.title, artist?.name ?? '', memberNames, song.album ?? '', song.slug].join(' '),
      ),
    });
  }

  for (const artist of artists) {
    entries.push({
      type: 'artist',
      title: artist.name,
      subtitle: artist.type === 'group' ? 'Nhóm' : 'Nghệ sĩ solo',
      url: `/artist/${artist.slug}/`,
      keywords: normalize([artist.name, artist.slug, artist.description ?? ''].join(' ')),
    });

    for (const member of artist.members ?? []) {
      entries.push({
        type: 'member',
        title: member.name,
        subtitle: `${artist.name} · ${member.role ?? 'Thành viên'}`,
        url: `/member/${member.id}/`,
        keywords: normalize(
          [member.name, member.romanized ?? '', artist.name, member.role ?? ''].join(' '),
        ),
      });
    }
  }

  return entries;
}
