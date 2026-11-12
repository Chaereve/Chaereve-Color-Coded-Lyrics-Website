/**
 * Public forms (correction / comment / translation / report).
 *
 * Flow:
 *  1. If `PUBLIC_FORMS_ENDPOINT` is set, POST the fields (plus the Cloudflare
 *     Turnstile token) to the forms Worker, which verifies the token and
 *     opens a GitHub issue.
 *  2. Otherwise (or on failure) the form falls back to a pre-filled GitHub
 *     "new issue" URL opened in a new tab — no data is lost either way.
 *
 * Nothing is ever published automatically: every submission becomes an issue
 * an editor has to review.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; theme?: string }) => string;
      getResponse: (widgetId?: string) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export type FormKind = 'correction' | 'comment' | 'translation' | 'report';

export interface FormSpec {
  kind: FormKind;
  songId?: string;
  songTitle?: string;
  songUrl?: string;
  /** "owner/repo" of the content repository (for the issue fallback). */
  repo?: string;
}

const ENDPOINT = (import.meta.env.PUBLIC_FORMS_ENDPOINT as string | undefined)?.replace(/\/+$/, '');

function collectFields(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of Array.from(form.querySelectorAll<HTMLElement>('input, textarea, select'))) {
    const name = el.getAttribute('name');
    if (!name) continue;
    if (el instanceof HTMLInputElement && el.type === 'checkbox' && !el.checked) continue;
    const valueEl = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    out[name] = valueEl.value.trim();
  }
  return out;
}

function issueBody(kind: FormKind, fields: Record<string, string>, spec: FormSpec): string {
  const rows = (Object.entries(fields) as [string, string][])
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `**${k.replaceAll(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}**\n${v}`)
    .join('\n\n---\n\n');
  return [
    kind === 'comment'
      ? `New comment${spec.songTitle ? ` on **${spec.songTitle}**` : ''}:`
      : `New ${kind}${spec.songTitle ? ` for **${spec.songTitle}**` : ''}:`,
    spec.songUrl ? `Song: ${spec.songUrl}` : '',
    '',
    rows || '(empty)',
    '',
    '---',
    '_Submitted from the website form. Review and close this issue after processing._',
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

function prefilledIssueUrl(kind: FormKind, fields: Record<string, string>, spec: FormSpec): string | null {
  if (!spec.repo) return null;
  const title =
    kind === 'correction'
      ? `Correction: ${spec.songTitle ?? 'song'} — ${(fields.issue ?? '').slice(0, 70)}`
      : kind === 'comment'
        ? `[comment] ${spec.songTitle ?? 'song'} (${fields.name ?? 'anonymous'})`
        : kind === 'translation'
          ? `[translation] ${spec.songTitle ?? 'song'} → ${fields.language ?? 'language'}`
          : `[report] ${spec.songTitle ?? 'song'} — ${fields.reason ?? 'general'}`;
  const params = new URLSearchParams();
  params.set('title', title);
  params.set('body', issueBody(kind, fields, spec));
  params.set(
    'labels',
    kind === 'comment' ? 'comments' : kind === 'report' ? 'report' : kind,
  );
  return `https://github.com/${spec.repo}/issues/new?${params.toString()}`;
}

export function initForm(root: HTMLElement, spec: FormSpec): void {
  const form = root.querySelector<HTMLFormElement>('form[data-form]');
  if (!form) return;
  const status = root.querySelector<HTMLElement>('[data-form-status]');
  const setStatus = (html: string, tone: 'ok' | 'warn') => {
    if (status) {
      status.innerHTML = html;
      status.dataset.tone = tone;
      status.removeAttribute('hidden');
    }
  };

  // Render the Turnstile widget (only present when a site key was configured).
  const turnstileEl = root.querySelector<HTMLElement>('[data-turnstile]');
  const sitekey = root.dataset.turnstile ?? '';
  if (turnstileEl && sitekey && window.turnstile) {
    window.turnstile.render(turnstileEl, { sitekey });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const fields = collectFields(form);
    const token = sitekey && window.turnstile ? window.turnstile.getResponse('cf-turnstile') : '';

    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Submitting…';
    }

    const fallback = () => {
      const url = prefilledIssueUrl(spec.kind, fields, spec);
      if (url) {
        window.open(url, '_blank', 'noopener');
        setStatus(
          'A new GitHub issue was opened in a separate tab — please finish submitting it there. (Direct submission is not configured yet.)',
          'warn',
        );
      } else {
        setStatus(
          'Forms are not configured yet (no GitHub repository set). Please open an issue in the content repository directly.',
          'warn',
        );
      }
      if (submit) {
        submit.disabled = false;
        submit.textContent = form.dataset.submitLabel ?? 'Submit';
      }
    };

    if (!ENDPOINT) {
      fallback();
      return;
    }

    try {
      const res = await fetch(`${ENDPOINT}/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: spec.kind, fields, turnstileToken: token }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; issueUrl?: string };
      form.reset();
      if (window.turnstile) {
        try {
          window.turnstile.reset('cf-turnstile');
        } catch {
          /* ignore */
        }
      }
      setStatus(
        data.issueUrl
          ? `Thank you! Your submission was saved as <a class="link" href="${data.issueUrl}" rel="noopener noreferrer">this GitHub issue</a>. An editor will review it — nothing is published automatically.`
          : 'Thank you! Your submission was received and will be reviewed by an editor. Nothing is published automatically.',
        'ok',
      );
    } catch {
      fallback();
    }
  });
}
