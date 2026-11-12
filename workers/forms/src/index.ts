/**
 * Chaereve — public forms worker (free Cloudflare Worker, no database).
 *
 * Accepts submissions from the website (correction / comment / translation /
 * report), verifies Cloudflare Turnstile, and opens a GitHub issue:
 *
 *   POST /  { "type": "correction", "fields": {...}, "turnstileToken": "…" }
 *   → 200 { "ok": true, "issueUrl": "https://github.com/owner/repo/issues/1" }
 *
 * CORS is restricted to the site origin (ALLOWED_ORIGIN).
 *
 * Secrets (wrangler secret put …):
 *   GITHUB_TOKEN          — fine-grained PAT with "Issues: write" on the repo
 *   GITHUB_REPO           — owner/repo of the content repository
 *   TURNSTILE_SECRET_KEY  — Cloudflare Turnstile secret key
 * Vars (non-secret, wrangler.toml [vars]):
 *   ALLOWED_ORIGIN        — e.g. https://YOUR_DOMAIN
 */

interface Env {
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  TURNSTILE_SECRET_KEY?: string;
  ALLOWED_ORIGIN?: string;
}

interface FormBody {
  type?: string;
  fields?: Record<string, unknown>;
  turnstileToken?: string;
}

const ALLOWED_TYPES = ['correction', 'comment', 'translation', 'report'];
const LABELS: Record<string, string> = {
  correction: 'correction',
  comment: 'comments',
  translation: 'translation',
  report: 'report',
};

function json(data: unknown, status = 200, origin?: string): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-headers'] = 'content-type';
    headers['access-control-allow-methods'] = 'POST, OPTIONS';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function verifyTurnstile(token: string, env: Env): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true; // dev mode without Turnstile
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

function escapeMd(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function issueTitle(kind: string, fields: Record<string, string>): string {
  const song = fields.songTitle ? ` ${fields.songTitle}` : '';
  switch (kind) {
    case 'correction':
      return `Correction:${song} — ${(fields.issue ?? '').slice(0, 80)}`;
    case 'comment':
      return `[comment]${song} — ${fields.name ?? 'anonymous'}`;
    case 'translation':
      return `[translation]${song} → ${fields.language ?? 'language'}`;
    case 'report':
      return `[report]${song} — ${fields.reason ?? 'general'}`;
    default:
      return `[${kind}]${song}`;
  }
}

function issueBody(kind: string, fields: Record<string, string>): string {
  const rows = Object.entries(fields)
    .filter(([, v]) => v.trim() !== '')
    .map(
      ([k, v]) =>
        `| ${escapeMd(k.replaceAll(/([a-z])([A-Z])/g, '$1 $2').toLowerCase())} | ${escapeMd(v.length > 4000 ? `${v.slice(0, 4000)}…` : v)} |`,
    )
    .join('\n');
  return [
    `New **${kind}** submission from the website.`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    rows,
    '',
    '---',
    '_Created by the forms Worker. Review, then close this issue after processing (comments are mirrored to content/comments/*.json by an editor — emails stay in this issue, never in the public repo)._',
  ].join('\n');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin') ?? undefined;
    const allowed = origin === env.ALLOWED_ORIGIN;

    if (request.method === 'OPTIONS') {
      return json({ ok: true }, 204, allowed ? origin : undefined);
    }
    if (!allowed) {
      return json({ ok: false, error: 'Origin not allowed.' }, 403);
    }

    if (request.method === 'GET') {
      return json({ ok: true, service: 'chaereve-forms' }, 200, origin);
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed.' }, 405, origin);
    }

    let body: FormBody;
    try {
      body = (await request.json()) as FormBody;
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400, origin);
    }

    const kind = body.type;
    if (!kind || !ALLOWED_TYPES.includes(kind)) {
      return json({ ok: false, error: `Unknown form type (expected one of ${ALLOWED_TYPES.join(', ')}).` }, 400, origin);
    }

    const fields = (body.fields ?? {}) as Record<string, unknown>;
    const textFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === 'string') textFields[k] = v;
    }

    const ok = await verifyTurnstile(body.turnstileToken ?? '', env);
    if (!ok) {
      return json({ ok: false, error: 'Turnstile verification failed. Please try again.' }, 403, origin);
    }

    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
      return json(
        { ok: false, error: 'Worker is missing GITHUB_TOKEN / GITHUB_REPO secrets.' },
        500,
        origin,
      );
    }

    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'content-type': 'application/json',
        accept: 'application/vnd.github+json',
        user_agent: 'chaereve-forms-worker',
      },
      body: JSON.stringify({
        title: issueTitle(kind, textFields),
        body: issueBody(kind, textFields),
        labels: [LABELS[kind] ?? kind],
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      return json({ ok: false, error: `GitHub issue creation failed: ${err.message ?? res.status}` }, 502, origin);
    }

    const issue = (await res.json()) as { html_url?: string };
    return json({ ok: true, issueUrl: issue.html_url }, 200, origin);
  },
};
