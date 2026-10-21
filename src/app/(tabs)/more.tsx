import type { GenerateMetadataFunction } from 'expo-router/server';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { CommunityButtons } from '@/components/monetization';
import { Badge, Button, Card, Chip, ChipRow, Field, LinkRow, Screen, Txt } from '@/components/ui';
import { formatDate } from '@/core/jobs';
import { usePro } from '@/lib/pro';
import { RELAXATION_PRESETS, parseIndianDate } from '@/lib/tools/age';
import { APP } from '@/config/app';
import { QUALIFICATIONS, STATES } from '@/core/constants';
import { LANGUAGES } from '@/lib/i18n';
import { enableNotifications, remotePushAvailable } from '@/lib/push';
import { pageMeta } from '@/lib/seo';
import { useSettings, type ThemeSetting } from '@/lib/settings';
import { useMounted } from '@/lib/use-today';

export const generateMetadata: GenerateMetadataFunction = () => ({ ...pageMeta('Settings', 'Language, theme and job preferences.', '/more'), robots: { index: false } });

function AlertsCard() {
  const { t, notifications, update } = useSettings();
  const [denied, setDenied] = useState(false);
  const remote = remotePushAvailable();
  if (Platform.OS === 'web' && !remote) return null; // website push is off unless FEATURES.webPush is on

  const turnOn = async () => {
    const result = await enableNotifications();
    setDenied(result === 'denied');
    update({ notifications: result === 'enabled' });
  };

  return (
    <Card className="gap-3">
      <Txt variant="label">{t('more.alerts')}</Txt>
      <ChipRow>
        <Chip label={t('more.alertsOff')} selected={!notifications} onPress={() => update({ notifications: false })} />
        <Chip label="On" selected={notifications} onPress={() => void turnOn()} />
      </ChipRow>
      {notifications ? <Txt variant="muted">{t('more.alertsOn')}</Txt> : null}
      {denied ? (
        <>
          <Txt variant="muted">{t('more.alertsDenied')}</Txt>
          {Platform.OS !== 'web' ? <Button kind="secondary" label={t('more.openSettings')} onPress={() => void Linking.openSettings()} className="self-start" /> : null}
        </>
      ) : null}
      {!remote && Platform.OS !== 'web' ? <Txt variant="small">{t('more.alertsUnavailable')}</Txt> : null}
    </Card>
  );
}

function ProCard() {
  const { enabled, isPro, unlockedUntil } = usePro();
  if (!enabled) return null;
  return (
    <Card className="gap-2">
      <Badge tone="brand">★ Pro</Badge>
      <Txt variant="label">{isPro ? 'You are Pro' : 'No ads, alerts first, Pro tools'}</Txt>
      {unlockedUntil && !isPro ? <Txt variant="muted">Pro tools unlocked until {formatDate(unlockedUntil)}.</Txt> : null}
      <Button kind={isPro ? 'secondary' : 'primary'} label={isPro ? 'Manage Pro' : 'See Pro plans'} href="/pro" className="self-start" />
    </Card>
  );
}

function MyDetails() {
  const { profile, update } = useSettings();
  const [dob, setDob] = useState(profile.dob ? profile.dob.split('-').reverse().join('/') : '');
  const parsed = parseIndianDate(dob);
  return (
    <Card className="gap-3">
      <Txt variant="label">My details (for "Eligible for me")</Txt>
      <Field
        label="Date of birth"
        placeholder="DD/MM/YYYY"
        value={dob}
        keyboardType="numbers-and-punctuation"
        onChangeText={(v) => {
          setDob(v);
          const iso = parseIndianDate(v);
          if (iso || !v) update({ profile: { ...profile, dob: iso } });
        }}
        hint={dob && !parsed ? 'Enter a real date as DD/MM/YYYY.' : 'Stored only on this device.'}
      />
      <Txt variant="label">Category (for age relaxation)</Txt>
      <ChipRow>
        {RELAXATION_PRESETS.map((r) => (
          <Chip key={r.id} label={r.label} selected={profile.reservation === r.id} onPress={() => update({ profile: { ...profile, reservation: r.id } })} />
        ))}
      </ChipRow>
    </Card>
  );
}

export default function MorePage() {
  const { t, language, theme, prefs, update } = useSettings();
  const mounted = useMounted();
  const themes: [ThemeSetting, string][] = [
    ['system', t('more.themeSystem')],
    ['light', t('more.themeLight')],
    ['dark', t('more.themeDark')],
  ];
  const summary = [
    prefs.central ? 'Central' : null,
    ...prefs.states.map((c) => STATES.find((s) => s.code === c)?.name),
    ...prefs.qualifications.map((q) => QUALIFICATIONS.find((x) => x.id === q)?.label),
  ].filter(Boolean);

  return (
    <Screen>
      <Txt variant="h1">{t('tab.more')}</Txt>
      {mounted ? (
        <>
          <Card className="gap-3">
            <Txt variant="label">{t('more.language')}</Txt>
            <ChipRow>
              {LANGUAGES.map((l) => (
                <Chip key={l.code} label={l.label} selected={language === l.code} onPress={() => update({ language: l.code })} />
              ))}
            </ChipRow>
            <Txt variant="label">{t('more.theme')}</Txt>
            <ChipRow>
              {themes.map(([value, label]) => (
                <Chip key={value} label={label} selected={theme === value} onPress={() => update({ theme: value })} />
              ))}
            </ChipRow>
          </Card>
          <ProCard />
          <AlertsCard />
          <MyDetails />
          <View>
            <LinkRow href="/onboarding" icon="options-outline" label={t('more.preferences')} description={summary.join(', ') || undefined} />
          </View>
        </>
      ) : null}
      <View>
        <LinkRow href="/calendar" icon="calendar-number-outline" label="Exam calendar" />
        <LinkRow href="/quiz" icon="school-outline" label="Daily quiz & mock tests" />
        <LinkRow href="/states" icon="map-outline" label={t('more.states')} />
        <LinkRow href="/categories" icon="grid-outline" label={t('more.categories')} />
        <LinkRow href="/about" icon="information-circle-outline" label={t('more.about')} />
        <LinkRow href="/contact" icon="mail-outline" label={t('more.contact')} />
        <LinkRow href="/privacy" icon="shield-checkmark-outline" label={t('more.privacy')} />
        <LinkRow href="/terms" icon="document-outline" label={t('more.terms')} />
        <LinkRow href="/disclaimer" icon="alert-circle-outline" label={t('more.disclaimer')} />
      </View>
      <CommunityButtons />
      <Txt variant="small">
        {APP.name} · {t('common.notGovt')}
      </Txt>
    </Screen>
  );
}
