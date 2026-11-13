#!/usr/bin/env python3
"""Chaereve static site generator — color-coded lyrics, CCL-style blog layout.

Edit data/site.json, then run:  python3 tools/build.py
Every page in the repo root (index.html, songs/…, artists/…) is regenerated.
"""
import json
import html
import pathlib
import datetime
import re

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


def linkify(text):
    """Turn [label](url) into links; plain text passes through."""
    safe = html.escape(str(text), quote=True)
    return re.sub(r"\[([^\]]+)\]\(([^)]+)\)",
                  r'<a href="\2" target="_blank" rel="noopener">\1</a>', safe)


# ---------------------------------------------------------------- chrome
def head(title, desc, prefix):
    return f'''<!DOCTYPE html>
<html lang="en" data-theme="light">
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
    if (!t) t = "light";
    document.documentElement.setAttribute("data-theme", t);
  }} catch (e) {{}}
}})();
</script>
</head>
'''


NAV = [("Home", "index.html", False), ("Index", "artists.html", False),
       ("Requests", "https://chaereve.pages.dev/", True), ("FAQ", "faq.html", False)]


def header(prefix, page):
    items = []
    for label, href, ext in NAV:
        target = ' target="_blank" rel="noopener"' if ext else ""
        cur = ""
        if not ext and ((page == "home" and href == "index.html") or
                        (page == "artists" and href == "artists.html") or
                        (page == "faq" and href == "faq.html")):
            cur = ' aria-current="page"'
        arrow = " ↗" if ext else ""
        items.append(f'<a href="{prefix}{href}"{target}{cur}>{label}{arrow}</a>')
    return f'''<header class="bar">
  <div class="w bar-in">
    <a class="logo" href="{prefix}index.html">{esc(SITE['name'])}</a>
    <nav class="menu" id="mainNav" aria-label="Main">
      {"".join(items)}
    </nav>
    <div class="head-tools">
      <div class="search-wrap">
        <input class="srch" id="siteSearch" type="search" placeholder="Search songs or artists…" autocomplete="off" aria-label="Search">
        <div class="search-drop" id="searchDrop" hidden></div>
      </div>
      <button class="icon-btn" id="themeToggle" type="button" aria-label="Toggle color theme">
        <svg class="i-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        <svg class="i-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>
      </button>
      <button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Menu" aria-expanded="false">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
    </div>
  </div>
</header>
'''


def sidebar(prefix):
    recent = "".join(
        f'<li><a href="{prefix}songs/{s["slug"]}.html">{esc(artist_of(s)["name"])} – {esc(s["title"])}</a></li>'
        for s in SONG_LIST[:6])
    langs = {}
    for s in SONG_LIST:
        langs[s["language"]] = langs.get(s["language"], 0) + 1
    cats = "".join(
        f'<li><a href="{prefix}search.html?q={esc(lang)}">{esc(lang)} ({n})</a></li>'
        for lang, n in sorted(langs.items()))
    arts = "".join(
        f'<li><a href="{prefix}artists/{a["slug"]}.html">{esc(a["name"])}</a></li>'
        for a in sorted(DATA["artists"], key=lambda x: x["name"]))
    return f'''<aside class="side" aria-label="Sidebar">
  <section class="widget">
    <h4 class="widget-t">Recent Posts</h4>
    <ul class="widget-list">{recent}</ul>
  </section>
  <section class="widget">
    <h4 class="widget-t">Languages</h4>
    <ul class="widget-list">{cats}</ul>
  </section>
  <section class="widget">
    <h4 class="widget-t">Artists</h4>
    <ul class="widget-list">{arts}</ul>
  </section>
  <section class="widget">
    <h4 class="widget-t">About</h4>
    <p class="mu">{esc(SITE['name'])} is a fan-run archive of color-coded lyrics —
    romanization, hangul and translation, credited to the people who wrote them.</p>
    <p class="mu"><a href="{prefix}feed.xml">RSS feed</a> · <a href="{esc(SITE['github'])}" target="_blank" rel="noopener">GitHub</a></p>
  </section>
</aside>'''


def footer(prefix):
    return f'''<footer class="site-foot">
  <div class="w foot-in">
    <p class="foot-brand">© 2026 {esc(SITE['name'])} · Fan translations, credited to their authors.</p>
    <nav class="foot-links" aria-label="Footer">
      <a href="{prefix}index.html">Home</a>
      <a href="{prefix}artists.html">Index</a>
      <a href="https://chaereve.pages.dev/" target="_blank" rel="noopener">Requests</a>
      <a href="{prefix}faq.html">FAQ</a>
      <a href="{prefix}feed.xml">RSS</a>
      <a href="{esc(SITE['github'])}" target="_blank" rel="noopener">GitHub</a>
    </nav>
  </div>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
<script src="{prefix}assets/js/search-index.js"></script>
<script src="{prefix}assets/js/site.js" defer></script>
</body>
</html>
'''


