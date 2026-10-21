// Cloudflare Pages Function: GET /oauth/callback — step 2 of "Login with GitHub".
// Exchanges GitHub's code for a token and hands it to the admin panel window (Decap CMS protocol).
// Needs GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET (secret) in Cloudflare.

interface Env {
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
}

/** Page that passes the result to the Decap window that opened the login popup (same site only). */
function reply(status: 'success' | 'error', content: object): Response {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const html = `<!doctype html><html><body><p>Logging in…</p><script>
(function () {
  var message = ${JSON.stringify(message)};
  function receive(e) {
    if (e.origin !== window.location.origin) return;
    window.opener.postMessage(message, e.origin);
    window.removeEventListener('message', receive);
    setTimeout(function () { window.close(); }, 500);
  }
  window.addEventListener('message', receive, false);
  window.opener && window.opener.postMessage('authorizing:github', window.location.origin);
})();
</script></body></html>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'set-cookie': 'oauth_state=; Path=/oauth; Max-Age=0' },
  });
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) return reply('error', { message: 'Admin login is not configured.' });
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = /(?:^|;\s*)oauth_state=([^;]+)/.exec(request.headers.get('cookie') ?? '')?.[1];
  if (!code || !state || state !== cookieState) return reply('error', { message: 'Login expired or invalid. Please try again.' });

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env.GITHUB_OAUTH_CLIENT_ID, client_secret: env.GITHUB_OAUTH_CLIENT_SECRET, code }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!data.access_token) return reply('error', { message: data.error_description ?? 'GitHub did not return a token.' });
  return reply('success', { token: data.access_token, provider: 'github' });
}
