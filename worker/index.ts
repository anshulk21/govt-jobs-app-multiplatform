// Cloudflare Worker: serves the static website from dist/ and handles the only
// three dynamic routes (the handlers live in functions/, which also work on Pages):
//   GET  /oauth/auth       admin panel "Login with GitHub" (step 1)
//   GET  /oauth/callback   admin panel login (step 2)
//   POST /push/subscribe   website push topic subscriptions (only if web push is on)
//   GET  /oauth/status     setup check: says which login settings the Worker can see (never their values)
//   POST /pro/razorpay/*   website Pro payments (Razorpay)
// Plus scheduled(): Cron Triggers that start the monitor on time (see schedule.ts).
import { onRequestGet as oauthAuth } from '../functions/oauth/auth';
import { onRequestGet as oauthCallback } from '../functions/oauth/callback';
import { handleRazorpay, type RazorpayEnv } from '../functions/pro/razorpay';
import { onRequestPost as pushSubscribe } from '../functions/push/subscribe';
import { APP } from '../src/config/app';
import { startScheduledWorkflow, type ScheduleEnv } from './schedule';

interface Env extends RazorpayEnv, ScheduleEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  FIREBASE_SERVICE_ACCOUNT?: string;
}

/** Which admin-login settings this Worker can see. Shows names only, never values. */
function setupStatus(env: Env): Response {
  const names = Object.keys(env).filter((k) => k !== 'ASSETS');
  return Response.json({
    GITHUB_OAUTH_CLIENT_ID: Boolean(env.GITHUB_OAUTH_CLIENT_ID),
    GITHUB_OAUTH_CLIENT_SECRET: Boolean(env.GITHUB_OAUTH_CLIENT_SECRET),
    // Starts the monitor on time (Cron Triggers); without it GitHub's late schedule is used.
    GITHUB_ACTIONS_TOKEN: Boolean(env.GITHUB_ACTIONS_TOKEN),
    // Similar-looking names help spot typos such as a trailing space or wrong case.
    similarNamesFound: names.filter((k) => /git|oauth|client/i.test(k)),
    otherSettingsCount: names.length,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const method = request.method;
    if (pathname === '/oauth/status' && method === 'GET') return setupStatus(env);
    if (pathname === '/oauth/auth' && method === 'GET') return oauthAuth({ request, env });
    if (pathname === '/oauth/callback' && method === 'GET') return oauthCallback({ request, env });
    if (pathname === '/push/subscribe' && method === 'POST') return pushSubscribe({ request, env });
    const pro = pathname.match(/^\/pro\/razorpay\/(subscribe|verify|status|restore)$/);
    if (pro && method === 'POST') return handleRazorpay(request, env, pro[1]!);
    return env.ASSETS.fetch(request);
  },

  async scheduled(event: { cron: string }, env: Env): Promise<void> {
    console.log(await startScheduledWorkflow(event.cron, env, APP.githubRepo));
  },
};
