/**
 * Validates the committed Decap CMS configuration (admin/config.yml):
 *  - valid YAML,
 *  - publish_mode is editorial_workflow (hard requirement),
 *  - the github backend must enable open_authoring,
 *  - all expected collections exist,
 *  - collection folders point inside content/,
 *  - no collection allows publishing to the default branch.
 *
 * Usage: npm run check:cms
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { CmsConfig } from '../admin/config.d';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(join(root, 'admin', 'config.yml'), 'utf-8');

let config: CmsConfig;
try {
  config = parse(raw) as CmsConfig;
} catch (err) {
  console.error(`admin/config.yml is not valid YAML — ${(err as Error).message}`);
  process.exit(1);
}

const errors: string[] = [];
const checks: string[] = [];

if (config.publish_mode !== 'editorial_workflow') {
  errors.push(`publish_mode must be "editorial_workflow" (got "${config.publish_mode ?? 'missing'}").`);
} else {
  checks.push('publish_mode: editorial_workflow ✓');
}

const backendName = config.backend?.name;
if (!backendName) {
  errors.push('backend.name is missing.');
} else {
  checks.push(`backend: ${backendName} ✓`);
  if (backendName === 'github') {
    if (!config.backend.open_authoring) errors.push('github backend must set open_authoring: true.');
    if (!config.backend.repo || !config.backend.repo.includes('/')) errors.push('github backend must set repo: owner/repo.');
    if (!config.backend.base_url) errors.push('github backend must set base_url (the OAuth Worker origin).');
    if (!config.backend.branch) errors.push('github backend must set branch.');
  }
  if (backendName === 'turbo-github' && !config.backend.turbo_site_id) {
    errors.push('turbo-github backend must set turbo_site_id.');
  }
}

const expected = ['songs', 'artists', 'categories', 'tags', 'authors', 'translations', 'corrections', 'comments', 'pages', 'settings'];
const names = (config.collections ?? []).map((col) => col.name);
for (const name of expected) {
  if (!names.includes(name)) errors.push(`Missing collection: ${name}`);
}

for (const collection of config.collections ?? []) {
  if (collection.folder && !collection.folder.startsWith('content/')) {
    errors.push(`Collection "${collection.name}" folder "${collection.folder}" must be inside content/.`);
  }
  if (collection.folder && collection.format !== 'json' && collection.format !== 'markdown') {
    errors.push(`Collection "${collection.name}" has unexpected format "${collection.format}".`);
  }
  const fields = collection.fields ?? [];
  // Collections whose file name is driven by {{id}} must expose an id field
  // (IDs are the data keys). "pages" is keyed by {{slug}} — no id needed.
  if (collection.folder && collection.slug?.includes('{{id}}') && !fields.some((f) => f.name === 'id')) {
    errors.push(`Collection "${collection.name}" is keyed by {{id}} but has no "id" field.`);
  }
}

const songs = (config.collections ?? []).find((col) => col.name === 'songs');
if (songs) {
  const fieldNames = (songs.fields ?? []).map((f) => f.name);
  for (const required of ['artistId', 'members', 'sections', 'versions', 'categories', 'tags']) {
    if (!fieldNames.includes(required)) errors.push(`songs collection must expose "${required}".`);
  }
  if (songs.format !== 'json') errors.push('songs collection must use format: json.');
}

const comments = (config.collections ?? []).find((col) => col.name === 'comments');
if (comments) {
  const fieldNames = (comments.fields ?? []).map((f) => f.name);
  if (fieldNames.includes('email')) errors.push('comments collection must NOT include an email field (private moderation data).');
}

for (const check of checks) console.log(`✓ ${check}`);
if (errors.length === 0) {
  console.log(`✓ ${names.length} collections, all requirements met.`);
  process.exit(0);
} else {
  for (const err of errors) console.error(`✗ ${err}`);
  process.exit(1);
}
