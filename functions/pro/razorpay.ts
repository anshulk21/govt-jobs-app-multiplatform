// Worker routes for website Pro payments (POST, JSON):
//   /pro/razorpay/subscribe  {plan: 'monthly'|'yearly'}           → {subscriptionId, keyId}
//   /pro/razorpay/verify     {razorpay_payment_id, …_subscription_id, …_signature} → {token}
//   /pro/razorpay/status     {token}                               → {active, expiresAt}
//   /pro/razorpay/restore    {subscriptionId}                      → {token}
// Needs in Cloudflare (Settings → Variables and secrets, type Secret):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_MONTHLY_PLAN_ID, RAZORPAY_YEARLY_PLAN_ID
import { makeToken, readToken, subscriptionStatus, verifySubscriptionSignature, type RazorpaySubscription } from './razorpay-core';

export interface RazorpayEnv {
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_MONTHLY_PLAN_ID?: string;
  RAZORPAY_YEARLY_PLAN_ID?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const fail = (error: string, status = 400) => json({ error }, status);

async function api<T>(env: RazorpayEnv, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,
      'content-type': 'application/json',
    },
  });
  const data = (await res.json()) as T & { error?: { description?: string } };
  if (!res.ok) throw new Error(data.error?.description ?? `Razorpay error ${res.status}`);
  return data;
}

export async function handleRazorpay(request: Request, env: RazorpayEnv, action: string): Promise<Response> {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return fail('Online payments are not set up yet.', 503);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail('Bad request');
  }
  const secret = env.RAZORPAY_KEY_SECRET;
  const now = Math.floor(Date.now() / 1000);
  try {
    if (action === 'subscribe') {
      const yearly = body.plan === 'yearly';
      const planId = yearly ? env.RAZORPAY_YEARLY_PLAN_ID : env.RAZORPAY_MONTHLY_PLAN_ID;
      if (!planId) return fail('This plan is not set up yet.', 503);
      const sub = await api<RazorpaySubscription>(env, '/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, total_count: yearly ? 10 : 120, customer_notify: 1 }),
      });
      return json({ subscriptionId: sub.id, keyId: env.RAZORPAY_KEY_ID });
    }
    if (action === 'verify') {
      const { razorpay_payment_id: pay, razorpay_subscription_id: sub, razorpay_signature: sig } = body as Record<string, string>;
      if (!pay || !sub || !sig || !(await verifySubscriptionSignature(pay, sub, sig, secret))) return fail('Payment could not be verified.', 401);
      return json({ token: await makeToken(sub, secret) });
    }
    if (action === 'status') {
      const subId = typeof body.token === 'string' ? await readToken(body.token, secret) : null;
      if (!subId) return json({ active: false, expiresAt: null });
      return json(subscriptionStatus(await api<RazorpaySubscription>(env, `/subscriptions/${encodeURIComponent(subId)}`), now));
    }
    if (action === 'restore') {
      const subId = typeof body.subscriptionId === 'string' && /^sub_[A-Za-z0-9]+$/.test(body.subscriptionId) ? body.subscriptionId : null;
      if (!subId) return fail('Enter the subscription ID from your Razorpay email (starts with sub_).');
      const status = subscriptionStatus(await api<RazorpaySubscription>(env, `/subscriptions/${subId}`), now);
      if (!status.active) return fail('That subscription is not active.', 404);
      return json({ token: await makeToken(subId, secret) });
    }
  } catch (err) {
    return fail((err as Error).message, 502);
  }
  return fail('Not found', 404);
}
