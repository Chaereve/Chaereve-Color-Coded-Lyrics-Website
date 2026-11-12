/**
 * /admin/ — serves the Decap CMS entry point.
 * The HTML lives in `admin/index.html` (repository root) next to the
 * committed `admin/config.yml` template, so the CMS setup is all in one place.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '../../../admin/index.html'), 'utf-8');

export const GET = () =>
  new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
