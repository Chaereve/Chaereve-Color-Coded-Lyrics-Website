/**
 * /rss.xml — RSS 2.0 feed of the lyrics archive (newest first).
 */
import rss from '@astrojs/rss';
import { getArtist, getSite, songUrl } from '../lib/content';
import { languageName, truncate } from '../lib/text';
import type { APIContext } from 'astro';

export const GET = async (context: APIContext) => {
  const { songs, settings } = getSite();
  return rss({
    title: settings.name,
    description: settings.description,
    site: context.site ?? 'http://localhost:4321',
    trailingSlash: true,
    items: songs.map((song) => {
      const artist = getArtist(song.artistId);
      const categories = song.categories
        .map((id) => getSite().categories.find((c) => c.id === id)?.name)
        .filter((n): n is string => Boolean(n));
      return {
        title: `${song.title} — ${artist?.name ?? song.artistId}`,
        description: truncate(
          `Color-coded lyrics: ${languageName(song.language)}${song.album ? `, album ${song.album}` : ''}, ${song.released}.`,
          200,
        ),
        pubDate: new Date(`${song.createdAt || song.released}T00:00:00Z`),
        link: songUrl(song, artist),
        categories,
      };
    }),
  });
};
