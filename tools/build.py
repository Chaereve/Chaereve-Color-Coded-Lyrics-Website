#!/usr/bin/env python3
"""Chaereve static site generator.

Edit data/site.json, then run:  python3 tools/build.py
Every page in the repo root (index.html, songs/…, artists/…) is regenerated.
"""
import json
import html
import pathlib
import datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "data" / "site.json").read_text(encoding="utf-8"))
SITE = DATA["site"]
BASE_URL = "https://chaereve.github.io/Chaereve-Color-Coded-Lyrics-Website"  # adjust when deploying

MONTHS = ["January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"]


# ---------------------------------------------------------------- helpers
def esc(s):
    return html.escape(str(s), quote=True)


def fmt_long(iso):
    y, m, d = (int(x) for x in iso.split("-"))
    return f"{MONTHS[m - 1]} {d}, {y}"


def fmt_short(iso):
    y, m, d = (int(x) for x in iso.split("-"))
    return f"{MONTHS[m - 1][:3]} {d}"


def fmt_dot(iso):
    return iso.replace("-", ".")


ARTISTS = {a["slug"]: a for a in DATA["artists"]}
SONGS = {s["slug"]: s for s in DATA["songs"]}
SONG_LIST = sorted(DATA["songs"], key=lambda s: s["release"], reverse=True)


def artist_of(song):
    return ARTISTS[song["artist"]]


def member_style(artist, who):
    """Return (style, who_label, is_all) for a lyric line."""
    if who == "All" or who is None:
        return ' style="--c:#F2F2F5;--cl:#22201C"', "All", True
    name = who.split(",")[0].strip()
    for m in artist["members"]:
        if m["name"] == name:
            return f' style="--c:{m["color"]};--cl:{m["colorLight"]}"', who, False
    return ' style="--c:#F2F2F5;--cl:#22201C"', who, False


def cover_html(cover, extra=""):
    k = cover.get("k", "")
    cls = f"cv {k}".strip()
    if extra:
        cls += " " + extra
    return (f'<div class="{cls}" style="--bg:{cover["bg"]};'
            f'--a:{cover["a"]};--b:{cover["b"]}"></div>')


# ---------------------------------------------------------------- chrome
def head(title, desc, prefix):
    return f'''<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="website">
<link rel="icon" href="{prefix}assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="{esc(SITE['name'])} RSS" href="{prefix}feed.xml">
<link rel="stylesheet" href="{prefix}assets/css/fonts.css">
<link rel="stylesheet" href="{prefix}assets/css/main.css">
<script>
(function () {{
  try {{
    var t = localStorage.getItem("chaereve-theme");
    if (!t) t = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
  }} catch (e) {{}}
}})();
</script>
</head>
'''


NAV = [("Index", "artists.html", False), ("Requests", "https://chaereve.pages.dev/", True),
       ("FAQ", "faq.html", False)]


def header(prefix, page):
    items = []
    for label, href, ext in NAV:
        if ext:
            items.append(f'<a class="ext" href="{href}" target="_blank" rel="noopener">{label}'
                         '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>')
        else:
            cur = ' aria-current="page"' if href.startswith(page) else ""
            items.append(f'<a href="{prefix}{href}"{cur}>{label}</a>')
    links = "".join(items)
    return f'''<a class="skip" href="#main">Skip to content</a>
<header class="bar">
  <div class="w">
    <a class="logo" href="{prefix}index.html">{esc(SITE['name'])}</a>
    <div class="search-wrap">
      <svg class="srch-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input class="srch" id="siteSearch" type="search" autocomplete="off"
             aria-label="Search songs or artists" placeholder="Search songs or artists">
      <div class="search-drop" id="searchDrop" hidden></div>
    </div>
    <nav class="lk" id="mainNav" aria-label="Main">{links}</nav>
    <button class="icon-btn" id="themeToggle" aria-label="Toggle color theme">
      <svg class="i-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>
      <svg class="i-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    </button>
    <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu" aria-expanded="false">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </div>
</header>
'''


