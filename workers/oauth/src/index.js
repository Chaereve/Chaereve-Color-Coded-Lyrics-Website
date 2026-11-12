/**
 * Cloudflare Worker — OAuth proxy cho Decap CMS (GitHub).
 *
 * Routes:
 *   GET /auth      : tạo state (CSRF) → redirect tới GitHub OAuth authorize.
 *   GET /callback  : xác minh state → đổi `code` lấy access token (server-side,
 *                    secret KHÔNG bao giờ ra trình duyệt) → trả token về Decap CMS
 *                    bằng window.postMessage (hợp thức Netlify/Decap handshake).
 *   GET /          : trang thông tin kiểm thử.
 *
 * Không lưu token vào database — mọi trạng thái nằm trong `state` đã ký (stateless).
 *
 * Secrets (đặt bằng `wrangler secret put`, KHÔNG commit):
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, REDIRECT_URI, [STATE_SECRET]
 */
const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN = 'https://github.com/login/oauth/access_token';
const GITHUB_USER = 'https://api.github.com/user';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 phút

const encoder = new TextEncoder();

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
}

/** Tạo state = timestamp.hex(HMAC(secret, timestamp)) — chống CSRF, không cần lưu server. */
async function createState(secret) {
  const ts = String(Date.now());
  const sig = hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(ts)));
  return `${ts}.${sig}`;
}

async function verifyState(state, secret, ttl = STATE_TTL_MS) {
  if (!state || !state.includes('.')) return false;
  const [tsHex, sig] = state.split('.');
  const ts = Number(tsHex);
  if (!Number.isFinite(ts)) return false;
  const age = Date.now() - ts;
  if (age < 0 || age > ttl) return false;
  const expect = hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(tsHex)));
  return timingSafeEqual(expect, sig);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Chỉ cho scope quen thuộc của Decap (open_authoring → public_repo, thường → repo). */
function sanitizeScope(scope) {
  const allowed = new Set(['repo', 'public_repo', 'read:user', 'user', 'workflow']);
  const list = String(scope || '')
    .split(/[,\s]+/)
    .filter((s) => allowed.has(s));
  return list.length > 0 ? list.join(' ') : 'public_repo';
}

function page(title, bodyHtml) {
  return new Response(
    `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;background:#0b1220;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><main style="max-width:28rem;padding:2rem;text-align:center">${bodyHtml}</main></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

/**
 * Trang trả token cho Decap CMS.
 * Hợp thức handshake của decap-cms-lib-auth (NetlifyAuthenticator):
 *   1. popup post 'authorizing:github' → opener (trang /admin) echo lại
 *   2. popup post 'authorization:github:success:{token,...}' → opener nhận token
 */
function tokenPage(status, data) {
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Đăng nhập GitHub</title></head>
<body style="font-family:system-ui,sans-serif;background:#0b1220;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<main style="max-width:28rem;padding:2rem;text-align:center">
  <p id="msg">Đang hoàn tất đăng nhập…</p>
  <p style="font-size:.8rem;color:#94a3b8">Nếu cửa sổ này không tự đóng, hãy đóng nó và quay lại tab Decap CMS.</p>
</main>
<script>
(function () {
  var status = ${JSON.stringify(status)};
  var data = ${payload};
  function postToOpener(targetOrigin) {
    try {
      window.opener.postMessage('authorization:github:' + status + ':' + JSON.stringify(data), targetOrigin);
      document.getElementById('msg').textContent = 'Đăng nhập thành công — quay lại tab Decap CMS.';
      setTimeout(function () { window.close(); }, 800);
    } catch (e) {
      document.getElementById('msg').textContent = 'Đã đăng nhập nhưng không đóng được popup — hãy đóng thủ công.';
    }
  }
  function receive(e) {
    if (typeof e.data === 'string' && e.data.indexOf('authorizing:github') === 0) {
      window.removeEventListener('message', receive, false);
      // Echo lại để opener biết popup đã sẵn sàng, sau đó gửi token.
      window.opener.postMessage(e.data, e.origin);
      setTimeout(function () { postToOpener(e.origin); }, 50);
    }
  }
  if (!window.opener) {
    document.getElementById('msg').textContent = 'Trang này chỉ dùng trong luồng đăng nhập từ Decap CMS.';
    return;
  }
  window.addEventListener('message', receive, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>
</body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');
  if (provider && provider !== 'github') {
    return page('Provider không hỗ trợ', '<p>Chỉ hỗ trợ provider <strong>github</strong>.</p>');
  }
  if (!env.GITHUB_CLIENT_ID || !env.REDIRECT_URI) {
    return page(
      'Chưa cấu hình OAuth',
      '<p>Worker thiếu <code>GITHUB_CLIENT_ID</code> hoặc <code>REDIRECT_URI</code>.</p>' +
        '<p style="font-size:.85rem;color:#94a3b8">Dùng <code>wrangler secret put</code> và <code>[vars]</code> — xem README.</p>',
    );
  }

  const state = await createState(env.STATE_SECRET || env.GITHUB_CLIENT_SECRET);
  const scope = sanitizeScope(url.searchParams.get('scope'));
  const authorizeUrl = new URL(GITHUB_AUTHORIZE);
  authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', env.REDIRECT_URI);
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);

  return Response.redirect(authorizeUrl.toString(), 302);
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const secret = env.STATE_SECRET || env.GITHUB_CLIENT_SECRET;

  if (!code || !state) {
    return page('Thiếu tham số', '<p>Thiếu <code>code</code> hoặc <code>state</code>.</p>');
  }
  if (!secret || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return page('Chưa cấu hình OAuth', '<p>Worker thiếu secret môi trường.</p>');
  }
  if (!(await verifyState(state, secret))) {
    return page('Phiên không hợp lệ', '<p><code>state</code> không đúng hoặc đã hết hạn (10 phút). Hãy thử đăng nhập lại.</p>');
  }

  try {
    const res = await fetch(GITHUB_TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'decap-oauth-worker',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.REDIRECT_URI,
      }),
    });
    const tokens = await res.json();

    if (tokens.error || !tokens.access_token) {
      return tokenPage('error', {
        error: tokens.error || 'token_error',
        error_description: tokens.error_description || 'Không đổi được access token.',
      });
    }

    // Lấy login để hiển thị trong payload (không bắt buộc).
    let user;
    try {
      const userRes = await fetch(GITHUB_USER, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'decap-oauth-worker',
        },
      });
      if (userRes.ok) {
        const profile = await userRes.json();
        user = profile.login;
      }
    } catch {
      /* bỏ qua */
    }

    return tokenPage('success', {
      token: tokens.access_token,
      provider: 'github',
      scope: tokens.scope || '',
      ...(user ? { user } : {}),
    });
  } catch (err) {
    return tokenPage('error', {
      error: 'worker_exception',
      error_description: err instanceof Error ? err.message : 'Lỗi không xác định.',
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    if (url.pathname === '/auth') return handleAuth(request, env);
    if (url.pathname === '/callback') return handleCallback(request, env);
    return page(
      'Decap OAuth Worker',
      '<h1 style="font-size:1.2rem">Decap OAuth Worker đang chạy</h1>' +
        '<p>Routes: <code>/auth</code> · <code>/callback</code></p>' +
        '<p style="font-size:.85rem;color:#94a3b8">Xem README để cấu hình GitHub OAuth App và secrets.</p>',
    );
  },
};
