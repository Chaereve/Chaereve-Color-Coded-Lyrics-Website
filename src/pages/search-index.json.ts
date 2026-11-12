/**
 * /search-index.json — the build-time client-side search index
 * (title, native title, artist, members, album, lyrics, romanization,
 * translation — pre-normalised for accent-insensitive matching).
 */
import { buildSearchIndex } from '../lib/search-index';

export const GET = () => {
  const index = buildSearchIndex();
  return new Response(JSON.stringify(index), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
};
