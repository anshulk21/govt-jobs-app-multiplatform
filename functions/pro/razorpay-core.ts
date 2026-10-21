// Pure helpers for Razorpay on the Worker (Web Crypto, so they run on Cloudflare and in Node tests).

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** Constant-time string comparison. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Razorpay subscription checkout signature: HMAC-SHA256(payment_id + "|" + subscription_id, key_secret). */
export async function verifySubscriptionSignature(paymentId: string, subscriptionId: string, signature: string, secret: string): Promise<boolean> {
  return same(await hmacHex(secret, `${paymentId}|${subscriptionId}`), signature);
}

/** Signed token the browser keeps to prove it owns a subscription. */
export async function makeToken(subscriptionId: string, secret: string): Promise<string> {
  const payload = b64url(JSON.stringify({ s: subscriptionId }));
  return `${payload}.${await hmacHex(`${secret}:pro-token`, payload)}`;
}

export async function readToken(token: string, secret: string): Promise<string | null> {
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !same(await hmacHex(`${secret}:pro-token`, payload), sig)) return null;
  try {
    const s = (JSON.parse(fromB64url(payload)) as { s?: unknown }).s;
    return typeof s === 'string' ? s : null;
  } catch {
    return null;
  }
}

export interface RazorpaySubscription {
  id: string;
  status: string;
  current_end?: number | null;
}

/** Active while Razorpay says so, or until the end of a paid period after cancelling. */
export function subscriptionStatus(sub: RazorpaySubscription, nowSec: number): { active: boolean; expiresAt: string | null } {
  const end = sub.current_end ?? null;
  const paidUntilEnd = end !== null && end > nowSec && ['cancelled', 'completed', 'pending'].includes(sub.status);
  const active = sub.status === 'active' || sub.status === 'authenticated' || paidUntilEnd;
  return { active, expiresAt: end ? new Date(end * 1000).toISOString() : null };
}
