/**
 * Content model for the JSON files under `content/`.
 *
 * Every relation uses internal IDs (never display names):
 *   song.artistId          -> artist.id
 *   song.members[].id      -> artist.members[].id (same artist, or a guest from another artist)
 *   line.memberIds[]       -> song.members[].id (or version.members[].id when a version overrides them)
 *   song.categories[]      -> category.id
 *   song.tags[]            -> tag.id
 *   song.authorId          -> author.id
 *   translation.songId     -> song.id
 */

export const LINE_TYPES = ['lyric', 'all', 'instrumental', 'spoken', 'adlib'] as const;
export type LineType = (typeof LINE_TYPES)[number];

export const LANGUAGES = ['ko', 'ja', 'zh', 'en', 'vi', 'other'] as const;
export type Language = (typeof LANGUAGES)[number];

export const AUDIO_TYPES = ['studio', 'live', 'remix'] as const;
export type AudioType = (typeof AUDIO_TYPES)[number];

export const SONG_STATUSES = ['draft', 'in_review', 'published'] as const;
export type SongStatus = (typeof SONG_STATUSES)[number];

export const REVIEW_STATUSES = ['submitted', 'reviewing', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const CORRECTION_STATUSES = ['open', 'reviewing', 'accepted', 'applied', 'rejected'] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export const CORRECTION_TYPES = ['lyrics', 'color-coding', 'translation', 'romanization', 'credits', 'other'] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export const COMMENT_STATUSES = ['pending', 'approved', 'spam', 'trash'] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const AUTHOR_ROLES = ['admin', 'editor', 'translator', 'coder'] as const;
export type AuthorRole = (typeof AUTHOR_ROLES)[number];

export interface SocialLink {
  label: string;
  url: string;
}

export interface ArtistMember {
  id: string;
  name: string;
  nativeName?: string;
  romanized?: string;
  /** Optional explicit slug for /member/[slug]/ — defaults to the member id. */
  slug?: string;
  /** Color used for lyrics on this site. */
  color: string;
  /** Official color (if the group has one) — informational only. */
  officialColor?: string;
  /** Where the color comes from (official announcement, fandom convention, or "demo"). */
  colorSource?: string;
  role?: string;
  bio?: string;
  socials?: SocialLink[];
}

export interface Artist {
  id: string;
  name: string;
  nativeName?: string;
  romanized?: string;
  slug: string;
  type: 'solo' | 'group';
  description: string;
  cover: string;
  debut?: string;
  label?: string;
  socials?: SocialLink[];
  members: ArtistMember[];
  relatedArtistIds?: string[];
}

export interface SongMember {
  id: string;
  name: string;
  color: string;
}

export interface LyricLine {
  id?: string;
  /** Empty array = "All" / ensemble. One line may credit several members. */
  memberIds: string[];
  /**
   * For multi-member lines, parts can be separated with `|` in the same order
   * as memberIds, e.g. "first half | second half". If the number of parts does
   * not match, the whole line is rendered with a gradient of the member colors.
   */
  text: string;
  romanization?: string;
  translation?: string;
  type: LineType;
  note?: string;
}

export interface LyricSection {
  id?: string;
  label: string;
  lines: LyricLine[];
}

export interface Credits {
  lyrics: string[];
  composition: string[];
  arrangement: string[];
  translation: string[];
  romanization: string[];
  colorCoding: string[];
  source: string;
}

export interface SongVersion {
  id: string;
  name: string;
  language?: Language;
  audioType: AudioType;
  youtube?: string;
  /** Override the member roster/colors for this version (defaults to the song's members). */
  members?: SongMember[];
  sections: LyricSection[];
  notes?: string[];
  credits?: Partial<Credits>;
}

export interface Song {
  id: string;
  title: string;
  nativeTitle?: string;
  artistId: string;
  slug: string;
  status: SongStatus;
  /** Release date (YYYY-MM-DD). */
  released: string;
  /** Date the post was added to the site (YYYY-MM-DD). Defaults to `released`. */
  createdAt?: string;
  youtube?: string;
  cover?: string;
  language: Language;
  album?: string;
  categories: string[];
  tags: string[];
  authorId?: string;
  featured?: boolean;
  credits: Credits;
  members: SongMember[];
  sections: LyricSection[];
  versions: SongVersion[];
  notes: string[];
  sources: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface Author {
  id: string;
  name: string;
  slug: string;
  avatar?: string;
  bio?: string;
  role: AuthorRole;
  socials?: SocialLink[];
}

export interface Translation {
  id: string;
  songId: string;
  /** BCP-47-ish code of the target language, e.g. "vi", "es", "id". */
  language: string;
  languageName?: string;
  translator: string;
  translatorUrl?: string;
  sourceUrl?: string;
  status: ReviewStatus;
  submittedAt: string;
  reviewedAt?: string;
  /** Plain text; blank lines separate sections. */
  content: string;
  notes?: string;
}

export interface Correction {
  id: string;
  songId?: string;
  songUrl: string;
  type: CorrectionType;
  title: string;
  issue: string;
  excerpt?: string;
  suggestion?: string;
  evidence?: string;
  reporter?: string;
  status: CorrectionStatus;
  createdAt: string;
  resolvedAt?: string;
  issueUrl?: string;
  resolution?: string;
}

export interface Comment {
  id: string;
  songId: string;
  name: string;
  content: string;
  createdAt: string;
  status: CommentStatus;
  /** Set when the comment was accepted from a GitHub issue. */
  issueUrl?: string;
}

export interface PageDoc {
  slug: string;
  title: string;
  description?: string;
  updated?: string;
  /** Rendered HTML (from markdown). */
  html: string;
  /** Show in footer navigation. */
  inFooter?: boolean;
  order?: number;
}

export interface SiteSettings {
  name: string;
  tagline: string;
  description: string;
  locale: string;
  /** Default Open Graph image (absolute path under /public). */
  ogImage: string;
  /** Curated list of song IDs for the "Trending" section (falls back to latest songs). */
  trendingSongIds: string[];
  /** Curated list of artist IDs for "Popular Artists" (falls back to song count). */
  popularArtistIds: string[];
  songsPerPage: number;
  socials: SocialLink[];
  footerNote: string;
}
