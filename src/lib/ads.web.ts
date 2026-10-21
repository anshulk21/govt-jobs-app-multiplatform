// Website: Google AdSense. The AdSense script is added only when the first ad slot appears
// (after the page has painted), so it doesn't slow the first load.
import { MONETIZATION } from '@/config/monetization';

export type AdKind = 'banner' | 'native' | 'interstitial' | 'rewarded';

const enabled = () => MONETIZATION.ads.enabled && !!MONETIZATION.ads.adsense.client;

export function initAds(): Promise<boolean> {
  return Promise.resolve(enabled());
}
export const adsReadyNow = enabled;
export const onAdsReady = (_fn: (ok: boolean) => void) => () => {};
export const maybeShowInterstitial = async () => {};
export const rewardedAvailable = () => false;
export const showRewarded = async () => false;

let scriptAdded = false;
export function loadAdSense(): void {
  if (scriptAdded || !enabled() || typeof document === 'undefined') return;
  scriptAdded = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${MONETIZATION.ads.adsense.client}`;
  document.head.appendChild(s);
}
