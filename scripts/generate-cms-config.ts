/**
 * Regenerates the committed Decap CMS template `admin/config.yml` from the
 * current content (artist/category/tag/author IDs for the select fields).
 *
 * Usage: npm run cms:generate
 *
 * NOTE: the file DEPLOYED at /admin/config.yml is generated at build time
 * (src/pages/admin/config.yml.ts) and also picks up the backend env vars;
 * this script only refreshes the committed template, which always describes
 * the Decap Turbo default.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { buildCmsConfig } from '../src/lib/cms-config';
import {
  IssueCollector,
  crossValidate,
  formatIssue,
  isRecord,
  parseArtist,
  parseAuthor,
  parseCategory,
  parseTag,
} from '../src/lib/validate';
import { readdirSync, readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadDir(rel: string, parser: (raw: unknown, file: string, c: IssueCollector, stem: string) => unknown | null): unknown[] {
  const dir = join(root, 'content', rel);
  const c = new IssueCollector();
  const out: unknown[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
    } catch (err) {
      c.error(`${rel}/${file}`, `Invalid JSON — ${(err as Error).message}`);
      continue;
    }
    if (!isRecord(data)) continue;
    const parsed = parser(data, `${rel}/${file}`, c, file.replace(/\.json$/, ''));
    if (parsed) out.push(parsed);
  }
  for (const issue of c.issues) console.warn(formatIssue(issue));
  return out;
}

const c = new IssueCollector();
const artists = loadDir('artists', parseArtist) as import('../src/lib/types').Artist[];
const categories = loadDir('categories', parseCategory) as import('../src/lib/types').Category[];
const tags = loadDir('tags', parseTag) as import('../src/lib/types').Tag[];
const authors = loadDir('authors', parseAuthor) as import('../src/lib/types').Author[];

// Same cross-checks as the site build (keeps the template honest).
const bundle = crossValidate(
  {
    artists,
    songs: [],
    categories,
    tags,
    authors,
    translations: [],
    corrections: [],
    comments: [],
    settings: {
      name: 'x', tagline: 'x', description: 'x', locale: 'en', ogImage: '', trendingSongIds: [], popularArtistIds: [], songsPerPage: 9, socials: [], footerNote: '',
    },
  },
  { artists: new Map(), songs: new Map() },
  c,
);

const config = buildCmsConfig({
  artists: bundle.artists,
  categories: bundle.categories,
  tags: bundle.tags,
  authors: bundle.authors,
  siteUrl: 'https://YOUR_DOMAIN',
  config: {
    backend: 'turbo-github',
    turboSiteId: 'YOUR_TURBO_SITE_ID',
    branch: 'main',
    oauthAuthEndpoint: 'auth',
    localBackend: false,
  },
});

const header = `# Decap CMS configuration — committed template.
#
# The configuration DEPLOYED at /admin/config.yml is generated at build time
# from environment variables (see .env.example):
#   - default backend: Decap Turbo  (CMS_BACKEND=turbo-github)
#   - fallback backend: self-hosted GitHub OAuth Worker
#                      (CMS_BACKEND=github + CMS_OAUTH_BASE_URL)
# Regenerate this template after adding/removing artists, categories, tags
# or authors:  npm run cms:generate
#
`;
const target = join(root, 'admin', 'config.yml');
writeFileSync(target, header + stringify(config));
console.log(`Wrote ${target}`);
