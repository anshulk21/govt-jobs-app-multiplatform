// Sponsored cards, recommended books, community channels, and the Pro gate.
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Image, Linking, Platform, Pressable, View } from 'react-native';
import { MONETIZATION } from '@/config/monetization';
import type { Book, SponsoredCard } from '@/core/types';
import { rewardedAvailable } from '@/lib/ads';
import { openExternal } from '@/lib/links';
import { usePro } from '@/lib/pro';
import { Badge, Button, Card, Icon, Txt } from './ui';

/** Opens a paid/affiliate link; on the website it is a real link with rel="sponsored nofollow". */
function PaidLink({ url, children }: { url: string; children: ReactNode }) {
  if (Platform.OS === 'web') {
    return (
      // eslint-disable-next-line react/no-unknown-property
      <a href={url} target="_blank" rel="sponsored nofollow noopener" style={{ textDecoration: 'none' }}>
        {children}
      </a>
    );
  }
  return <Pressable onPress={() => void openExternal(url)}>{children}</Pressable>;
}

export function SponsoredCards({ cards }: { cards?: SponsoredCard[] }) {
  if (!MONETIZATION.sponsored.enabled || !cards?.length) return null;
  return (
    <View className="gap-3">
      {cards.slice(0, 2).map((c) => (
        <PaidLink key={c.id} url={c.url}>
          <Card className="gap-2 border-amber-200 dark:border-amber-900">
            <Badge tone="amber">Sponsored</Badge>
            <View className="flex-row gap-3">
              {c.image ? <Image source={{ uri: c.image }} style={{ width: 56, height: 56, borderRadius: 8 }} accessibilityLabel="" /> : null}
              <View className="flex-1 gap-1">
                <Txt variant="label">{c.title}</Txt>
                <Txt variant="muted">{c.text}</Txt>
              </View>
            </View>
            <Txt className="font-semibold text-brand-700 dark:text-brand-200">{c.cta || 'Learn more'} →</Txt>
          </Card>
        </PaidLink>
      ))}
    </View>
  );
}

export function BooksBlock({ books }: { books?: Book[] }) {
  if (!MONETIZATION.affiliate.enabled || !books?.length) return null;
  return (
    <View className="gap-2">
      <Txt variant="h2">Recommended books</Txt>
      {books.map((b) => (
        <PaidLink key={b.id} url={b.url}>
          <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            {b.image ? <Image source={{ uri: b.image }} style={{ width: 40, height: 56, borderRadius: 4 }} accessibilityLabel="" /> : <Icon name="school-outline" size={24} />}
            <View className="flex-1">
              <Txt variant="label" numberOfLines={2}>
                {b.title}
              </Txt>
              {b.author ? <Txt variant="small">{b.author}</Txt> : null}
            </View>
            <Txt variant="small">{b.store} →</Txt>
          </View>
        </PaidLink>
      ))}
      <Txt variant="small">Affiliate links: we may earn a small commission at no extra cost to you.</Txt>
    </View>
  );
}

export function CommunityButtons() {
  const { telegramUrl, whatsappUrl } = MONETIZATION.community;
  if (!telegramUrl && !whatsappUrl) return null;
  return (
    <Card className="gap-3">
      <Txt variant="label">Get every new job on your phone</Txt>
      <View className="flex-row flex-wrap gap-2">
        {telegramUrl ? <Button kind="secondary" icon="open-outline" label="Join Telegram channel" onPress={() => void Linking.openURL(telegramUrl)} /> : null}
        {whatsappUrl ? <Button kind="secondary" icon="logo-whatsapp" label="Join WhatsApp channel" onPress={() => void Linking.openURL(whatsappUrl)} /> : null}
      </View>
    </Card>
  );
}

/**
 * Shows `children` if the Pro tools are available; otherwise explains and offers Pro (and, in the
 * apps, a rewarded ad that unlocks the tools for 24 hours).
 */
export function ProGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { hasProTools, unlockWithAd } = usePro();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (hasProTools) return <>{children}</>;
  const watch = async () => {
    setBusy(true);
    setFailed(!(await unlockWithAd()));
    setBusy(false);
  };
  return (
    <Card className="gap-3">
      <Badge tone="brand">★ Pro</Badge>
      <Txt variant="label">{feature} is a Pro feature</Txt>
      <Txt variant="muted">Pro also removes ads and gives unlimited saved jobs and reminders.</Txt>
      <View className="flex-row flex-wrap gap-2">
        <Button icon="checkmark-done-outline" label="See Pro plans" onPress={() => router.push('/pro')} />
        {rewardedAvailable() ? (
          <Button kind="secondary" icon="trophy-outline" label={busy ? 'Loading ad…' : `Watch an ad — free for ${MONETIZATION.rewardedUnlockHours} h`} disabled={busy} onPress={() => void watch()} />
        ) : null}
      </View>
      {failed ? <Txt variant="small">The ad didn't finish, so nothing was unlocked. Please try again.</Txt> : null}
    </Card>
  );
}
