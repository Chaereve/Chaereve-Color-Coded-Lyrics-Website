/**
 * Builds the Decap CMS configuration (as a JS object) from the content and
 * the environment. `src/pages/admin/config.yml.ts` stringifies it at build
 * time; `scripts/check-cms-config.ts` validates the committed template.
 *
 * Publishing is ALWAYS `publish_mode: editorial_workflow`:
 *  - no contributor can publish directly to the default branch,
 *  - changes become drafts / pull requests that an admin merges,
 *  - translations, corrections and comments are never auto-published.
 *
 * The GitHub backend (self-hosted OAuth Worker) additionally enables
 * `open_authoring: true`, so contributors without repo access can fork and
 * open PRs. (Open authoring is not a supported Turbo mode — Turbo users are
 * invited to the Turbo site instead.)
 */
import type { CmsRuntimeConfig } from './env';
import type { Artist, Category, Tag, Author } from './types';

interface Taxonomy {
  id: string;
  name: string;
}

export interface CmsConfigContext {
  artists: Artist[];
  categories: Category[];
  tags: Tag[];
  authors: Author[];
  siteUrl: string;
  config: CmsRuntimeConfig;
}

/** Select options for a song's artistId. */
export function artistOptions(artists: Artist[]): { label: string; value: string }[] {
  return artists.map((a) => ({ label: a.name, value: a.id }));
}

const lineFields = [
  { label: 'Member IDs (empty = All)', name: 'memberIds', widget: 'list', field: { label: 'Member ID', name: 'id', widget: 'string' }, required: false, hint: 'Use internal member IDs, never names. Multi-member lines: one entry per singer.' },
  { label: 'Text', name: 'text', widget: 'string', hint: 'Split multi-member lines with “|” in the same order as the member IDs (optional).' },
  { label: 'Romanization', name: 'romanization', widget: 'string', required: false },
  { label: 'Translation', name: 'translation', widget: 'string', required: false },
  {
    label: 'Type',
    name: 'type',
    widget: 'select',
    default: 'lyric',
    options: [
      { label: 'lyric', value: 'lyric' },
      { label: 'all', value: 'all' },
      { label: 'instrumental', value: 'instrumental' },
      { label: 'spoken', value: 'spoken' },
      { label: 'adlib', value: 'adlib' },
    ],
  },
  { label: 'Note', name: 'note', widget: 'string', required: false },
];

const sectionFields = [
  { label: 'Label', name: 'label', widget: 'string' },
  { label: 'Lines', name: 'lines', widget: 'list', collapsed: true, fields: lineFields },
];

const memberRosterFields = [
  { label: 'Member ID', name: 'id', widget: 'string' },
  { label: 'Name', name: 'name', widget: 'string' },
  { label: 'Color', name: 'color', widget: 'color' },
];

const categoryListWidget = (categories: Taxonomy[], name: string, label: string) => ({
  label,
  name,
  widget: 'list',
  field: {
    label: 'Value',
    name: 'value',
    widget: 'select',
    options: categories.map((c) => ({ label: c.name, value: c.id })),
  },
  required: false,
});

