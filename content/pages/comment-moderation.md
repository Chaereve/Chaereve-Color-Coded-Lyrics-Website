---
title: Comment Moderation
description: How comments are stored, moderated and published (GitHub Issues, no database).
updated: 2026-11-12
order: 30
---

## Where comments live

This site has **no database**. Public comments are moderated through **GitHub Issues**:

1. The comment form (with Cloudflare Turnstile) submits to the **forms Worker**, which opens a GitHub issue labeled `comments` (or opens a pre-filled issue form when the Worker is not configured).
2. Each comment issue holds the **name, email (private, never published), content and timestamp**.
3. Moderators label the issue: `comments:pending`, `comments:approved`, `comments:spam`, `comments:trash`.
4. An editor mirrors approved comments into `content/comments/*.json` (one file per comment) through a PR.
5. Only `status: approved` comments are rendered on song pages. **Emails are never copied into the public repository.**

## Statuses

| Status | Meaning |
| --- | --- |
| `pending` | Submitted, not yet reviewed. |
| `approved` | Published on the song page. |
| `spam` | Link-farming, offensive, impersonation — kept hidden. |
| `trash` | Removed by the author or moderator. |

## Rules of thumb

- Be specific and kind; no spoilers without a warning.
- No external links unless they cite evidence (official MV, release notes).
- Report abuse with the **Report** button; reports open issues labeled `report`.
