# Chaereve — Color-Coded Lyrics Website

A modern, easy-to-use color-coded lyrics site: romanization, original lyrics and
translation in aligned columns, every member's lines in their color.

Inspired by the convenience of [colorcodedlyrics.com](https://colorcodedlyrics.com/)
(artist index, one page per song, credits up front) with a modern editorial dark
UI — plus a light theme, instant search and a fully responsive layout.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Featured release, trending, latest lyrics with language filters |
| `artists.html` | A–Z artist index with instant filter |
| `artists/<slug>.html` | Artist page — bio, members, all their songs |
| `songs/<slug>.html` | Song page — info block + color-coded lyrics |
| `faq.html` | FAQ accordion |
| `search.html` | Full search (works with `?q=`) |
| `feed.xml` | RSS feed of new lyrics |
| `404.html` | Not-found page |

Song requests live on the separate request app: **https://chaereve.pages.dev/**
(linked from the navbar and footer).

## Song page features

- Three aligned columns: **Romanization / Original / Translation**
- **Member legend** — click a name to spotlight that member's lines
- Section spacing (Verse / Chorus / …) kept quiet, the way the mockup shows it
- Credits line, prev/next song, more-by-artist grid
- Light & dark theme, responsive (stacked lyrics with column labels on mobile)

## Project layout

```
data/site.json     ← ALL content lives here (artists, songs, lyrics, FAQ)
tools/build.py     ← static site generator (Python 3, no dependencies)
tools/serve.py     ← local preview server with proper 404 handling
assets/css/main.css
assets/css/fonts.css + assets/fonts/  ← self-hosted fonts (OFL), no Google Fonts dependency
assets/js/site.js  ← theme, search, filters, lyric spotlight
assets/js/search-index.js  ← generated from data/site.json
index.html, songs/, artists/, …  ← generated pages (host these)
```

## Editing content

1. Edit `data/site.json` — add an artist or a song, paste lyrics as
   `{"who": "Hana", "rom": "…", "orig": "…", "eng": "…"}` with `{"part": "Chorus"}`
   markers between sections.
2. Regenerate the site:

   ```bash
   python3 tools/build.py
   ```

3. Preview locally:

   ```bash
   python3 -m http.server 8000
   # open http://localhost:8000
   ```

The generated pages are plain static HTML — deploy anywhere (GitHub Pages from
the repo root works out of the box). Set `BASE_URL` in `tools/build.py` to your
final URL so `feed.xml` links resolve.

> Demo note: artists, songs and lyrics in `data/site.json` are fictional sample
> content (as in the original mockup) — swap in real data as it is approved.

## Credits

Design and code for the Chaereve site. Fan translations published on the site
are always credited to their authors.