export function buildCmsConfig({ artists, categories, tags, authors, siteUrl, config }: CmsConfigContext) {
  const backend =
    config.localBackend
      ? { name: 'test', local_backend: true }
      : config.backend === 'github'
        ? {
            name: 'github',
            repo: config.repo ?? 'YOUR_GITHUB_USERNAME/YOUR_REPO',
            branch: config.branch,
            base_url: config.oauthBaseUrl ?? 'https://YOUR_OAUTH_WORKER_DOMAIN',
            auth_endpoint: config.oauthAuthEndpoint,
            open_authoring: true,
            auth_scope: 'repo',
          }
        : {
            name: 'turbo-github',
            turbo_site_id: config.turboSiteId ?? 'YOUR_TURBO_SITE_ID',
            branch: config.branch,
          };

  return {
    backend,
    publish_mode: 'editorial_workflow',
    site_url: siteUrl,
    display_url: siteUrl,
    logo_url: '/favicon.svg',
    media_folder: '/uploads/',
    public_folder: 'uploads',
    collections: [
      {
        name: 'songs',
        label: 'Songs',
        label_singular: 'Song',
        folder: 'content/songs',
        format: 'json',
        slug: '{{id}}.json',
        summary_fields: ['title', 'artistId', 'status', 'released'],
        fields: [
          { label: 'ID', name: 'id', widget: 'string', required: true, hint: 'Lowercase a-z, 0-9, - or _. Changing the ID renames the file.', pattern: ['^[a-z0-9][a-z0-9_-]*$', 'Use lowercase letters, digits, “-” or “_”.'] },
          { label: 'Title', name: 'title', widget: 'string', required: true },
          { label: 'Native title', name: 'nativeTitle', widget: 'string', required: false },
          { label: 'Artist (ID)', name: 'artistId', widget: 'select', options: artistOptions(artists), required: true, help: 'Internal artist ID, not the display name.' },
          { label: 'Slug', name: 'slug', widget: 'string', required: true, pattern: ['^[a-z0-9]+(?:-[a-z0-9]+)*$', 'Lowercase, hyphen-separated.'] },
          {
            label: 'Status',
            name: 'status',
            widget: 'select',
            default: 'draft',
            options: [
              { label: 'draft (hidden)', value: 'draft' },
              { label: 'in_review (hidden)', value: 'in_review' },
              { label: 'published', value: 'published' },
            ],
          },
          { label: 'Released', name: 'released', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: '' },
          { label: 'Created at', name: 'createdAt', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: '', required: false, hint: 'When the post was added to the site. Defaults to “Released”.' },
          { label: 'YouTube', name: 'youtube', widget: 'string', required: false },
          { label: 'Cover', name: 'cover', widget: 'image', required: false },
          {
            label: 'Language',
            name: 'language',
            widget: 'select',
            default: 'ko',
            options: [
              { label: 'Korean (ko)', value: 'ko' },
              { label: 'Japanese (ja)', value: 'ja' },
              { label: 'Chinese (zh)', value: 'zh' },
              { label: 'English (en)', value: 'en' },
              { label: 'Vietnamese (vi)', value: 'vi' },
              { label: 'Other', value: 'other' },
            ],
          },
          { label: 'Album', name: 'album', widget: 'string', required: false },
          categoryListWidget(categories, 'categories', 'Categories (IDs)'),
          categoryListWidget(tags, 'tags', 'Tags (IDs)'),
          { label: 'Color-coding author (ID)', name: 'authorId', widget: 'select', options: authors.map((a) => ({ label: a.name, value: a.id })), required: false },
          { label: 'Featured on home page', name: 'featured', widget: 'boolean', default: false },
          {
            label: 'Credits',
            name: 'credits',
            widget: 'object',
            fields: [
              { label: 'Lyrics', name: 'lyrics', widget: 'list', field: { label: 'Name', name: 'value', widget: 'string' }, required: false },
              { label: 'Composition', name: 'composition', widget: 'list', field: { label: 'Name', name: 'value', widget: 'string' }, required: false },
              { label: 'Arrangement', name: 'arrangement', widget: 'list', field: { label: 'Name', name: 'value', widget: 'string' }, required: false },
              { label: 'Translation', name: 'translation', widget: 'list', field: { label: 'Name', name: 'value', widget: 'string' }, required: false },
              { label: 'Romanization', name: 'romanization', widget: 'list', field: { label: 'Name', name: 'value', widget: 'string' }, required: false },
              { label: 'Color coding', name: 'colorCoding', widget: 'list', field: { label: 'Name', name: 'value', widget: 'string' }, required: false },
              { label: 'Source note', name: 'source', widget: 'string', required: false },
            ],
          },
          { label: 'Members (roster)', name: 'members', widget: 'list', collapsed: true, fields: memberRosterFields },
          { label: 'Sections', name: 'sections', widget: 'list', collapsed: true, fields: sectionFields },
          {
            label: 'Versions (live / remix / alternate coding)',
            name: 'versions',
            widget: 'list',
            collapsed: true,
            required: false,
            hint: 'Each version has its own sections + line coding. Live coding must be explicit — it is never assumed.',
            fields: [
              { label: 'Version ID', name: 'id', widget: 'string', pattern: ['^[a-z0-9][a-z0-9_-]*$', 'Lowercase a-z, 0-9, - or _.'] },
              { label: 'Name', name: 'name', widget: 'string' },
              { label: 'Audio type', name: 'audioType', widget: 'select', default: 'studio', options: [
                { label: 'studio', value: 'studio' },
                { label: 'live', value: 'live' },
                { label: 'remix', value: 'remix' },
              ] },
              { label: 'Language override', name: 'language', widget: 'select', required: false, options: [
                { label: 'ko', value: 'ko' },
                { label: 'ja', value: 'ja' },
                { label: 'zh', value: 'zh' },
                { label: 'en', value: 'en' },
                { label: 'vi', value: 'vi' },
                { label: 'other', value: 'other' },
              ] },
              { label: 'YouTube', name: 'youtube', widget: 'string', required: false },
              { label: 'Members override', name: 'members', widget: 'list', collapsed: true, required: false, fields: memberRosterFields },
              { label: 'Sections', name: 'sections', widget: 'list', collapsed: true, fields: sectionFields },
              { label: 'Notes', name: 'notes', widget: 'list', field: { label: 'Note', name: 'value', widget: 'string' }, required: false },
            ],
          },
          { label: 'Notes', name: 'notes', widget: 'list', field: { label: 'Note', name: 'value', widget: 'string' }, required: false },
          { label: 'Sources', name: 'sources', widget: 'list', field: { label: 'Source', name: 'value', widget: 'string' }, required: false },
        ],
      },
      {
        name: 'artists',
        label: 'Artists',
        label_singular: 'Artist',
        folder: 'content/artists',
        format: 'json',
        slug: '{{id}}.json',
        summary_fields: ['name', 'type', 'debut'],
        fields: [
          { label: 'ID', name: 'id', widget: 'string', required: true, pattern: ['^[a-z0-9][a-z0-9_-]*$', 'Lowercase letters, digits, “-” or “_”.'] },
          { label: 'Name', name: 'name', widget: 'string', required: true },
          { label: 'Native name', name: 'nativeName', widget: 'string', required: false },
          { label: 'Romanized', name: 'romanized', widget: 'string', required: false },
          { label: 'Slug', name: 'slug', widget: 'string', required: true, pattern: ['^[a-z0-9]+(?:-[a-z0-9]+)*$', 'Lowercase, hyphen-separated.'] },
          { label: 'Type', name: 'type', widget: 'select', default: 'group', options: [
            { label: 'group', value: 'group' },
            { label: 'solo', value: 'solo' },
          ] },
          { label: 'Description', name: 'description', widget: 'text' },
          { label: 'Cover', name: 'cover', widget: 'image', required: false },
          { label: 'Debut', name: 'debut', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: '', required: false },
          { label: 'Label', name: 'label', widget: 'string', required: false },
          {
            label: 'Socials',
            name: 'socials',
            widget: 'list',
            collapsed: true,
            required: false,
            fields: [
              { label: 'Label', name: 'label', widget: 'string' },
              { label: 'URL', name: 'url', widget: 'string' },
            ],
          },
          {
            label: 'Members',
            name: 'members',
            widget: 'list',
            collapsed: true,
            fields: [
              { label: 'Member ID', name: 'id', widget: 'string', pattern: ['^[a-z0-9][a-z0-9_-]*$', 'Unique across ALL artists.'] },
              { label: 'Name', name: 'name', widget: 'string' },
              { label: 'Native name', name: 'nativeName', widget: 'string', required: false },
              { label: 'Romanized', name: 'romanized', widget: 'string', required: false },
              { label: 'Slug (optional)', name: 'slug', widget: 'string', required: false, pattern: ['^[a-z0-9]+(?:-[a-z0-9]+)*$', 'Defaults to the member ID.'] },
              { label: 'Color', name: 'color', widget: 'color' },
              { label: 'Official color', name: 'officialColor', widget: 'color', required: false },
              { label: 'Color source', name: 'colorSource', widget: 'string', required: false, hint: 'e.g. “official announcement” or “demo palette — replace”.' },
              { label: 'Role', name: 'role', widget: 'string', required: false },
              { label: 'Bio', name: 'bio', widget: 'text', required: false },
            ],
          },
          { label: 'Related artists (IDs)', name: 'relatedArtistIds', widget: 'list', field: { label: 'Artist ID', name: 'value', widget: 'string' }, required: false },
        ],
      },
      {
        name: 'categories',
        label: 'Categories',
        label_singular: 'Category',
        folder: 'content/categories',
        format: 'json',
        slug: '{{id}}.json',
        fields: [
          { label: 'ID', name: 'id', widget: 'string', required: true },
          { label: 'Name', name: 'name', widget: 'string', required: true },
          { label: 'Slug', name: 'slug', widget: 'string', required: true },
          { label: 'Description', name: 'description', widget: 'text', required: false },
        ],
      },
      {
        name: 'tags',
        label: 'Tags',
        label_singular: 'Tag',
        folder: 'content/tags',
        format: 'json',
        slug: '{{id}}.json',
        fields: [
          { label: 'ID', name: 'id', widget: 'string', required: true },
          { label: 'Name', name: 'name', widget: 'string', required: true },
          { label: 'Slug', name: 'slug', widget: 'string', required: true },
          { label: 'Description', name: 'description', widget: 'text', required: false },
        ],
      },
      {
        name: 'authors',
        label: 'Authors',
        label_singular: 'Author',
        folder: 'content/authors',
        format: 'json',
        slug: '{{id}}.json',
        fields: [
          { label: 'ID', name: 'id', widget: 'string', required: true },
          { label: 'Name', name: 'name', widget: 'string', required: true },
          { label: 'Slug', name: 'slug', widget: 'string', required: true },
          { label: 'Avatar', name: 'avatar', widget: 'image', required: false },
          { label: 'Bio', name: 'bio', widget: 'text', required: false },
          { label: 'Role', name: 'role', widget: 'select', default: 'editor', options: [
            { label: 'admin', value: 'admin' },
            { label: 'editor', value: 'editor' },
            { label: 'translator', value: 'translator' },
            { label: 'coder', value: 'coder' },
          ] },
          { label: 'Socials', name: 'socials', widget: 'list', collapsed: true, required: false, fields: [
            { label: 'Label', name: 'label', widget: 'string' },
            { label: 'URL', name: 'url', widget: 'string' },
          ] },
        ],
      },
      {
        name: 'translations',
        label: 'Translations',
        label_singular: 'Translation',
        folder: 'content/translations',
        format: 'json',
        slug: '{{id}}.json',
        summary_fields: ['songId', 'language', 'translator', 'status'],
        fields: [
          { label: 'ID', name: 'id', widget: 'string', required: true },
          { label: 'Song (ID)', name: 'songId', widget: 'string', required: true },
          { label: 'Language code', name: 'language', widget: 'string', required: true, hint: 'e.g. vi, es, id, en.' },
          { label: 'Language name', name: 'languageName', widget: 'string', required: false },
          { label: 'Translator', name: 'translator', widget: 'string', required: true, help: 'Mandatory: translations must credit their translator.' },
          { label: 'Translator URL', name: 'translatorUrl', widget: 'string', required: false },
          { label: 'Source URL', name: 'sourceUrl', widget: 'string', required: false },
          { label: 'Status', name: 'status', widget: 'select', default: 'submitted', options: [
            { label: 'submitted', value: 'submitted' },
            { label: 'reviewing', value: 'reviewing' },
            { label: 'approved', value: 'approved' },
            { label: 'rejected', value: 'rejected' },
          ] },
          { label: 'Submitted at', name: 'submittedAt', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: '' },
          { label: 'Reviewed at', name: 'reviewedAt', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: '', required: false },
          { label: 'Content', name: 'content', widget: 'text', required: true },
          { label: 'Notes', name: 'notes', widget: 'text', required: false },
        ],
      },
      {
        name: 'corrections',
        label: 'Corrections',
        label_singular: 'Correction',
        folder: 'content/corrections',
        format: 'json',
        slug: '{{id}}.json',
        summary_fields: ['title', 'status', 'createdAt'],
        fields: [
          { label: 'ID', name: 'id', widget: 'string', required: true },
          { label: 'Song (ID)', name: 'songId', widget: 'string', required: false },
          { label: 'Song URL', name: 'songUrl', widget: 'string', required: true },
          { label: 'Type', name: 'type', widget: 'select', default: 'lyrics', options: [
            { label: 'lyrics', value: 'lyrics' },
            { label: 'color-coding', value: 'color-coding' },
            { label: 'translation', value: 'translation' },
            { label: 'romanization', value: 'romanization' },
            { label: 'credits', value: 'credits' },
            { label: 'other', value: 'other' },
          ] },
          { label: 'Title', name: 'title', widget: 'string', required: true },
          { label: 'Issue', name: 'issue', widget: 'text', required: true },
          { label: 'Excerpt', name: 'excerpt', widget: 'string', required: false },
          { label: 'Suggestion', name: 'suggestion', widget: 'text', required: false },
          { label: 'Evidence', name: 'evidence', widget: 'string', required: false },
          { label: 'Reporter', name: 'reporter', widget: 'string', required: false },
          { label: 'Status', name: 'status', widget: 'select', default: 'open', options: [
            { label: 'open', value: 'open' },
            { label: 'reviewing', value: 'reviewing' },
            { label: 'accepted', value: 'accepted' },
            { label: 'applied', value: 'applied' },
            { label: 'rejected', value: 'rejected' },
          ] },
          { label: 'Created at', name: 'createdAt', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: '' },
          { label: 'Resolved at', name: 'resolvedAt', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: '', required: false },
          { label: 'Issue URL', name: 'issueUrl', widget: 'string', required: false },
          { label: 'Resolution', name: 'resolution', widget: 'text', required: false },
        ],
      },
      {
        name: 'comments',
        label: 'Comments',
        label_singular: 'Comment',
        folder: 'content/comments',
        format: 'json',
        slug: '{{id}}.json',
        summary_fields: ['name', 'status', 'createdAt'],
        fields: [
          { label: 'ID', name: 'id', widget: 'string', required: true },
          { label: 'Song (ID)', name: 'songId', widget: 'string', required: true },
          { label: 'Name', name: 'name', widget: 'string', required: true },
          { label: 'Content', name: 'content', widget: 'text', required: true },
          { label: 'Created at', name: 'createdAt', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: '' },
          { label: 'Status', name: 'status', widget: 'select', default: 'pending', options: [
            { label: 'pending', value: 'pending' },
            { label: 'approved', value: 'approved' },
            { label: 'spam', value: 'spam' },
            { label: 'trash', value: 'trash' },
          ] },
          { label: 'Issue URL', name: 'issueUrl', widget: 'string', required: false },
        ],
      },
      {
        name: 'pages',
        label: 'Pages',
        label_singular: 'Page',
        folder: 'content/pages',
        format: 'markdown',
        slug: '{{slug}}.md',
        summary_fields: ['title', 'updated'],
        fields: [
          { label: 'Title', name: 'title', widget: 'string', required: true },
          { label: 'Description', name: 'description', widget: 'text', required: false },
          { label: 'Updated', name: 'updated', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: '', required: false },
          { label: 'Show in footer', name: 'inFooter', widget: 'boolean', default: false },
          { label: 'Order', name: 'order', widget: 'number', default: 100, required: false },
          { label: 'Body', name: 'body', widget: 'markdown' },
        ],
      },
      {
        name: 'settings',
        label: 'Site settings',
        files: [
          {
            name: 'site',
            label: 'Site',
            file: 'content/settings/site.json',
            format: 'json',
            fields: [
              { label: 'Name', name: 'name', widget: 'string' },
              { label: 'Tagline', name: 'tagline', widget: 'string' },
              { label: 'Description', name: 'description', widget: 'text' },
              { label: 'Locale', name: 'locale', widget: 'string' },
              { label: 'OG image', name: 'ogImage', widget: 'image', required: false },
              { label: 'Trending songs (IDs)', name: 'trendingSongIds', widget: 'list', field: { label: 'Song ID', name: 'value', widget: 'string' }, required: false },
              { label: 'Popular artists (IDs)', name: 'popularArtistIds', widget: 'list', field: { label: 'Artist ID', name: 'value', widget: 'string' }, required: false },
              { label: 'Songs per page', name: 'songsPerPage', widget: 'number', default: 9 },
              { label: 'Socials', name: 'socials', widget: 'list', collapsed: true, required: false, fields: [
                { label: 'Label', name: 'label', widget: 'string' },
                { label: 'URL', name: 'url', widget: 'string' },
              ] },
              { label: 'Footer note', name: 'footerNote', widget: 'text', required: false },
            ],
          },
        ],
      },
    ],
  };
}
