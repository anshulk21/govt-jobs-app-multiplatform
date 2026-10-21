// Cloudflare Pages Function: GET /oauth/auth — step 1 of "Login with GitHub" for the admin panel.
// Sends you to GitHub to approve, with a random state (checked in /oauth/callback).
// Needs GITHUB_OAUTH_CLIENT_ID (Cloudflare → Pages → Settings → Variables). See README → Admin.

interface Env {
  GITHUB_OAUTH_CLIENT_ID?: string;
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.GITHUB_OAUTH_CLIENT_ID) return new Response('Admin login is not configured (GITHUB_OAUTH_CLIENT_ID missing).', { status: 503 });
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') === 'repo' ? 'repo' : 'public_repo';
  const state = crypto.randomUUID();
  const github = new URL('https://github.com/login/oauth/authorize');
  github.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
  github.searchParams.set('redirect_uri', `${url.origin}/oauth/callback`);
  github.searchParams.set('scope', scope);
  github.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      location: github.toString(),
      'set-cookie': `oauth_state=${state}; Path=/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
