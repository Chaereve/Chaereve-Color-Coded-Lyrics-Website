/**
 * /admin/config.yml — generated at build time from environment variables so
 * the same codebase can point at Decap Turbo (default) or the self-hosted
 * GitHub OAuth Worker (CMS_BACKEND=github).
 *
 * The committed `admin/config.yml` in the repository is the default template
 * (no env configured); when env vars are set, THIS generated file wins.
 */
import { stringify } from 'yaml';
import { buildCmsConfig } from '../../lib/cms-config';
import { cmsRuntimeConfig, } from '../../lib/env';
import { getSite } from '../../lib/content';

export const GET = () => {
  const site = getSite();
  const config = cmsRuntimeConfig();
  const siteUrl = import.meta.env.SITE_URL?.trim() || import.meta.env.CF_PAGES_URL?.trim() || 'http://localhost:4321';
  const cms = buildCmsConfig({
    artists: site.artists,
    categories: site.categories,
    tags: site.tags,
    authors: site.authors,
    siteUrl,
    config,
  });
  const header = `# Generated at build time — do not edit (see admin/config.yml for the template).
# Backend: ${config.localBackend ? 'test (local)' : config.backend}
#
`;
  const yaml = header + stringify(cms);
  return new Response(yaml, {
    headers: {
      'content-type': 'text/yaml; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
};