def footer(prefix):
    return f'''<footer class="foot">
  <div class="w foot-in">
    <div class="foot-brand">
      <b>{esc(SITE['name'])}</b>
      <span class="mu">Fan translations, credited to their authors</span>
    </div>
    <nav class="foot-links" aria-label="Footer">
      <a href="{prefix}index.html">Home</a>
      <a href="{prefix}artists.html">Index</a>
      <a href="https://chaereve.pages.dev/" target="_blank" rel="noopener">Requests ↗</a>
      <a href="{prefix}faq.html">FAQ</a>
      <a href="{prefix}feed.xml">RSS</a>
      <a href="{esc(SITE['github'])}" target="_blank" rel="noopener">GitHub ↗</a>
    </nav>
  </div>
  <div class="w foot-legal">© 2026 {esc(SITE['name'])}. All rights reserved.</div>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
<script src="{prefix}assets/js/search-index.js"></script>
<script src="{prefix}assets/js/site.js" defer></script>
</body>
</html>
'''


def render(out_rel, *, title, desc, page, body, prefix=""):
    html_doc = head(title, desc, prefix) + f'<body data-page="{page}" data-prefix="{prefix}">\n' + header(prefix, page) + body + footer(prefix)
    path = ROOT / out_rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html_doc, encoding="utf-8")
    return out_rel


# ---------------------------------------------------------------- pieces
def song_card(song, prefix, show_date=False):
    a = artist_of(song)
    return f'''<a class="card" href="{prefix}songs/{song['slug']}.html" data-lang="{esc(song['language'])}">
{cover_html(song['cover'])}
<b>{esc(song['title'])}</b>
<span>{esc(a['name'])}</span>
</a>'''


def trend_row(song, rank, prefix):
    a = artist_of(song)
    return f'''<a class="rk" href="{prefix}songs/{song['slug']}.html">
<i>{rank}</i>
{cover_html(song['cover'])}
<div><b>{esc(song['title'])}</b><span>{esc(a['name'])}</span></div>
</a>'''


def legend_html(artist, interactive):
    """Mockup-style legend: plain colored text names (clickable when interactive)."""
    out = []
    for m in artist["members"]:
        tag = "button" if interactive else "span"
        cls = "chip" + ("" if interactive else " static")
        out.append(
            f'<{tag} class="{cls}" data-spot="{esc(m["name"])}" '
            f'style="--c:{m["color"]};--cl:{m["colorLight"]}">{esc(m["name"])}</{tag}>')
    out.append(
        f'<{"button" if interactive else "span"} class="chip chip-all{" on" if interactive else ""}" '
        f'data-spot="" style="--c:#F2F2F5;--cl:#22201C">All</{"button" if interactive else "span"}>')
    return "".join(out)


def lyrics_html(song):
    """CCL-style lyrics: separate full sections per language (Romanization / Hangul /
    Translation), each the complete song, colored per member, group breaks by spacing."""
    a = artist_of(song)
    lines = song["lyrics"]
    orig_label = "Hangul" if song.get("language") == "Korean" else "Original"
    sections = [("rom", "Romanization"), ("orig", orig_label), ("eng", "Translation")]

    blocks = []
    for key, label in sections:
        if not any(l.get(key) for l in lines if "part" not in l):
            continue
        rows = []
        pending_part = None
        first = True
        for l in lines:
            if "part" in l:
                pending_part = l["part"]
                continue
            text = l.get(key, "")
            if not text:
                continue
            style, _, is_all = member_style(a, l.get("who", "All"))
            cls = "lr line" + (" all" if is_all else "")
            if pending_part is not None:
                if not first:
                    cls += " g"
                part_attr = f' data-part="{esc(pending_part)}"'
                pending_part = None
            else:
                part_attr = ""
            first = False
            rows.append(
                f'<div class="{cls}" data-who="{esc(l.get("who", "All"))}"{part_attr}{style}>'
                f"{esc(text)}</div>")
        blocks.append(
            f'<div class="lyr-block"><h3 class="lyr-sec">{esc(label)}</h3>'
            f'<div class="lyr" data-lang="{key}">{"".join(rows)}</div></div>')

    c = song["credits"]
    credits = (
        '<div class="lyr-block"><h3 class="lyr-sec">Credits</h3>'
        '<p class="credits">'
        f'{esc(song["language"])}: {linkify(c["source"])}<br>'
        f'Romanization: {esc(c["translation"])}<br>'
        f'Translation: {esc(c["translation"])}'
        '</p></div>')

    return f'''<div class="lyr-wrap" data-song="{song['slug']}">
<div class="ctl">
  <div class="lg">{legend_html(a, True)}</div>
</div>
{"".join(blocks)}
{credits}
</div>'''


