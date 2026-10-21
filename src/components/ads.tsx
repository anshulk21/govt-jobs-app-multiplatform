// App ads (AdMob): a native ad card for job lists and an adaptive banner. Nothing is rendered when
// ads are off, consent wasn't given, or the user is Pro.
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import type { NativeAd } from 'react-native-google-mobile-ads';
import { adUnitId, adsLib } from '@/lib/ads';
import { track } from '@/lib/analytics';
import { useAdsAllowed } from '@/lib/use-ads';
import { Badge } from './ui';

function NativeAdCard() {
  const lib = adsLib();
  const [ad, setAd] = useState<NativeAd | null>(null);
  useEffect(() => {
    const unit = adUnitId('native');
    if (!lib || !unit) return;
    let alive = true;
    let loaded: NativeAd | null = null;
    lib.NativeAd.createForAdRequest(unit)
      .then((a) => {
        loaded = a;
        if (!alive) return a.destroy();
        a.addAdEventListener(lib.NativeAdEventType.IMPRESSION, () => track('ad_impression', { ad_format: 'native' }));
        setAd(a);
      })
      .catch(() => {});
    return () => {
      alive = false;
      loaded?.destroy();
    };
  }, [lib]);
  if (!lib || !ad) return null;
  const { NativeAdView, NativeAsset, NativeAssetType } = lib;
  return (
    <NativeAdView nativeAd={ad} style={{ borderRadius: 16 }}>
      <View className="gap-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <View className="flex-row items-center gap-3">
          {ad.icon ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: ad.icon.url }} style={{ width: 40, height: 40, borderRadius: 8 }} />
            </NativeAsset>
          ) : null}
          <View className="flex-1">
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text className="text-base font-semibold text-slate-900 dark:text-slate-100" numberOfLines={2}>
                {ad.headline}
              </Text>
            </NativeAsset>
            {ad.advertiser ? (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text className="text-xs text-slate-500 dark:text-slate-400">{ad.advertiser}</Text>
              </NativeAsset>
            ) : null}
          </View>
          <Badge tone="amber">Ad</Badge>
        </View>
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text className="text-sm text-slate-600 dark:text-slate-300" numberOfLines={3}>
            {ad.body}
          </Text>
        </NativeAsset>
        {ad.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text className="self-start overflow-hidden rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white">{ad.callToAction}</Text>
          </NativeAsset>
        ) : null}
      </View>
    </NativeAdView>
  );
}

/** A native ad shown between jobs in a list. */
export function ListAd() {
  return useAdsAllowed() ? <NativeAdCard /> : null;
}

/** A banner ad (below lists). `placement` only matters on the website. */
export function BannerSlot(_props: { placement: 'belowList' | 'sidebar' }) {
  const allowed = useAdsAllowed();
  const lib = adsLib();
  const unit = adUnitId('banner');
  if (!allowed || !lib || !unit) return null;
  return (
    <View className="items-center">
      <lib.BannerAd unitId={unit} size={lib.BannerAdSize.ANCHORED_ADAPTIVE_BANNER} onAdImpression={() => track('ad_impression', { ad_format: 'banner' })} />
    </View>
  );
}
