// Cloudflare Worker: serves the static website from dist/ and handles the only
// three dynamic routes (the handlers live in functions/, which also work on Pages):
//   GET  /oauth/auth       admin panel "Login with GitHub" (step 1)
//   GET  /oauth/callback   admin panel login (step 2)
//   POST /push/subscribe   website push topic subscriptions (only if web push is on)
import { onRequestGet as oauthAuth } from '../functions/oauth/auth';
import { onRequestGet as oauthCallback } from '../functions/oauth/callback';
import { onRequestPost as pushSubscribe } from '../functions/push/subscribe';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  FIREBASE_SERVICE_ACCOUNT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const method = request.method;
    if (pathname === '/oauth/auth' && method === 'GET') return oauthAuth({ request, env });
    if (pathname === '/oauth/callback' && method === 'GET') return oauthCallback({ request, env });
    if (pathname === '/push/subscribe' && method === 'POST') return pushSubscribe({ request, env });
    return env.ASSETS.fetch(request);
  },
};