# ---------------------------------------------------------------- pages
def page_home():
    feat = SONGS[DATA["featured"]]
    fa = artist_of(feat)
    trending = "".join(trend_row(SONGS[s], i + 1, "") for i, s in enumerate(DATA["trending"]))
    cards = "".join(song_card(s, "") for s in SONG_LIST)
    tabs = "".join(
        f'<button class="{"on" if i == 0 else ""}" data-filter="{esc(lang)}">{esc(lang)}</button>'
        for i, lang in enumerate(DATA["languages"]))
    body = f'''<main class="w" id="main">
<div class="top">
  <section class="ft" aria-label="Newest release">
    <a href="songs/{feat['slug']}.html" aria-label="{esc(feat['title'])}">{cover_html(feat['cover'])}</a>
    <div>
      <div class="mu mono">newest release</div>
      <h1>{esc(feat['title'])}</h1>
      <div class="ft-artist">{esc(fa['name'])}</div>
      <a class="btn" href="songs/{feat['slug']}.html">View lyrics</a>
    </div>
  </section>
  <section class="trend" aria-label="Trending">
    <h2>Trending</h2>
    {trending}
  </section>
</div>
<div class="sh">
  <h2>Latest lyrics</h2>
  <nav class="tabs" aria-label="Filter by language">{tabs}</nav>
</div>
<div class="grid" id="songGrid">{cards}</div>
<div class="older" id="olderWrap"><button class="older-link" id="olderBtn">Older posts →</button></div>
</main>'''
    return render("index.html", title=f"{SITE['name']} — {SITE['tagline']}",
                  desc=SITE["description"], page="index.html", body=body)


def page_artists():
    letters = {}
    for a in DATA["artists"]:
        letters.setdefault(a["name"][0].upper(), []).append(a)
    jump = "".join(f'<a href="#L{ch}">{ch}</a>' for ch in sorted(letters))
    sections = []
    for ch in sorted(letters):
        rows = []
        for a in sorted(letters[ch], key=lambda x: x["name"]):
            n = sum(1 for s in DATA["songs"] if s["artist"] == a["slug"])
            rows.append(f'''<a class="idx-row" href="artists/{a['slug']}.html" data-name="{esc(a['name'].lower())} {esc(a.get('native','').lower())}">
{cover_html(a['cover'])}
<div class="idx-main">
  <b>{esc(a['name'])}</b>
  <span class="mu">{esc(a.get('native', ''))}</span>
</div>
<span class="tag">{esc(a['type'])} · {esc(a['language'])}</span>
<span class="idx-count mono">{n} song{'s' if n != 1 else ''}</span>
</a>''')
        sections.append(f'<section class="idx-sec"><h2 id="L{ch}">{ch}</h2>{"".join(rows)}</section>')
    body = f'''<main class="w" id="main">
<div class="page-head">
  <h1>Artist index</h1>
  <p class="mu">Every artist on {esc(SITE['name'])}, A–Z. Follow an artist to see all their color-coded lyrics.</p>
</div>
<div class="idx-filter">
  <input class="srch wide" id="idxFilter" type="search" placeholder="Filter artists…" aria-label="Filter artists">
</div>
<nav class="idx-jump mono" aria-label="Jump to letter">{jump}</nav>
{"".join(sections)}
</main>'''
    return render("artists.html", title=f"Artist index · {SITE['name']}",
                  desc="All artists on Chaereve, A–Z.", page="artists.html", body=body)


