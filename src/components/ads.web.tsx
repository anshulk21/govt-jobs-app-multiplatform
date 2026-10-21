// Website ads (AdSense): in-list, below-list and desktop sidebar slots. Each reserves its height
// (no layout shift) and is labelled "Advertisement". Nothing renders when ads are off or for Pro users.
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { MONETIZATION } from '@/config/monetization';
import { loadAdSense } from '@/lib/ads';
import { useAdsAllowed } from '@/lib/use-ads';

function AdSenseSlot({ slot, minHeight, format = 'auto' }: { slot: string; minHeight: number; format?: string }) {
  useEffect(() => {
    loadAdSense();
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      /* ad blocked */
    }
  }, []);
  return (
    <View style={{ minHeight }} className="gap-1">
      <Text className="text-[10px] uppercase tracking-wide text-slate-400">Advertisement</Text>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', minHeight: minHeight - 16 }}
        data-ad-client={MONETIZATION.ads.adsense.client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </View>
  );
}

export function ListAd() {
  const slot = MONETIZATION.ads.adsense.slots.inList;
  return useAdsAllowed() && slot ? <AdSenseSlot slot={slot} minHeight={140} format="fluid" /> : null;
}

export function BannerSlot({ placement }: { placement: 'belowList' | 'sidebar' }) {
  const slot = MONETIZATION.ads.adsense.slots[placement];
  if (!useAdsAllowed() || !slot) return null;
  return <AdSenseSlot slot={slot} minHeight={placement === 'sidebar' ? 600 : 120} format={placement === 'sidebar' ? 'vertical' : 'auto'} />;
}
