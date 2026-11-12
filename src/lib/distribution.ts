/**
 * Line distribution — đếm số dòng của từng thành viên.
 *
 * Quy tắc:
 * - Mỗi lần một memberId xuất hiện trong một dòng thì cộng 1 line cho memberId đó.
 *   Dòng có 2 thành viên → cả hai được +1 line.
 * - Dòng `adlib` KHÔNG được tính vào line distribution (mặc định).
 * - Dòng không có memberIds (all / instrumental) không tính cho thành viên nào.
 * - Phần trăm = count / tổng số dòng có gán thành viên * 100.
 */
import type { Song, SongLine } from './types';

export interface MemberDistribution {
  memberId: string;
  name: string;
  color: string;
  lines: number;
  percent: number;
}

export interface DistributionResult {
  members: MemberDistribution[];
  /** Tổng dòng có gán thành viên (mỗi occurrence thành viên = 1). */
  totalMemberLines: number;
  /** Số dòng không adlib (gồm all/instrumental/lyric/spoken). */
  totalLines: number;
  /** Số dòng không có thành viên nào (all / instrumental). */
  ensembleLines: number;
  adlibLines: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeDistribution(song: Song): DistributionResult {
  const counts = new Map<string, number>();
  for (const m of song.members ?? []) counts.set(m.id, 0);

  let totalLines = 0;
  let ensembleLines = 0;
  let adlibLines = 0;

  for (const section of song.sections ?? []) {
    for (const line of section.lines ?? []) {
      const l = line as SongLine;
      if (l.type === 'adlib') {
        adlibLines += 1;
        continue; // adlib không tính vào distribution
      }
      totalLines += 1;
      const ids = Array.isArray(l.memberIds) ? l.memberIds : [];
      if (ids.length === 0) {
        ensembleLines += 1;
        continue;
      }
      for (const id of ids) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }

  const totalMemberLines = [...counts.values()].reduce((a, b) => a + b, 0);

  const members: MemberDistribution[] = (song.members ?? [])
    .map((m) => {
      const lines = counts.get(m.id) ?? 0;
      return {
        memberId: m.id,
        name: m.name,
        color: m.color,
        lines,
        percent: totalMemberLines > 0 ? round1((lines / totalMemberLines) * 100) : 0,
      };
    })
    .sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name));

  return { members, totalMemberLines, totalLines, ensembleLines, adlibLines };
}

/** Tổng số dòng (không adlib) của một danh sách bài hát. */
export function totalLinesOfSongs(songs: Song[]): number {
  return songs.reduce((sum, s) => sum + computeDistribution(s).totalLines, 0);
}

/** Tổng số dòng của một thành viên trên toàn bộ danh sách bài hát. */
export function memberLinesAcrossSongs(memberId: string, songs: Song[]): number {
  let total = 0;
  for (const song of songs) {
    const inSong = (song.members ?? []).some((m) => m.id === memberId);
    if (!inSong) continue;
    total += computeDistribution(song).members.find((m) => m.memberId === memberId)?.lines ?? 0;
  }
  return total;
}