def render(out_rel, *, title, desc, page, body, prefix=""):
    html_doc = (head(title, desc, prefix)
                + f'<body data-page="{page}" data-prefix="{prefix}">\n'
                + header(prefix, page)
                + f'<div class="w layout">\n<main id="main">\n{body}\n</main>\n{sidebar(prefix)}\n</div>\n'
                + footer(prefix))
    path = ROOT / out_rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html_doc, encoding="utf-8")
    return out_rel


# ---------------------------------------------------------------- pieces
def post_row(song, prefix):
    a = artist_of(song)
    return f'''<a class="card post-row" href="{prefix}songs/{song['slug']}.html" data-lang="{esc(song['language'])}">
{cover_html(song['cover'])}
<div class="post-row-b">
  <b>{esc(a['name'])} – {esc(song['title'])}</b>
  <div class="tags mono"><span>{esc(song['language'].upper())}</span><span>{esc(a['name'])}</span></div>
  <div class="byline mono">by {esc(song['coloredBy'])} · {fmt_long(song['release'])}</div>
</div>
</a>'''


def trend_item(song, prefix):
    a = artist_of(song)
    return f'''<a class="trend-item" href="{prefix}songs/{song['slug']}.html">
{cover_html(song['cover'])}
<b>{esc(song['title'])}</b>
<span>{esc(a['name'])}</span>
</a>'''


