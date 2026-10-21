import type { GenerateMetadataFunction } from 'expo-router/server';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { Button, Card, Chip, ChipRow, LinkRow, Screen, Txt } from '@/components/ui';
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
          <AlertsCard />
          <View>
            <LinkRow href="/onboarding" icon="options-outline" label={t('more.preferences')} description={summary.join(', ') || undefined} />
          </View>
        </>
      ) : null}
      <View>
        <LinkRow href="/states" icon="map-outline" label={t('more.states')} />
        <LinkRow href="/categories" icon="grid-outline" label={t('more.categories')} />
        <LinkRow href="/about" icon="information-circle-outline" label={t('more.about')} />
        <LinkRow href="/contact" icon="mail-outline" label={t('more.contact')} />
        <LinkRow href="/privacy" icon="shield-checkmark-outline" label={t('more.privacy')} />
        <LinkRow href="/terms" icon="document-outline" label={t('more.terms')} />
        <LinkRow href="/disclaimer" icon="alert-circle-outline" label={t('more.disclaimer')} />
      </View>
      <Txt variant="small">
        {APP.name} · {t('common.notGovt')}
      </Txt>
    </Screen>
  );
}
