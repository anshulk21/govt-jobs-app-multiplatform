// Apps: Firebase Analytics (only when MONETIZATION.analytics.enabled and Firebase is set up).
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { MONETIZATION } from '@/config/monetization';

export type AnalyticsEvent =
  | 'job_view'
  | 'job_save'
  | 'job_share'
  | 'reminder_set'
  | 'push_open'
  | 'ad_impression'
  | 'paywall_view'
  | 'purchase'
  | 'rewarded_unlock'
  | 'quiz_complete';

type FA = typeof import('@react-native-firebase/analytics');
let fa: FA | null | undefined;

function lib(): FA | null {
  if (fa !== undefined) return fa;
  if (!MONETIZATION.analytics.enabled || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (fa = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/analytics') as FA;
    // Collection is off by default (firebase.json) and switched on only when you enable analytics.
    void mod.setAnalyticsCollectionEnabled(mod.getAnalytics(), true);
    fa = mod;
  } catch {
    fa = null;
  }
  return fa;
}

export function track(event: AnalyticsEvent, params: Record<string, string | number> = {}): void {
  const mod = lib();
  if (!mod) return;
  // Custom event names are allowed by Firebase; the typed overloads only list Google's own.
  void (mod.logEvent as (a: unknown, n: string, p: object) => Promise<void>)(mod.getAnalytics(), event, params).catch(() => {});
}
