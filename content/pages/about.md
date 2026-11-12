---
title: About
description: What Chaereve Lyrics is and how it is built.
updated: 2026-11-12
inFooter: true
order: 5
---

**Chaereve Lyrics** is a fan-made, community-reviewed reference for **color-coded lyrics with line distribution**: every line is colored by the member who sings it, and the distribution panel shows exactly how many lines each member has.

## Features

- Color-coded lyrics with **Original / Romanization / Translation** views (tabs + stacked)
- **Line distribution** as horizontal bars (adlibs toggleable)
- Artist, member, category and tag archives with A–Z navigation
- **Search** over titles, artists, members, albums and lyrics (accent-insensitive)
- **Translations** and **corrections** with a transparent review workflow
- Comments moderated through GitHub Issues — **no database**

## How it works (tech)

A static site (Astro + Tailwind). All content is JSON/Markdown in `content/`, edited through **Decap CMS** with an editorial workflow: contributors open drafts/PRs, admins review and merge. Deploys to Cloudflare Pages, so every PR gets a full preview build.

---

> **This checkout contains sample data.** Some sample songs reference real song titles for URL parity, but **every lyric line is original placeholder text**; the artists "LUMI" and "Juna" are fictional. See the [Content Policy](/pages/content-policy/).
