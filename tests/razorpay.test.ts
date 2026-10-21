import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeToken, readToken, subscriptionStatus, verifySubscriptionSignature } from '../functions/pro/razorpay-core';

const SECRET = 'test_secret_key';

describe('Razorpay helpers', () => {
  it('verifies the checkout signature exactly as Razorpay computes it', async () => {
    const sig = createHmac('sha256', SECRET).update('pay_123|sub_456').digest('hex');
    expect(await verifySubscriptionSignature('pay_123', 'sub_456', sig, SECRET)).toBe(true);
    expect(await verifySubscriptionSignature('pay_123', 'sub_999', sig, SECRET)).toBe(false);
    expect(await verifySubscriptionSignature('pay_123', 'sub_456', sig, 'other')).toBe(false);
  });

  it('issues tokens that cannot be forged', async () => {
    const token = await makeToken('sub_456', SECRET);
    expect(await readToken(token, SECRET)).toBe('sub_456');
    const [payload] = token.split('.');
    expect(await readToken(`${payload}.deadbeef`, SECRET)).toBeNull();
    expect(await readToken(token, 'another-secret')).toBeNull();
    expect(await readToken('garbage', SECRET)).toBeNull();
  });

  it('treats active subscriptions, and paid time after cancelling, as Pro', () => {
    const now = 1_800_000_000;
    expect(subscriptionStatus({ id: 's', status: 'active', current_end: now + 100 }, now).active).toBe(true);
    expect(subscriptionStatus({ id: 's', status: 'cancelled', current_end: now + 100 }, now).active).toBe(true);
    expect(subscriptionStatus({ id: 's', status: 'cancelled', current_end: now - 100 }, now).active).toBe(false);
    expect(subscriptionStatus({ id: 's', status: 'halted', current_end: now + 100 }, now).active).toBe(false);
    expect(subscriptionStatus({ id: 's', status: 'created' }, now)).toEqual({ active: false, expiresAt: null });
  });
});
