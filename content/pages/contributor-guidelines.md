---
title: Contributor Guidelines
description: How to contribute color coding, corrections and translations, and how the review workflow works.
updated: 2026-11-12
inFooter: true
order: 20
---

## Roles

| Role | Can do |
| --- | --- |
| **Admin** | Merge pull requests, publish, edit any collection, manage settings. |
| **Editor** | Prepare changes (drafts), edit most collections; publishing happens through a merged PR. |
| **Coder** | Color-coding changes (`memberIds`, member colors, line types). |
| **Translator** | Submits and improves translations; never publishes on their own. |

Access is granted through the CMS (Decap) with `publish_mode: editorial_workflow`: **no contributor can publish directly to `main` and nobody but admins can merge.**

## The review workflow (short version)

1. A contributor edits content in the CMS → a **draft** is created (or a fork + PR with open authoring).
2. The change moves **Ready to review** → a pull request is opened.
3. An **admin reviews and merges** the PR. The Cloudflare Pages build for the PR is checked first (the site renders the candidate change in the PR preview).
4. After merge, the site rebuilds and the change goes live.

## Color coding contributions

- Work from the **studio audio** unless the version is explicitly marked `live`/`remix`.
- `memberIds: []` means the line is sung by **all members** (ensemble).
- A line may credit **zero, one or many members**; each credited member counts one line in the distribution.
- Line types: `lyric`, `all`, `instrumental`, `spoken`, `adlib`.
  - **Adlibs are excluded from the distribution by default** — add them only when needed, with a `note` explaining the source.
  - `instrumental` lines are never counted.
- For multi-member lines, split the text with `|` in the same order as `memberIds` (e.g. `"first half | second half"`); without a matching split the line renders with a gradient fallback.
- Use **IDs, never names** (`song.members[].id`, `line.memberIds`).

## Corrections

1. Use the **Report a correction** form on any song page (or open a GitHub issue directly).
2. The form creates a **GitHub issue** (via the forms Worker, or pre-filled manually).
3. An editor triages: **open → reviewing → accepted/rejected**.
4. Only after **acceptance** does someone edit the JSON, via a normal PR through the CMS/editorial workflow.
5. The correction record is updated (`status: applied`) and the issue is closed.

**Corrections never auto-modify content.**

## Translations

- Translations are written **by people**; machine translation alone is not accepted.
- Every translation must credit its **translator** (`translator` field) — anonymous or uncredited translations are rejected.
- Statuses: `submitted → reviewing → approved/rejected`. Only **approved** translations are shown on song pages.
- Translators submit via the CMS (open authoring) or the submission form; the content goes through the same PR review as everything else.

## Quality bar

- Lyrics line by line against the studio audio; romanization uses the site's consistent style.
- Add `sources` for every factual claim (credits, dates, colors).
- One concern per PR where possible; note what changed and why.
