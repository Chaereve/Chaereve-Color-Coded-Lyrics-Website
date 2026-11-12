/**
 * Decap CMS — GitHub OAuth proxy (self-hosted fallback for Decap Turbo).
 *
 * Flow (Decap "github" backend with custom base_url/auth_endpoint):
 *   1. CMS (popup) GETs  {base_url}/auth?state=<state>&repo=owner/name
 *   2. Worker stores `state` in an HttpOnly cookie and redirects to GitHub.
 *   3. GitHub redirects to {base_url}/callback?code=…&state=…
 *   4. Worker verifies the state (CSRF), exchanges the code for a token and
 *      serves a tiny page that hands the token back to the CMS popup:
 *        postMessage("authorizing:github")          ← popup → CMS
 *        postMessage("authorization:github:success:
 *                     {\"token\":\"…\",\"provider\":\"github\"}",
 *                     origin)                       ← popup → CMS
 *
 * Secrets (never committed):
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET   (wrangler secret put …)
 *   REDIRECT_URI                             (optional override; defaults to
 *                                             <worker origin>/callback)
 */

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  REDIRECT_URI?: string;
}

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN = 'https://github.com/login/oauth/access_token';

const CSRF_COOKIE = 'decap_state';
const CSRF_TTL = 600; // 10 minutes

/**
 * The handshake page Decap's popup expects (same protocol as the
 * netlify-cms-cloudflare-pages reference implementation).
 */
function handshakePage(status: 'success' | 'error', content: Record<string, unknown>): string {
  const payload = JSON.stringify(content).replace(/</g, '\\u003c');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Authorizing…</title>
    <style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0b0f14;color:#f3f4f6}</style>
  </head>
  <body>
    <p>${status === 'success' ? 'Authorization complete — you can close this window.' : 'Authorization failed.'}</p>
    <script>
      const receiveMessage = (message) => {
        window.opener.postMessage(
          'authorization:github:${status}:${payload}',
          message.origin
        );
        window.removeEventListener('message', receiveMessage, false);
      };
      window.addEventListener('message', receiveMessage, false);
      window.opener.postMessage('authorizing:github', '*');
    </script>
  </body>
</html>`;
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/auth') {
      return handleAuth(request, url, env);
    }
    if (url.pathname === '/callback') {
      return handleCallback(request, url, env);
    }
    return new Response('Not found', { status: 404 });
  },
};

async function handleAuth(request: Request, url: URL, env: Env): Promise<Response> {
  if (!env.GITHUB_CLIENT_ID) {
    return html('Missing GITHUB_CLIENT_ID — run: wrangler secret put GITHUB_CLIENT_ID', 500);
  }

  // Decap passes its own `state`; we echo it through GitHub and keep a copy in
  // an HttpOnly cookie to detect cross-site forged callbacks (CSRF).
  const state = url.searchParams.get('state') ?? '';
  const cookieState = state
    ? `${CSRF_COOKIE}=${encodeURIComponent(state)}; Path=/; Max-Age=${CSRF_TTL}; Secure; SameSite=None; HttpOnly`
    : `${CSRF_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=None; HttpOnly`;

  const redirectUri = env.REDIRECT_URI ?? `${url.origin}/callback`;
  const authorize = new URL(GITHUB_AUTHORIZE);
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', redirectUri);
  // `repo` covers public+private repo editing; `user` lets Decap read the
  // account for the open-authoring UI.
  authorize.searchParams.set('scope', 'repo user');
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      'set-cookie': cookieState,
    },
  });
}

async function handleCallback(request: Request, url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // CSRF check: the state must match what we stored in /auth.
  const cookieState = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`))
    ?.slice(CSRF_COOKIE.length + 1);
  const clearCookie = `${CSRF_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=None; HttpOnly`;

  if (!code || !state || cookieState !== state) {
    return new Response('Login failed: state mismatch (CSRF protection). Please try again from the CMS.', {
      status: 400,
      headers: { 'set-cookie': clearCookie },
    });
  }

  const res = await fetch(GITHUB_TOKEN, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      user_agent: 'chaereve-decap-oauth-worker',
      accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const result = (await res.json()) as { error?: string; access_token?: string; scope?: string };

  if (result.error || !result.access_token) {
    const body = html(
      `GitHub returned an error: ${JSON.stringify(result).replace(/</g, '\\u003c')}. Check the OAuth App callback URL and the worker secrets.`,
      401,
    );
    body.headers.set('set-cookie', clearCookie);
    return body;
  }

  const body = handshakePage('success', { token: result.access_token, provider: 'github' });
  body.headers.set('set-cookie', clearCookie);
  return body;
}
