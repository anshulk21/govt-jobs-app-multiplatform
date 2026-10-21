// Website: Google Analytics 4 (only when MONETIZATION.analytics.enabled and a measurement ID is set).
// Loaded after the page is interactive, so it doesn't slow the first paint.
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

type Gtag = (...args: unknown[]) => void;
let gtag: Gtag | null = null;

function lib(): Gtag | null {
  const id = MONETIZATION.analytics.webMeasurementId;
  if (gtag || !MONETIZATION.analytics.enabled || !id || typeof window === 'undefined') return gtag;
  const w = window as unknown as { dataLayer: unknown[]; gtag?: Gtag };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtagShim() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', id);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  gtag = w.gtag;
  return gtag;
}

export function track(event: AnalyticsEvent, params: Record<string, string | number> = {}): void {
  lib()?.('event', event, params);
}
