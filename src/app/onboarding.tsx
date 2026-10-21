// First-launch questions (also reachable later from More → My preferences).
// Answers stay on this device; Part 5 also subscribes them to push topics.
import { router } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, ChipRow, Txt } from '@/components/ui';
import { CATEGORIES, QUALIFICATIONS, STATES, type Category, type QualificationId } from '@/core/constants';
import type { Preferences } from '@/core/jobs';
import { LANGUAGES } from '@/lib/i18n';
import { enableNotifications, remotePushAvailable } from '@/lib/push';
import { pageMeta } from '@/lib/seo';
import { useSettings } from '@/lib/settings';

export const generateMetadata: GenerateMetadataFunction = () => ({ ...pageMeta('Personalise', 'Choose your states, job types and qualification.', '/onboarding'), robots: { index: false } });

const STEPS = ['language', 'states', 'categories', 'qualification'] as const;

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export default function Onboarding() {
  const { t, language, prefs: saved, update, ready } = useSettings();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>(saved);
  useEffect(() => {
    if (ready) setPrefs(saved);
    // Only when settings finish loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const skip = () => {
    update({ onboarded: true });
    close();
  };
  const finish = async () => {
    // Ask for notification permission right after explaining why (apps; website only with web push on).
    const canAsk = Platform.OS !== 'web' || remotePushAvailable();
    const notifications = canAsk ? (await enableNotifications()) === 'enabled' : false;
    update({ prefs, onboarded: true, notifications });
    close();
  };
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-3xl gap-5 px-4 py-6">
        <View className="flex-row gap-1.5">
          {STEPS.map((s, i) => (
            <View key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-700' : 'bg-slate-200 dark:bg-slate-800'}`} />
          ))}
        </View>

        {current === 'language' ? (
          <>
            <Txt variant="h1">{t('onboarding.welcome')} 🙏</Txt>
            <Txt variant="h2">{t('onboarding.language')}</Txt>
            <ChipRow>
              {LANGUAGES.map((l) => (
                <Chip key={l.code} label={l.label} selected={language === l.code} onPress={() => update({ language: l.code })} />
              ))}
            </ChipRow>
          </>
        ) : null}

        {current === 'states' ? (
          <>
            <Txt variant="h1">{t('onboarding.states')}</Txt>
            <ChipRow>
              <Chip label={t('onboarding.central')} selected={prefs.central} onPress={() => setPrefs((p) => ({ ...p, central: !p.central }))} />
            </ChipRow>
            <ChipRow>
              {STATES.map((s) => (
                <Chip key={s.code} label={s.name} selected={prefs.states.includes(s.code)} onPress={() => setPrefs((p) => ({ ...p, states: toggle(p.states, s.code) }))} />
              ))}
            </ChipRow>
          </>
        ) : null}

        {current === 'categories' ? (
          <>
            <Txt variant="h1">{t('onboarding.categories')}</Txt>
            <Txt variant="muted">{t('onboarding.categoriesHint')}</Txt>
            <ChipRow>
              {CATEGORIES.map((c: Category) => (
                <Chip key={c} label={c} selected={prefs.categories.includes(c)} onPress={() => setPrefs((p) => ({ ...p, categories: toggle(p.categories, c) }))} />
              ))}
            </ChipRow>
          </>
        ) : null}

        {current === 'qualification' ? (
          <>
            <Txt variant="h1">{t('onboarding.qualification')}</Txt>
            <Txt variant="muted">{t('onboarding.qualificationHint')}</Txt>
            {Platform.OS !== 'web' || remotePushAvailable() ? <Txt variant="muted">{t('onboarding.alertsNote')}</Txt> : null}
            <ChipRow>
              {QUALIFICATIONS.map((q) => (
                <Chip
                  key={q.id}
                  label={q.label}
                  selected={prefs.qualifications.includes(q.id)}
                  onPress={() => setPrefs((p) => ({ ...p, qualifications: toggle(p.qualifications, q.id as QualificationId) }))}
                />
              ))}
            </ChipRow>
          </>
        ) : null}
      </ScrollView>

      <View className="mx-auto w-full max-w-3xl flex-row gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        {step > 0 ? <Button kind="secondary" label={t('onboarding.back')} onPress={() => setStep(step - 1)} /> : <Button kind="ghost" label={t('onboarding.skip')} onPress={skip} />}
        <Button className="flex-1" label={last ? t('onboarding.done') : t('onboarding.next')} onPress={() => (last ? void finish() : setStep(step + 1))} />
      </View>
    </View>
  );
}