def legend_html(artist, interactive):
    """Legend: plain colored member names (clickable when interactive)."""
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
    Translation), each the complete song, colored per member, group breaks by spacing.
    Sections are separated by asterism rules, credits close the post."""
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
            f'<h3 class="lyr-sec">{esc(label)}</h3>\n'
            f'<div class="lyr" data-lang="{key}">{"".join(rows)}</div>')

    c = song["credits"]
    credits = (
        '<h3 class="lyr-sec">Credits</h3>\n'
        '<p class="credits">'
        f'{esc(song["language"])}: {linkify(c["source"])}<br>'
        f'Romanization: {esc(c["translation"])}<br>'
        f'Translation: {esc(c["translation"])}'
        '</p>')

    body = ('\n<hr class="sep">\n'.join(blocks)
            + '\n<hr class="sep">\n' + credits)

    return f'''<div class="lyr-wrap" data-song="{song['slug']}">
<div class="ctl">
  <div class="lg">{legend_html(a, True)}</div>
</div>
{body}
</div>'''


# ---------------------------------------------------------------- pages
def page_home():
    trending = [DATA["featured"]] + list(DATA["trending"])
    trend_html = "".join(trend_item(SONGS[s], "") for s in trending[:6])
    cards = "".join(post_row(s, "") for s in SONG_LIST)
    tabs = "".join(
        f'<button class="{"on" if i == 0 else ""}" data-filter="{esc(lang)}">{esc(lang)}</button>'
        for i, lang in enumerate(["All", "Korean", "English", "Japanese"]))
    body = f'''<h2 class="sec-title">Trending Songs</h2>
<div class="trend-grid">{trend_html}</div>
<h2 class="sec-title">Latest Posts</h2>
<div class="tabs">{tabs}</div>
<div id="songGrid" class="post-list">{cards}</div>
<div id="olderWrap" class="older"><button id="olderBtn" class="btn" type="button">Older posts →</button></div>'''
    return render("index.html", title=f"{SITE['name']} · Color-coded lyrics",
                  desc="Color-coded lyrics with romanization, hangul and translation.",
                  page="home", body=body)


def page_song(s):
    prefix = "../"
    a = artist_of(s)
    album_line = f"{s['album']} [{s['albumType']}]"
    c = s["credits"]
    tags = (f'<a href="{prefix}search.html?q={esc(s["language"])}">{esc(s["language"].upper())}</a>'
            f'<a href="{prefix}artists/{a["slug"]}.html">{esc(a["name"])}</a>')
    info = (f'<p class="mu">{esc(album_line)} · {fmt_dot(s["release"])}</p>'
            f'<p><b>Lyrics</b>: {esc(c["lyrics"])}</p>'
            f'<p><b>Composer</b>: {esc(c["composer"])}</p>'
            f'<p><b>Arranger</b>: {esc(c["arranger"])}</p>')

    more = [x for x in SONG_LIST if x["artist"] == a["slug"] and x["slug"] != s["slug"]]
    more_items = "".join(
        f'<li><a href="{prefix}songs/{x["slug"]}.html">{esc(a["name"])} – {esc(x["title"])}</a></li>'
        for x in more[:6])
    native = f' ({esc(a["native"])})' if a.get("native") else ""
    more_block = (f'<h3 class="more-h">More songs by {esc(a["name"])}{native}</h3>\n'
                  f'<ul class="more-list">{more_items}</ul>\n'
                  f'<p><a class="all-link" href="{prefix}artists/{a["slug"]}.html">All {esc(a["name"])} lyrics →</a></p>') if more else ""

    idx = SONG_LIST.index(s)
    newer = SONG_LIST[idx - 1] if idx > 0 else None
    older = SONG_LIST[idx + 1] if idx < len(SONG_LIST) - 1 else None
    left = (f'<a href="{prefix}songs/{newer["slug"]}.html">← {esc(artist_of(newer)["name"])} – {esc(newer["title"])}</a>'
            if newer else "<span></span>")
    right = (f'<a href="{prefix}songs/{older["slug"]}.html">{esc(artist_of(older)["name"])} – {esc(older["title"])} →</a>'
             if older else "<span></span>")

    body = f'''<article class="post">
<div class="post-tags mono">{tags}</div>
<h1 class="post-title">{esc(a['name'])} – {esc(s['title'])}</h1>
<p class="byline mono">color-coded by {esc(s['coloredBy'])} · {fmt_long(s['release'])}</p>
<hr class="sep">
<div class="post-meta">{info}</div>
<div class="post-cover">{cover_html(s['cover'])}</div>
<div class="vid" role="img" aria-label="Video placeholder">
  <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="currentColor" opacity=".9"/><path d="M20 14v20l16-10z" fill="var(--bg)"/></svg>
</div>
<hr class="sep">
{lyrics_html(s)}
<hr class="sep">
<p class="disclaimer"><b>Disclaimer –</b> {esc(SITE['name'])} does not authorize any usage of our work
(including, but not limited to: transliterations, translations, codings, etc.) in monetized media.</p>
<hr class="sep">
{more_block}
<nav class="post-nav">{left}{right}</nav>
</article>'''
    return render(f"songs/{s['slug']}.html",
                  title=f"{a['name']} – {s['title']} lyrics · {SITE['name']}",
                  desc=f"Color-coded lyrics for {a['name']} – {s['title']}: romanization, hangul and translation.",
                  page="song", body=body, prefix=prefix)


def page_artist(a):
    prefix = "../"
    songs = [s for s in SONG_LIST if s["artist"] == a["slug"]]
    rows = "".join(post_row(s, prefix) for s in songs)
    native = f'<p class="mu">{esc(a["native"])}</p>' if a.get("native") else ""
    body = f'''<div class="post-tags mono"><a href="{prefix}artists.html">{esc(a['type'])}</a><a href="{prefix}search.html?q={esc(a['language'])}">{esc(a['language'].upper())}</a></div>
<h1 class="post-title">{esc(a['name'])}</h1>
{native}
<hr class="sep">
<p class="bio">{esc(a['bio'])}</p>
<div class="lg static-legend">{legend_html(a, False)}</div>
<hr class="sep">
<h2 class="sec-title">Songs by {esc(a['name'])}</h2>
<div class="post-list">{rows}</div>
<p class="mu"><a href="{prefix}artists.html">← All artists</a></p>'''
    return render(f"artists/{a['slug']}.html",
                  title=f"{a['name']} lyrics · {SITE['name']}",
                  desc=f"Color-coded lyrics by {a['name']}.",
                  page="artist", body=body, prefix=prefix)


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
            rows.append(f'''<a class="idx-row" href="artists/{a['slug']}.html" data-name="{esc(a['name'].lower())} {esc(a.get('native', '').lower())}">
{cover_html(a['cover'])}
<div class="idx-main">
  <b>{esc(a['name'])}</b>
  <span class="mu">{esc(a.get('native', ''))}</span>
</div>
<span class="tag">{esc(a['type'])} · {esc(a['language'])}</span>
<span class="idx-count mono">{n} song{'s' if n != 1 else ''}</span>
</a>''')
        sections.append(f'<section class="idx-sec"><h2 id="L{ch}">{ch}</h2>{"".join(rows)}</section>')
    body = f'''<h1 class="post-title">Artist Index</h1>
<p class="mu">Every artist on {esc(SITE['name'])}, A–Z. Follow an artist to see all their color-coded lyrics.</p>
<hr class="sep">
<div class="idx-filter">
  <input class="srch wide" id="idxFilter" type="search" placeholder="Filter artists…" aria-label="Filter artists">
</div>
<nav class="idx-jump mono" aria-label="Jump to letter">{jump}</nav>
{"".join(sections)}'''
    return render("artists.html", title=f"Artist index · {SITE['name']}",
                  desc="Browse every artist on Chaereve.",
                  page="artists", body=body)


def page_faq():
    items = "".join(
        f'<details class="faq-item"><summary>{esc(f["q"])}</summary><p>{linkify(f["a"])}</p></details>'
        for f in DATA["faq"])
    body = f'''<h1 class="post-title">FAQ</h1>
<p class="mu">Everything about color coding, credits and how this site works.</p>
<hr class="sep">
<div class="faq">{items}</div>'''
    return render("faq.html", title=f"FAQ · {SITE['name']}",
                  desc="Frequently asked questions about Chaereve.",
                  page="faq", body=body)


def page_search():
    body = f'''<h1 class="post-title">Search</h1>
<p class="mu">Songs and artists on {esc(SITE['name'])}.</p>
<hr class="sep">
<div class="search-page">
  <input class="srch wide" id="pageSearch" type="search" placeholder="Search songs or artists…" aria-label="Search">
  <p class="mono mu" id="searchCount"></p>
  <div id="searchResults" class="res-list"></div>
</div>'''
    return render("search.html", title=f"Search · {SITE['name']}",
                  desc="Search songs and artists on Chaereve.",
                  page="search", body=body)


def page_404():
    body = '''<h1 class="post-title">Page not found</h1>
<hr class="sep">
<p>That page doesn’t exist — it may have moved while the site was reorganized.</p>
<p><a href="index.html">Go to the homepage</a> · <a href="search.html">Search songs</a> · <a href="artists.html">Artist index</a></p>'''
    return render("404.html", title="Page not found", desc="Page not found.",
                  page="404", body=body)


# ---------------------------------------------------------------- generated assets
def build_search_index():
    entries = []
    for s in SONG_LIST:
        a = artist_of(s)
        title = f"{a['name']} – {s['title']}"
        sub = f"{a['name']} · {s['language']} · {fmt_short(s['release'])}"
        entries.append({"title": title, "sub": sub,
                        "url": f"songs/{s['slug']}.html",
                        "hay": (title + " " + sub).lower()})
    for a in sorted(DATA["artists"], key=lambda x: x["name"]):
        n = sum(1 for s in DATA["songs"] if s["artist"] == a["slug"])
        title = a["name"]
        sub = f"Artist · {a['language']} · {n} songs"
        entries.append({"title": title, "sub": sub,
                        "url": f"artists/{a['slug']}.html",
                        "hay": (title + " " + sub + " " + a.get("native", "")).lower()})
    js = ("/* generated by tools/build.py — do not edit */\n"
          "window.SEARCH_INDEX = " + json.dumps(entries, ensure_ascii=False) + ";\n")
    (ROOT / "assets" / "js" / "search-index.js").write_text(js, encoding="utf-8")


def build_feed():
    items = []
    for s in SONG_LIST[:20]:
        a = artist_of(s)
        url = f"{BASE_URL}/songs/{s['slug']}.html"
        items.append(f"""    <item>
      <title>{esc(a['name'])} – {esc(s['title'])}</title>
      <link>{esc(url)}</link>
      <guid>{esc(url)}</guid>
      <pubDate>{esc(fmt_long(s['release']))}</pubDate>
      <description>Color-coded lyrics: romanization, {esc(s['language'])} and translation.</description>
    </item>""")
    feed = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>{esc(SITE['name'])}</title>
    <link>{esc(BASE_URL)}</link>
    <description>Color-coded lyrics with romanization, hangul and translation.</description>
    <language>en</language>
{chr(10).join(items)}
  </channel>
</rss>
"""
    (ROOT / "feed.xml").write_text(feed, encoding="utf-8")


def main():
    page_home()
    page_artists()
    page_faq()
    page_search()
    page_404()
    for s in DATA["songs"]:
        page_song(s)
    for a in DATA["artists"]:
        page_artist(a)
    build_search_index()
    build_feed()
    n = 5 + len(DATA["songs"]) + len(DATA["artists"])
    print(f"Built {n} pages + feed.xml + search-index.js")


if __name__ == "__main__":
    main()
