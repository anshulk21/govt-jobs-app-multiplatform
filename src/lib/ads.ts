// Apps: Google AdMob (react-native-google-mobile-ads). Off unless MONETIZATION.ads.enabled and the
// app was built with the AdMob app ID (not in Expo Go). Google's consent form (UMP) runs first.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { MONETIZATION } from '@/config/monetization';
import { canShowInterstitial } from './ad-rules';
import { track } from './analytics';

type GMA = typeof import('react-native-google-mobile-ads');
export type AdKind = 'banner' | 'native' | 'interstitial' | 'rewarded';

let gma: GMA | null | undefined;

export function adsLib(): GMA | null {
  if (gma !== undefined) return gma;
  const appId = Platform.OS === 'ios' ? MONETIZATION.ads.admob.iosAppId : MONETIZATION.ads.admob.androidAppId;
  if (!MONETIZATION.ads.enabled || !appId || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (gma = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    gma = require('react-native-google-mobile-ads') as GMA;
  } catch {
    gma = null;
  }
  return gma;
}

const TEST_ID: Record<AdKind, keyof GMA['TestIds']> = { banner: 'ADAPTIVE_BANNER', native: 'NATIVE', interstitial: 'INTERSTITIAL', rewarded: 'REWARDED' };

/** Ad unit ID for this platform; Google's test IDs in development. */
export function adUnitId(kind: AdKind): string | null {
  const lib = adsLib();
  if (!lib) return null;
  if (__DEV__) return lib.TestIds[TEST_ID[kind]] ?? null;
  return MONETIZATION.ads.admob[Platform.OS === 'ios' ? 'ios' : 'android'][kind] || null;
}

let ready: Promise<boolean> | null = null;
let canRequest = false;
const listeners = new Set<(ok: boolean) => void>();

/** Ask for consent where required (EEA/UK etc.), then start the SDK. Safe to call many times. */
export function initAds(): Promise<boolean> {
  ready ??= (async () => {
    const lib = adsLib();
    if (!lib) return false;
    try {
      await lib.AdsConsent.requestInfoUpdate();
      const info = await lib.AdsConsent.loadAndShowConsentFormIfRequired();
      canRequest = info.canRequestAds;
      if (canRequest) await lib.default().initialize();
    } catch {
      canRequest = false;
    }
    listeners.forEach((l) => l(canRequest));
    return canRequest;
  })();
  return ready;
}

export const adsReadyNow = () => canRequest;
export function onAdsReady(fn: (ok: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const launchedAt = Date.now();
let lastInterstitial: number | null = null;

/** Shows a full-screen ad if allowed (frequency-capped, never right after app open). */
export async function maybeShowInterstitial(): Promise<void> {
  const lib = adsLib();
  const unit = adUnitId('interstitial');
  if (!lib || !unit || !canRequest || !canShowInterstitial(Date.now(), launchedAt, lastInterstitial)) return;
  lastInterstitial = Date.now(); // count the attempt, so a failing ad doesn't retry on every screen
  const ad = lib.InterstitialAd.createForAdRequest(unit);
  await new Promise<void>((resolve) => {
    const offs = [
      ad.addAdEventListener(lib.AdEventType.LOADED, () => void ad.show().catch(() => {})),
      ad.addAdEventListener(lib.AdEventType.OPENED, () => track('ad_impression', { ad_format: 'interstitial' })),
      ad.addAdEventListener(lib.AdEventType.CLOSED, done),
      ad.addAdEventListener(lib.AdEventType.ERROR, done),
    ];
    const timer = setTimeout(done, 8000);
    function done() {
      clearTimeout(timer);
      offs.forEach((off) => off());
      resolve();
    }
    ad.load();
  });
}

export const rewardedAvailable = () => adsLib() !== null && adUnitId('rewarded') !== null;

/** Shows a rewarded ad; resolves true only if the user watched it to the end. */
export async function showRewarded(): Promise<boolean> {
  const lib = adsLib();
  const unit = adUnitId('rewarded');
  if (!lib || !unit || !(await initAds())) return false;
  const ad = lib.RewardedAd.createForAdRequest(unit);
  return new Promise<boolean>((resolve) => {
    let earned = false;
    const offs = [
      ad.addAdEventListener(lib.RewardedAdEventType.LOADED, () => void ad.show().catch(() => finish())),
      ad.addAdEventListener(lib.RewardedAdEventType.EARNED_REWARD, () => (earned = true)),
      ad.addAdEventListener(lib.AdEventType.OPENED, () => track('ad_impression', { ad_format: 'rewarded' })),
      ad.addAdEventListener(lib.AdEventType.CLOSED, () => finish()),
      ad.addAdEventListener(lib.AdEventType.ERROR, () => finish()),
    ];
    function finish() {
      offs.forEach((off) => off());
      resolve(earned);
    }
    ad.load();
  });
}

/** Website only (AdSense); nothing to do in the apps. */
export function loadAdSense(): void {}
