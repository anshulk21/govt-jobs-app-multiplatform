// Cloudflare Pages Function: POST /push/subscribe {token, add: string[], remove: string[]}
// Subscribes a browser's FCM token to topics (browsers can't do this themselves).
// Needs the FIREBASE_SERVICE_ACCOUNT variable in Cloudflare (Pages → Settings → Variables, encrypted).
// Only used when FEATURES.webPush is on.

interface Env {
  FIREBASE_SERVICE_ACCOUNT?: string;
}

const TOPIC = /^(all|central|cat_all|qual_any|state_[A-Z]{2}|cat_[a-z-]+|qual_[a-z0-9]+|job_[0-9a-f]{6,20})$/;
const MAX_TOPICS = 80;

const b64url = (data: ArrayBuffer | string) =>
  btoa(typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** OAuth access token for the service account (signed JWT exchanged at Google). */
async function accessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${claims}.${b64url(signature)}`,
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function batch(action: 'batchAdd' | 'batchRemove', topic: string, token: string, bearer: string): Promise<void> {
  const res = await fetch(`https://iid.googleapis.com/iid/v1:${action}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bearer}`, access_token_auth: 'true', 'content-type': 'application/json' },
    body: JSON.stringify({ to: `/topics/${topic}`, registration_tokens: [token] }),
  });
  if (!res.ok) throw new Error(`${action} ${topic}: ${res.status}`);
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return new Response('Web push is not configured', { status: 503 });
  let body: { token?: unknown; add?: unknown; remove?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const token = typeof body.token === 'string' && body.token.length < 4096 ? body.token : null;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string' && TOPIC.test(t)) : []);
  const add = list(body.add);
  const remove = list(body.remove);
  if (!token || add.length + remove.length > MAX_TOPICS) return new Response('Bad request', { status: 400 });

  const bearer = await accessToken(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT));
  await Promise.all([...add.map((t) => batch('batchAdd', t, token, bearer)), ...remove.map((t) => batch('batchRemove', t, token, bearer))]);
  return Response.json({ ok: true });
}
