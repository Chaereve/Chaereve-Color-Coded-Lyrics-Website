import type { LyricLine, LyricSection, SongMember } from './types';

export interface DistributionRow {
  memberId: string;
  name: string;
  color: string;
  lines: number;
  /** Share of all member line credits (0–100, one decimal). */
  percent: number;
}

export interface Distribution {
  rows: DistributionRow[];
  /** Lines with no memberIds (All / ensemble). */
  allLines: number;
  /** Lines that were counted (excludes instrumental, and adlibs unless included). */
  countedLines: number;
  /** Sum of all member credits (a 2-member line adds 2). */
  totalCredits: number;
  instrumentalLines: number;
  adlibLines: number;
  includeAdlibs: boolean;
  /** memberIds that appeared in lines but are not part of the roster. */
  unknownMemberIds: string[];
}

export interface DistributionOptions {
  includeAdlibs?: boolean;
}

/** Whether a line participates in the line count. */
export function isCountedLine(line: LyricLine, includeAdlibs: boolean): boolean {
  if (line.type === 'instrumental') return false;
  if (line.type === 'adlib' && !includeAdlibs) return false;
  return true;
}

/**
 * Counts every memberId occurrence per line.
 *  - A line credited to two members counts one line for each of them.
 *  - Lines without memberIds are "All" and reported separately.
 *  - Instrumental lines are never counted.
 *  - Adlib lines are excluded by default.
 */
export function computeDistribution(members: SongMember[], sections: LyricSection[], options: DistributionOptions = {}): Distribution {
  const includeAdlibs = options.includeAdlibs ?? false;
  const counts = new Map<string, number>(members.map((m) => [m.id, 0]));
  const unknown = new Set<string>();
  let allLines = 0;
  let countedLines = 0;
  let instrumentalLines = 0;
  let adlibLines = 0;

  for (const section of sections) {
    for (const line of section.lines) {
      if (line.type === 'instrumental') {
        instrumentalLines += 1;
        continue;
      }
      if (line.type === 'adlib') adlibLines += 1;
      if (!isCountedLine(line, includeAdlibs)) continue;
      countedLines += 1;
      if (line.memberIds.length === 0) {
        allLines += 1;
        continue;
      }
      for (const id of line.memberIds) {
        if (!counts.has(id)) {
          unknown.add(id);
          continue;
        }
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }

  let totalCredits = 0;
  for (const v of counts.values()) totalCredits += v;

  const rows: DistributionRow[] = members
    .map((m) => {
      const lines = counts.get(m.id) ?? 0;
      return {
        memberId: m.id,
        name: m.name,
        color: m.color,
        lines,
        percent: totalCredits === 0 ? 0 : Math.round((lines / totalCredits) * 1000) / 10,
      };
    })
    .sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name));

  return {
    rows,
    allLines,
    countedLines,
    totalCredits,
    instrumentalLines,
    adlibLines,
    includeAdlibs,
    unknownMemberIds: Array.from(unknown),
  };
}

export interface MemberSongShare {
  songId: string;
  lines: number;
  percent: number;
  countedLines: number;
  versionId: string;
}

/** Lines + share of one member in a given roster/section set (main version by default). */
export function memberShare(memberId: string, members: SongMember[], sections: LyricSection[]): { lines: number; percent: number; countedLines: number } {
  const dist = computeDistribution(members, sections);
  const row = dist.rows.find((r) => r.memberId === memberId);
  return { lines: row?.lines ?? 0, percent: row?.percent ?? 0, countedLines: dist.countedLines };
}
