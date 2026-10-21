// When a full-screen ad may be shown (pure, tested).
import { MONETIZATION } from '@/config/monetization';

/**
 * Never in the first `graceSeconds` after the app opens (so never "on app open"), and at most
 * once every `minMinutes`.
 */
export function canShowInterstitial(
  now: number,
  launchedAt: number,
  lastShownAt: number | null,
  cfg = { graceSeconds: MONETIZATION.ads.interstitialGraceSeconds, minMinutes: MONETIZATION.ads.interstitialMinMinutes },
): boolean {
  if (now - launchedAt < cfg.graceSeconds * 1000) return false;
  return lastShownAt === null || now - lastShownAt >= cfg.minMinutes * 60_000;
}

/** Positions (after which job index) to insert list ads: every `every` jobs, never after the last one. */
export function adPositions(count: number, every = MONETIZATION.ads.listAdEvery): number[] {
  const out: number[] = [];
  for (let i = every - 1; i < count - 1; i += every) out.push(i);
  return out;
}
