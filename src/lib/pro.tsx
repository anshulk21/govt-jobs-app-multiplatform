// Pro subscription state. If Pro is switched off (MONETIZATION.pro.enabled = false), every
// Pro tool is free for everyone and there are no limits.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MONETIZATION } from '@/config/monetization';
import { showRewarded } from './ads';
import { track } from './analytics';
import * as backend from './pro-backend';
import type { ProPlan, ProStatus } from './pro-backend';
import { readJson, writeJson } from './storage';

export type { ProPlan };

const STATUS_KEY = 'pro:v1';
const UNLOCK_KEY = 'pro:unlock-until';

interface ProContextValue {
  /** Pro is switched on in the config. */
  enabled: boolean;
  isPro: boolean;
  /** Pro tools (eligibility filter, PDF summary, exam calendar, full mock tests) can be used. */
  hasProTools: boolean;
  unlockedUntil: string | null;
  plans: ProPlan[];
  canPurchase: boolean;
  restoreNeedsInput: boolean;
  unavailableReason: string;
  buy: (plan: ProPlan) => Promise<void>;
  restore: (input?: string) => Promise<boolean>;
  /** Watch a rewarded ad to unlock the Pro tools for a while. */
  unlockWithAd: () => Promise<boolean>;
}

const ProContext = createContext<ProContextValue | null>(null);

export function ProProvider({ children }: { children: ReactNode }) {
  const enabled = MONETIZATION.pro.enabled;
  const [status, setStatus] = useState<ProStatus>({ active: false, expiresAt: null });
  const [unlockedUntil, setUnlockedUntil] = useState<string | null>(null);
  const [plans, setPlans] = useState<ProPlan[]>([]);

  const save = useCallback((s: ProStatus) => {
    setStatus(s);
    void writeJson(STATUS_KEY, s);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void readJson<ProStatus>(STATUS_KEY).then((s) => s && setStatus(s));
    void readJson<string>(UNLOCK_KEY).then((u) => u && setUnlockedUntil(u));
    void backend.fetchStatus().then((s) => s && save(s)).catch(() => {});
    void backend.fetchPlans().then(setPlans).catch(() => {});
  }, [enabled, save]);

  const isPro = enabled && status.active && (!status.expiresAt || Date.parse(status.expiresAt) > Date.now());
  const unlocked = !!unlockedUntil && Date.parse(unlockedUntil) > Date.now();

  const value = useMemo<ProContextValue>(
    () => ({
      enabled,
      isPro,
      hasProTools: !enabled || isPro || unlocked,
      unlockedUntil: unlocked ? unlockedUntil : null,
      plans,
      canPurchase: backend.canPurchase(),
      restoreNeedsInput: backend.restoreNeedsInput,
      unavailableReason: backend.purchaseUnavailableReason,
      buy: async (plan) => {
        const s = await backend.buy(plan);
        save(s);
        if (s.active) track('purchase', { plan: plan.period, currency: 'INR', value: MONETIZATION.pro.prices[plan.period] });
      },
      restore: async (input) => {
        const s = await backend.restore(input);
        save(s);
        return s.active;
      },
      unlockWithAd: async () => {
        if (!(await showRewarded())) return false;
        const until = new Date(Date.now() + MONETIZATION.rewardedUnlockHours * 3_600_000).toISOString();
        setUnlockedUntil(until);
        void writeJson(UNLOCK_KEY, until);
        track('rewarded_unlock');
        return true;
      },
    }),
    [enabled, isPro, unlocked, unlockedUntil, plans, save],
  );
  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro(): ProContextValue {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error('usePro must be used inside <ProProvider>');
  return ctx;
}

/** Free-user limit for saved jobs / reminders (Infinity when Pro or Pro is off). */
export function useLimit(kind: 'savedJobs' | 'reminders'): number {
  const { enabled, isPro } = usePro();
  return !enabled || isPro ? Infinity : MONETIZATION.freeLimits[kind];
}
