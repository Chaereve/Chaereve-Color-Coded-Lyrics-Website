/**
 * Generates `src/styles/member-colors.generated.css`:
 *  - one CSS variable per member id (`--m-<id>`) with a light-mode and a
 *    dark-mode value, each adjusted to meet WCAG AA contrast against the
 *    site background (src/lib/color.ts);
 *  - scoped overrides (`.vcss-<versionId>`) for song versions that override
 *    the member roster/colors.
 *
 * Run automatically at dev/build setup (astro.config.mjs) and manually with
 * `npm run colors`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cssIdent } from '../src/lib/text';
import { themedColor } from '../src/lib/color';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJsonDir(rel: string): Record<string, unknown>[] {
  const dir = join(root, 'content', rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf-8'));
      } catch {
        return {};
      }
    });
}

interface MemberRef {
  id: string;
  color: string;
}

function memberRefs(raw: unknown): MemberRef[] {
  if (!Array.isArray(raw)) return [];
  const out: MemberRef[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object' && typeof item.id === 'string' && typeof item.color === 'string') {
      out.push({ id: item.id, color: item.color });
    }
  }
  return out;
}

const members = new Map<string, string>(); // memberId -> canonical color
const versionScopes = new Map<string, Map<string, string>>(); // versionId -> (memberId -> color)

for (const artist of readJsonDir('artists')) {
  for (const m of memberRefs(artist.members)) members.set(m.id, m.color);
}
for (const song of readJsonDir('songs')) {
  for (const m of memberRefs(song.members)) members.set(m.id, m.color);
  if (Array.isArray(song.versions)) {
    for (const version of song.versions) {
      if (!version || typeof version !== 'object') continue;
      const overrides = memberRefs(version.members);
      if (overrides.length > 0 && typeof version.id === 'string') {
        const scope = new Map<string, string>();
        for (const m of overrides) scope.set(m.id, m.color);
        versionScopes.set(version.id, scope);
      }
    }
  }
}

const lightRules: string[] = [];
const darkRules: string[] = [];
for (const [id, color] of members) {
  const themed = themedColor(color);
  lightRules.push(`--m-${cssIdent(id)}:${themed.light}`);
  darkRules.push(`--m-${cssIdent(id)}:${themed.dark}`);
}

const scopeBlocks: string[] = [];
for (const [versionId, scope] of versionScopes) {
  const light: string[] = [];
  const dark: string[] = [];
  for (const [id, color] of scope) {
    const themed = themedColor(color);
    light.push(`--m-${cssIdent(id)}:${themed.light}`);
    dark.push(`--m-${cssIdent(id)}:${themed.dark}`);
  }
  scopeBlocks.push(`.vcss-${cssIdent(versionId)}{${light.join(';')}}`);
  scopeBlocks.push(`[data-theme="dark"] .vcss-${cssIdent(versionId)}{${dark.join(';')}}`);
}

const css = `/* GENERATED FILE — do not edit. Written by scripts/generate-member-colors.ts
 * (runs automatically at dev/build setup; manual: npm run colors).
 *
 * Each member color is adjusted per theme to keep colored lyric TEXT readable
 * (WCAG AA 4.5:1 on the light and dark backgrounds, src/lib/color.ts). */
:root{${lightRules.join(';')}}
[data-theme="dark"]{${darkRules.join(';')}}
${scopeBlocks.join('\n')}
`;

const target = join(root, 'src', 'styles', 'member-colors.generated.css');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, css);
console.log(`member-colors: ${members.size} members, ${versionScopes.size} version scope(s) → ${target}`);
