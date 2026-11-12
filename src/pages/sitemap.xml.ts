import type { APIRoute } from 'astro';
import { getArtists, getPublishedSongs } from '../lib/content';
import { absoluteUrl } from '../lib/config';

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = () => {
  const staticPages = ['/', '/search/', '/corrections/', '/content-policy/'];
  const songPages = getPublishedSongs().map((s) => `/lyrics/${s.slug}/`);
  const artistPages = getArtists().map((a) => `/artist/${a.slug}/`);
  const memberPages = getArtists().flatMap((a) => (a.members ?? []).map((m) => `/member/${m.id}/`));

  const urls = [...staticPages, ...songPages, ...artistPages, ...memberPages];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (path) => `  <url>
    <loc>${escapeXml(absoluteUrl(path))}</loc>
    <changefreq>weekly</changefreq>
    <priority>${path === '/' ? '1.0' : '0.7'}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
