/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** Canonical site URL (also read by astro.config.mjs). */
  readonly SITE_URL?: string;
  /** "owner/repo" used for GitHub links and the pre-filled issue fallback. */
  readonly PUBLIC_GITHUB_REPO?: string;
  /** Base URL of the forms Worker (workers/forms). Empty = fallback to GitHub issue links. */
  readonly PUBLIC_FORMS_ENDPOINT?: string;
  /** Cloudflare Turnstile site key for public forms. */
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  /** Decap backend to emit in /admin/config.yml: "turbo-github" (default) or "github". */
  readonly CMS_BACKEND?: string;
  readonly CMS_TURBO_SITE_ID?: string;
  readonly CMS_GITHUB_REPO?: string;
  readonly CMS_BRANCH?: string;
  readonly CMS_OAUTH_BASE_URL?: string;
  readonly CMS_OAUTH_AUTH_ENDPOINT?: string;
  readonly CMS_LOCAL_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
