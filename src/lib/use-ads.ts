import { useEffect, useState } from 'react';
import { MONETIZATION } from '@/config/monetization';
import { adsReadyNow, initAds } from './ads';
import { usePro } from './pro';

/** True when ads may be shown here: switched on, consent given, and the user isn't Pro. */
export function useAdsAllowed(): boolean {
  const { isPro } = usePro();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!MONETIZATION.ads.enabled || isPro) return;
    if (adsReadyNow()) setReady(true);
    else void initAds().then(setReady);
  }, [isPro]);
  return MONETIZATION.ads.enabled && !isPro && ready;
}
