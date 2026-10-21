// Apps: Pro via RevenueCat (Google Play Billing / App Store). Not available in Expo Go.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { MONETIZATION } from '@/config/monetization';

type Purchases = typeof import('react-native-purchases').default;

export interface ProPlan {
  id: string;
  period: 'monthly' | 'yearly';
  price: string;
}

export interface ProStatus {
  active: boolean;
  expiresAt: string | null;
}

let rc: Purchases | null | undefined;

function purchases(): Purchases | null {
  if (rc !== undefined) return rc;
  const cfg = MONETIZATION.pro.revenueCat;
  const apiKey = Platform.OS === 'ios' ? cfg.iosApiKey : cfg.androidApiKey;
  if (!MONETIZATION.pro.enabled || !apiKey || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (rc = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases').default as Purchases;
    mod.configure({ apiKey });
    rc = mod;
  } catch {
    rc = null;
  }
  return rc;
}

export const canPurchase = () => purchases() !== null;
export const purchaseUnavailableReason = 'Subscriptions work in the app from the Play Store / App Store.';

const statusFrom = (info: { entitlements: { active: Record<string, { expirationDate: string | null }> } }): ProStatus => {
  const ent = info.entitlements.active[MONETIZATION.pro.revenueCat.entitlement];
  return { active: Boolean(ent), expiresAt: ent?.expirationDate ?? null };
};

export async function fetchStatus(): Promise<ProStatus | null> {
  const p = purchases();
  return p ? statusFrom(await p.getCustomerInfo()) : null;
}

export async function fetchPlans(): Promise<ProPlan[]> {
  const p = purchases();
  if (!p) return [];
  const offering = (await p.getOfferings()).current;
  return (offering?.availablePackages ?? [])
    .map((pkg) => ({
      id: pkg.identifier,
      period: pkg.packageType === 'ANNUAL' ? ('yearly' as const) : pkg.packageType === 'MONTHLY' ? ('monthly' as const) : null,
      price: pkg.product.priceString,
    }))
    .filter((x): x is ProPlan => x.period !== null);
}

export async function buy(plan: ProPlan): Promise<ProStatus> {
  const p = purchases();
  if (!p) throw new Error(purchaseUnavailableReason);
  const pkg = (await p.getOfferings()).current?.availablePackages.find((x) => x.identifier === plan.id);
  if (!pkg) throw new Error('This plan is not available right now.');
  return statusFrom((await p.purchasePackage(pkg)).customerInfo);
}

export async function restore(_input?: string): Promise<ProStatus> {
  const p = purchases();
  if (!p) throw new Error(purchaseUnavailableReason);
  return statusFrom(await p.restorePurchases());
}

export const restoreNeedsInput = false;
