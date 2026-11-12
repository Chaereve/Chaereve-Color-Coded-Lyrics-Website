/**
 * Build-time configuration read from environment variables.
 * Nothing here is hardcoded: see `.env.example` and the README.
 */

function clean(v: string | undefined): string | undefined {
  const s = v?.trim();
  return s ? s : undefined;
}

/** "owner/repo" of the content repository (links + issue fallback). */
export const GITHUB_REPO = clean(import.meta.env.PUBLIC_GITHUB_REPO);

export const GITHUB_REPO_URL = GITHUB_REPO ? `https://github.com/${GITHUB_REPO}` : undefined;

/** Base URL of the forms Worker; when unset, forms fall back to pre-filled GitHub issues. */
export const FORMS_ENDPOINT = clean(import.meta.env.PUBLIC_FORMS_ENDPOINT)?.replace(/\/+$/, '');

export const TURNSTILE_SITE_KEY = clean(import.meta.env.PUBLIC_TURNSTILE_SITE_KEY);

/** Show draft / in_review songs (local dev, or preview deployments with SHOW_DRAFTS=true). */
export const SHOW_DRAFTS = import.meta.env.DEV || clean(import.meta.env.SHOW_DRAFTS) === 'true';

export interface CmsRuntimeConfig {
  backend: 'turbo-github' | 'github';
  turboSiteId?: string;
  repo?: string;
  branch: string;
  oauthBaseUrl?: string;
  oauthAuthEndpoint: string;
  localBackend: boolean;
}

export function cmsRuntimeConfig(): CmsRuntimeConfig {
  const backend = clean(import.meta.env.CMS_BACKEND) === 'github' ? 'github' : 'turbo-github';
  return {
    backend,
    turboSiteId: clean(import.meta.env.CMS_TURBO_SITE_ID),
    repo: clean(import.meta.env.CMS_GITHUB_REPO) ?? GITHUB_REPO,
    branch: clean(import.meta.env.CMS_BRANCH) ?? 'main',
    oauthBaseUrl: clean(import.meta.env.CMS_OAUTH_BASE_URL)?.replace(/\/+$/, ''),
    oauthAuthEndpoint: clean(import.meta.env.CMS_OAUTH_AUTH_ENDPOINT) ?? 'auth',
    localBackend: clean(import.meta.env.CMS_LOCAL_BACKEND) === 'true',
  };
}

/** Pre-filled "new issue" URL on GitHub (fallback when no forms Worker is configured). */
export function newIssueUrl(params: { title: string; body: string; labels?: string[]; template?: string }): string | undefined {
  if (!GITHUB_REPO_URL) return undefined;
  const q = new URLSearchParams();
  q.set('title', params.title);
  q.set('body', params.body);
  if (params.labels?.length) q.set('labels', params.labels.join(','));
  if (params.template) q.set('template', params.template);
  return `${GITHUB_REPO_URL}/issues/new?${q.toString()}`;
}