def page_artist(a):
    prefix = "../"
    songs = [s for s in SONG_LIST if s["artist"] == a["slug"]]
    cards = "".join(song_card(s, prefix) for s in songs)
    members = legend_html(a, False)
    body = f'''<main class="w" id="main">
<div class="mu mono crumb"><a href="{prefix}artists.html">Index</a> · {esc(a['type'])} · {esc(a['language'])}</div>
<h1 class="page-title">{esc(a['name'])}</h1>
<div class="mu mono">{esc(a.get('native', ''))}</div>
<div class="artist-top">
  {cover_html(a['cover'], 'artist-cv')}
  <div>
    <p class="bio">{esc(a['bio'])}</p>
    <div class="lg static-legend">{members}</div>
  </div>
</div>
<div class="sh"><h2>Songs by {esc(a['name'])}</h2></div>
<div class="grid">{cards}</div>
<div style="margin:56px 0 48px"><a class="mu older-link" href="{prefix}artists.html">← All artists</a></div>
</main>'''
    return render(f"artists/{a['slug']}.html",
                  title=f"{a['name']} lyrics · {SITE['name']}",
                  desc=f"Color-coded lyrics for every {a['name']} song on Chaereve.",
                  page="artists.html", body=body, prefix=prefix)


def page_song(s):
    prefix = "../"
    a = artist_of(s)
    album = f"{s['albumType']} · {s['albumTracks']} track{'s' if s['albumTracks'] != 1 else ''}"
    c = s["credits"]
    dl = [("Released", fmt_dot(s["release"])), ("Duration", s["duration"]),
          ("Language", s["language"]), ("Genre", s["genre"]),
          ("Lyrics", c["lyrics"]), ("Composer", c["composer"])]
    dl_html = "".join(f"<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>" for k, v in dl)

    more = [x for x in SONG_LIST if x["artist"] == a["slug"] and x["slug"] != s["slug"]][:4]
    more_html = "".join(
        f'<a class="mg-item" href="{prefix}songs/{x["slug"]}.html">{cover_html(x["cover"])}'
        f'<b>{esc(x["title"])}</b></a>' for x in more)
    more_block = f'<h2 class="sec-h">More by {esc(a["name"])}</h2><div class="mg">{more_html}</div>' if more else ""

    idx = SONG_LIST.index(s)
    newer = SONG_LIST[idx - 1] if idx > 0 else None
    older = SONG_LIST[idx + 1] if idx < len(SONG_LIST) - 1 else None
    left = (f'<a href="{prefix}songs/{newer["slug"]}.html">← {esc(artist_of(newer)["name"])} – {esc(newer["title"])}</a>'
            if newer else "<span></span>")
    right = (f'<a href="{prefix}songs/{older["slug"]}.html">{esc(artist_of(older)["name"])} – {esc(older["title"])} →</a>'
             if older else "<span></span>")

    body = f'''<main class="w" id="main">
<div class="mu mono crumb"><a href="{prefix}artists.html">{esc(s['language'])}</a> · <a href="{prefix}artists/{a['slug']}.html">{esc(a['name'])}</a></div>
<h1 class="page-title">{esc(a['name'])} – {esc(s['title'])}</h1>
<div class="mu mono">{fmt_long(s['release'])} · by {esc(s['coloredBy'])}</div>
<div class="top song-top">
  <div class="vid" role="img" aria-label="Video placeholder">
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="currentColor" opacity=".9"/><path d="M20 14v20l16-10z" fill="var(--bg)"/></svg>
  </div>
  <div class="meta">
    <div class="alb">
      {cover_html(s['cover'])}
      <div><b>{esc(s['album'])}</b><span>{esc(album)}</span></div>
    </div>
    <dl>{dl_html}</dl>
  </div>
</div>
<section class="sec" aria-label="Lyrics">
{lyrics_html(s)}
</section>
{more_block}
<div class="prevnext">{left}{right}</div>
</main>'''
    return render(f"songs/{s['slug']}.html",
                  title=f"{a['name']} – {s['title']} lyrics · {SITE['name']}",
                  desc=f"Color-coded lyrics for {a['name']} – {s['title']}: romanization, original and translation.",
                  page="songs.html", body=body, prefix=prefix)


def linkify(text):
    """Turn [label](url) into links after escaping."""
    import re as _re
    return _re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2" target="_blank" rel="noopener">\1</a>', esc(text))


