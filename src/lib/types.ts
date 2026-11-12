/**
 * Types for the JSON content schema (content/artists/*.json, content/songs/*.json).
 * Ids are internal lowercase identifiers — KHÔNG dùng tên hiển thị làm khoá dữ liệu.
 */

export type ArtistType = 'solo' | 'group';

export type SongStatus = 'draft' | 'in_review' | 'published';

export type LineType = 'lyric' | 'all' | 'instrumental' | 'spoken' | 'adlib';

export interface ArtistMember {
  id: string;
  name: string;
  romanized?: string;
  color: string;
  role?: string;
  officialColor?: string;
  colorSource?: string;
}

export interface Artist {
  id: string;
  name: string;
  slug: string;
  type: ArtistType;
  description?: string;
  cover?: string;
  members: ArtistMember[];
}

export interface SongMember {
  id: string;
  name: string;
  color: string;
}

export interface SongLine {
  id: string;
  memberIds: string[];
  text: string;
  romanization?: string;
  translation?: string;
  type: LineType;
}

export interface SongSection {
  id: string;
  label: string;
  lines: SongLine[];
}

export interface SongCredits {
  lyrics?: string[];
  composition?: string[];
  arrangement?: string[];
  translation?: string[];
  romanization?: string[];
  colorCoding?: string[];
  source?: string;
}

export interface Song {
  id: string;
  title: string;
  artistId: string;
  slug: string;
  status: SongStatus;
  released?: string;
  youtube?: string;
  cover?: string;
  language?: string;
  album?: string;
  credits?: SongCredits;
  members: SongMember[];
  sections: SongSection[];
  notes?: string[];
  sources?: string[];
}
