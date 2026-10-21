// Website: Pro via Razorpay subscriptions. The Worker (functions/pro/razorpay.ts) creates the
// subscription and verifies payments with the secret key; the browser keeps a signed token.
import { MONETIZATION } from '@/config/monetization';
import { readJson, writeJson } from './storage';

export interface ProPlan {
  id: string;
  period: 'monthly' | 'yearly';
  price: string;
}

export interface ProStatus {
  active: boolean;
  expiresAt: string | null;
}

const TOKEN_KEY = 'pro:web-token';
const available = () => MONETIZATION.pro.enabled && MONETIZATION.pro.razorpay.enabled;

export const canPurchase = available;
export const purchaseUnavailableReason = 'Online payments are not set up yet.';
export const restoreNeedsInput = true;

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Payment server error (${res.status})`);
  return data;
}

async function statusFromToken(token: string): Promise<ProStatus> {
  const s = await post<ProStatus>('/pro/razorpay/status', { token });
  if (!s.active) await writeJson(TOKEN_KEY, null);
  return s;
}

export async function fetchStatus(): Promise<ProStatus | null> {
  const token = await readJson<string>(TOKEN_KEY);
  if (!available() || !token) return null;
  try {
    return await statusFromToken(token);
  } catch {
    return null; // offline: keep the cached status
  }
}

export async function fetchPlans(): Promise<ProPlan[]> {
  if (!available()) return [];
  const { monthly, yearly } = MONETIZATION.pro.prices;
  return [
    { id: 'monthly', period: 'monthly', price: `₹${monthly}` },
    { id: 'yearly', period: 'yearly', price: `₹${yearly}` },
  ];
}

function loadCheckout(): Promise<void> {
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay. Check your internet connection.'));
    document.body.appendChild(s);
  });
}

export async function buy(plan: ProPlan): Promise<ProStatus> {
  if (!available()) throw new Error(purchaseUnavailableReason);
  const { subscriptionId, keyId } = await post<{ subscriptionId: string; keyId: string }>('/pro/razorpay/subscribe', { plan: plan.period });
  await loadCheckout();
  const response = await new Promise<Record<string, string>>((resolve, reject) => {
    const Razorpay = (window as unknown as { Razorpay: new (o: object) => { open(): void } }).Razorpay;
    new Razorpay({
      key: keyId,
      subscription_id: subscriptionId,
      name: 'Pro subscription',
      description: plan.period === 'yearly' ? 'Yearly plan' : 'Monthly plan',
      handler: resolve,
      modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
    }).open();
  });
  const { token } = await post<{ token: string }>('/pro/razorpay/verify', response);
  await writeJson(TOKEN_KEY, token);
  return statusFromToken(token);
}

/** Restore on another browser with the subscription ID from Razorpay's email (sub_…). */
export async function restore(subscriptionId?: string): Promise<ProStatus> {
  if (!subscriptionId?.startsWith('sub_')) throw new Error('Enter the subscription ID from your Razorpay email (starts with sub_).');
  const { token } = await post<{ token: string }>('/pro/razorpay/restore', { subscriptionId });
  await writeJson(TOKEN_KEY, token);
  return statusFromToken(token);
}
