import { segmentedGradient } from './color';
import { cssIdent, stripPartSeparators } from './text';
import type { LyricLine, LyricSection, SongMember } from './types';

export type LyricsView = 'original' | 'romanization' | 'translation';

/** CSS custom property that holds the (contrast-adjusted) color of a member. */
export function memberVar(memberId: string): string {
  return `--m-${cssIdent(memberId)}`;
}

export function memberColorValue(memberId: string): string {
  return `var(${memberVar(memberId)})`;
}

export interface ResolvedLine {
  /** Members found in the roster, in memberIds order. */
  members: SongMember[];
  /** Ids that could not be resolved against the roster. */
  unknown: string[];
  /** True when memberIds is empty (All / ensemble). */
  isAll: boolean;
}

export function resolveLine(line: LyricLine, roster: Map<string, SongMember>): ResolvedLine {
  const members: SongMember[] = [];
  const unknown: string[] = [];
  for (const id of line.memberIds) {
    const m = roster.get(id);
    if (m) members.push(m);
    else unknown.push(id);
  }
  return { members, unknown, isAll: line.memberIds.length === 0 };
}

/** Text for a given view, following the fallback rules of the spec. */
export function lineText(line: LyricLine, view: LyricsView): string {
  if (view === 'original') return line.text;
  if (view === 'romanization') return line.romanization || line.text;
  return line.translation || '';
}

export interface RenderedSegment {
  text: string;
  /** Inline style for this segment (color or gradient). */
  style: string;
  /** Whether the segment uses gradient text. */
  gradient: boolean;
}

/**
 * Splits `text` into colored segments for a line:
 *  - 1 member → one segment in that member's color.
 *  - N members and text has exactly N `|`-separated parts → N colored parts.
 *  - N members otherwise → single gradient segment through the N colors.
 *  - 0 resolved members → single uncolored segment (All / unknown).
 */
export function renderSegments(text: string, members: SongMember[]): RenderedSegment[] {
  if (members.length === 0) {
    return [{ text: stripPartSeparators(text), style: '', gradient: false }];
  }
  if (members.length === 1) {
    const m = members[0]!;
    return [{ text: stripPartSeparators(text), style: `color:${memberColorValue(m.id)}`, gradient: false }];
  }
  const parts = text.split('|').map((p) => p.trim());
  if (parts.length === members.length && parts.every((p) => p.length > 0)) {
    return parts.map((part, i) => ({
      text: part,
      style: `color:${memberColorValue(members[i]!.id)}`,
      gradient: false,
    }));
  }
  const gradient = segmentedGradient(members.map((m) => memberColorValue(m.id)));
  return [{ text: stripPartSeparators(text), style: `background-image:${gradient}`, gradient: true }];
}

/** Count of lyric lines (excluding instrumental) — used for cards and SEO descriptions. */
export function countLines(sections: LyricSection[]): number {
  let n = 0;
  for (const s of sections) for (const l of s.lines) if (l.type !== 'instrumental') n += 1;
  return n;
}