def page_faq():
    items = "".join(f'<details class="faq-item"><summary>{esc(f["q"])}</summary><p>{linkify(f["a"])}</p></details>'
                    for f in DATA["faq"])
    body = f'''<main class="w" id="main">
<div class="page-head">
  <h1>FAQ</h1>
  <p class="mu">Everything about color coding, credits and how this site works.</p>
</div>
<div class="faq-list">{items}</div>
<div class="panel" style="margin-top:32px">
  <h2 class="sec-h">Still stuck?</h2>
  <p class="mu">Ask on the <a href="https://chaereve.pages.dev/" target="_blank" rel="noopener">Requests page</a> or open an issue on <a href="{esc(SITE['github'])}" rel="noopener">GitHub</a>.</p>
</div>
</main>'''
    return render("faq.html", title=f"FAQ · {SITE['name']}",
                  desc="Frequently asked questions about Chaereve.",
                  page="faq.html", body=body)


def page_search():
    body = '''<main class="w" id="main">
<div class="page-head">
  <h1>Search</h1>
  <p class="mu">Songs and artists on Chaereve.</p>
</div>
<input class="srch wide" id="pageSearch" type="search" placeholder="Search songs or artists…" aria-label="Search">
<p class="mu mono" id="searchCount" style="margin:18px 2px"></p>
<div class="search-results" id="searchResults"></div>
</main>'''
    return render("search.html", title=f"Search · {SITE['name']}",
                  desc="Search Chaereve lyrics by song or artist.", page="search.html", body=body)


def page_404():
    body = '''<main class="w" id="main">
<div class="page-head" style="padding:80px 0 40px">
  <h1>Page not found</h1>
  <p class="mu">That page moved, or never existed. Try search — or head back home.</p>
  <div style="margin-top:26px;display:flex;gap:12px;flex-wrap:wrap">
    <a class="btn" href="index.html">Back home</a>
    <a class="btn ghost" href="search.html">Search lyrics</a>
  </div>
</div>
</main>'''
    return render("404.html", title=f"Not found · {SITE['name']}",
                  desc="Page not found.", page="404.html", body=body)


def page_feed():
    items = []
    for s in SONG_LIST:
        a = artist_of(s)
        link = f"{BASE_URL}/songs/{s['slug']}.html"
        pub = datetime.datetime.fromisoformat(s["release"]).strftime("%a, %d %b %Y 00:00:00 +0000")
        items.append(f"""    <item>
      <title>{esc(a['name'])} – {esc(s['title'])}</title>
      <link>{esc(link)}</link>
      <guid>{esc(link)}</guid>
      <pubDate>{pub}</pubDate>
      <description>Color-coded lyrics: romanization, original and translation.</description>
    </item>""")
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>{esc(SITE['name'])}</title>
    <link>{esc(BASE_URL)}</link>
    <description>{esc(SITE['description'])}</description>
    <language>en</language>
{chr(10).join(items)}
  </channel>
</rss>
"""
    (ROOT / "feed.xml").write_text(xml, encoding="utf-8")


def page_search_index():
    entries = []
    for s in SONG_LIST:
        a = artist_of(s)
        entries.append({
            "type": "song", "title": s["title"],
            "sub": f"{a['name']} · {s['language']} · {fmt_short(s['release'])}",
            "url": f"songs/{s['slug']}.html",
            "hay": f"{s['title']} {a['name']} {s.get('titleNative','')} {a.get('native','')}".lower(),
        })
    for a in DATA["artists"]:
        n = sum(1 for s in DATA["songs"] if s["artist"] == a["slug"])
        entries.append({
            "type": "artist", "title": a["name"],
            "sub": f"{a['type']} · {a['language']} · {n} songs",
            "url": f"artists/{a['slug']}.html",
            "hay": f"{a['name']} {a.get('native','')}".lower(),
        })
    js = "window.SEARCH_INDEX = " + json.dumps(entries, ensure_ascii=False) + ";\n"
    (ROOT / "assets" / "js" / "search-index.js").write_text(js, encoding="utf-8")


def main():
    built = []
    built.append(page_home())
    built.append(page_artists())
    for a in DATA["artists"]:
        built.append(page_artist(a))
    for s in SONG_LIST:
        built.append(page_song(s))
    built.append(page_faq())
    built.append(page_search())
    built.append(page_404())
    page_feed()
    page_search_index()
    print(f"Built {len(built)} pages + feed.xml + search-index.js")


if __name__ == "__main__":
    main()
