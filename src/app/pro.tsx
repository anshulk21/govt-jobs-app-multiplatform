import { Stack } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Badge, Button, Card, Field, Icon, Message, Screen, Txt } from '@/components/ui';
import { MONETIZATION } from '@/config/monetization';
import { formatDate } from '@/core/jobs';
import { track } from '@/lib/analytics';
import { usePro, type ProPlan } from '@/lib/pro';
import { pageMeta } from '@/lib/seo';

export const generateMetadata: GenerateMetadataFunction = () => ({ ...pageMeta('Pro', 'Ad-free job alerts with Pro tools.', '/pro'), robots: { index: false } });

const BENEFITS: [string, string][] = [
  ['No ads', 'A clean app and website.'],
  ['Alerts first', `New-job notifications reach Pro members first (others get them about ${MONETIZATION.pro.freeAlertDelayMinutes} minutes later).`],
  ['Unlimited saved jobs and reminders', `Free: ${MONETIZATION.freeLimits.savedJobs} saved jobs and ${MONETIZATION.freeLimits.reminders} reminders.`],
  ['PDF summary of any job', 'One page with every detail and official link — share or print it.'],
  ['"Eligible for me" filter', 'Only jobs that fit your age (with category relaxation) and qualification.'],
  ['Exam calendar', 'Every upcoming last date, exam date and apply-from date in one place.'],
  ['Full mock tests', 'Complete practice sets (the daily quiz stays free).'],
];

export default function ProScreen() {
  const pro = usePro();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [subId, setSubId] = useState('');

  useEffect(() => track('paywall_view'), []);

  if (!pro.enabled) {
    return (
      <Screen>
        <Message icon="information-circle-outline" text="Pro isn't available yet. All tools are free for now." />
      </Screen>
    );
  }

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const plans: ProPlan[] = pro.plans.length
    ? pro.plans
    : [
        { id: 'monthly', period: 'monthly', price: `₹${MONETIZATION.pro.prices.monthly}` },
        { id: 'yearly', period: 'yearly', price: `₹${MONETIZATION.pro.prices.yearly}` },
      ];

  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title: 'Pro' }} /> : null}
      <View className="gap-1">
        <Badge tone="brand">★ Pro</Badge>
        <Txt variant="h1">{pro.isPro ? 'You are Pro — thank you!' : 'Go Pro'}</Txt>
      </View>
      <Card className="gap-3">
        {BENEFITS.map(([title, text]) => (
          <View key={title} className="flex-row gap-3">
            <Icon name="checkmark-done-outline" className="text-green-700 dark:text-green-300" />
            <View className="flex-1">
              <Txt variant="label">{title}</Txt>
              <Txt variant="muted">{text}</Txt>
            </View>
          </View>
        ))}
      </Card>

      {pro.isPro ? null : pro.canPurchase ? (
        <View className="gap-2">
          {plans.map((p) => (
            <Button
              key={p.id}
              kind={p.period === 'yearly' ? 'primary' : 'secondary'}
              label={busy === p.id ? 'Please wait…' : `${p.price} / ${p.period === 'yearly' ? 'year' : 'month'}${p.period === 'yearly' ? ' — best value' : ''}`}
              disabled={!!busy}
              onPress={() => void run(p.id, () => pro.buy(p))}
            />
          ))}
          <Txt variant="small">Renews automatically. Cancel any time in {Platform.OS === 'ios' ? 'App Store' : Platform.OS === 'android' ? 'Google Play' : 'Razorpay'} subscriptions.</Txt>
        </View>
      ) : (
        <Message icon="information-circle-outline" text={pro.unavailableReason} />
      )}

      {pro.unlockedUntil && !pro.isPro ? <Txt variant="muted">Pro tools unlocked until {formatDate(pro.unlockedUntil)}.</Txt> : null}

      {!pro.isPro && pro.canPurchase ? (
        <Card className="gap-2">
          <Txt variant="label">Already subscribed?</Txt>
          {pro.restoreNeedsInput ? <Field label="Subscription ID (from the Razorpay email)" placeholder="sub_…" value={subId} onChangeText={setSubId} autoCapitalize="none" /> : null}
          <Button kind="ghost" label={busy === 'restore' ? 'Checking…' : 'Restore purchase'} disabled={!!busy} className="self-start" onPress={() => void run('restore', async () => {
            if (!(await pro.restore(subId.trim()))) throw new Error('No active subscription found.');
          })} />
        </Card>
      ) : null}
      {error ? <Txt className="text-red-700 dark:text-red-300">{error}</Txt> : null}
    </Screen>
  );
}
