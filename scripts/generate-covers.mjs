// Generates the placeholder cover images (SVG) used by the sample content.
// Run: npm run covers  (writes to public/uploads/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)).replace(/scripts$/, '');
const outDir = join(root, 'public', 'uploads');
mkdirSync(outDir, { recursive: true });

/** Deterministic 2-color gradient from a seed string. */
function palette(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const hue = (n) => `hsl(${(h + n) % 360} 72% 52%)`;
  return [hue(0), hue(150)];
}

function cover({ file, title, subtitle, seed, initial, w = 900, h = 900 }) {
  const [c1, c2] = palette(seed);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <g fill="#ffffff" opacity="0.10">
    ${Array.from({ length: 5 }, (_, i) => `<circle cx="${w * 0.82}" cy="${h * (0.08 + i * 0.09)}" r="${14 - i * 2}"/>`).join('\n    ')}
  </g>
  <text x="50%" y="46%" text-anchor="middle" dominant-baseline="middle" font-family="Inter, 'Noto Sans', sans-serif" font-weight="800" font-size="${Math.round(h * 0.34)}" fill="#ffffff">${escapeXml(initial)}</text>
  <text x="50%" y="76%" text-anchor="middle" font-family="Inter, 'Noto Sans', sans-serif" font-weight="600" font-size="${Math.round(h * 0.055)}" fill="#ffffff" opacity="0.92">${escapeXml(truncate(title, 34))}</text>
  <text x="50%" y="83%" text-anchor="middle" font-family="Inter, 'Noto Sans', sans-serif" font-weight="400" font-size="${Math.round(h * 0.038)}" fill="#ffffff" opacity="0.7">${escapeXml(subtitle)}</text>
</svg>
`;
  writeFileSync(join(outDir, file), svg);
  console.log('wrote public/uploads/' + file);
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

cover({ file: 'cover-ive.svg', title: 'IVE', subtitle: 'Sample data — demo palette', seed: 'ive', initial: 'IV' });
cover({ file: 'cover-lumi.svg', title: 'LUMI', subtitle: 'Fictional artist (sample data)', seed: 'lumi', initial: 'LU' });
cover({ file: 'cover-juna.svg', title: 'Juna', subtitle: 'Fictional artist (sample data)', seed: 'juna', initial: 'J' });
cover({ file: 'cover-ive-crumbs.svg', title: 'Crumbs', subtitle: 'IVE — demo lyrics', seed: 'ive-crumbs', initial: 'C' });
cover({ file: 'cover-ive-kitsch.svg', title: 'Kitsch', subtitle: 'IVE — demo lyrics', seed: 'ive-kitsch', initial: 'K' });
cover({ file: 'cover-lumi-first-light.svg', title: 'First Light', subtitle: 'LUMI — fictional song', seed: 'lumi-first-light', initial: 'F' });
cover({ file: 'cover-lumi-neon-rain.svg', title: 'Neon Rain', subtitle: 'LUMI — fictional song', seed: 'lumi-neon-rain', initial: 'N' });
cover({ file: 'cover-juna-mua-he.svg', title: 'Mùa hè', subtitle: 'Juna ft. LUMI — fictional song', seed: 'juna-mua-he', initial: 'M' });
cover({ file: 'cover-lumi-clover.svg', title: 'Clover', subtitle: 'LUMI — fictional song', seed: 'lumi-clover', initial: 'Cl' });

// Open Graph default (1200x630)
const [c1, c2] = palette('chaereve');
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="Chaereve Lyrics">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="64" y="300" font-family="Inter, 'Noto Sans', sans-serif" font-weight="800" font-size="110" fill="#ffffff">Chaereve Lyrics</text>
  <text x="64" y="372" font-family="Inter, 'Noto Sans', sans-serif" font-weight="400" font-size="40" fill="#ffffff" opacity="0.85">Color-coded lyrics with line distribution</text>
</svg>
`;
writeFileSync(join(outDir, 'og-default.svg'), og);
console.log('wrote public/uploads/og-default.svg');
