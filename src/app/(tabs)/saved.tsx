import type { GenerateMetadataFunction } from 'expo-router/server';
import { View } from 'react-native';
import { JobCard } from '@/components/jobs';
import { Button, Message, Screen, Txt } from '@/components/ui';
import { apiPaths } from '@/core/api';
import { toSummary } from '@/core/jobs';
import type { JobListPayload } from '@/core/types';
import { useApi } from '@/lib/api';
import { useSaved } from '@/lib/saved';
import { pageMeta } from '@/lib/seo';
import { useSettings } from '@/lib/settings';
import { useMounted, useToday } from '@/lib/use-today';

export const generateMetadata: GenerateMetadataFunction = () => ({
  ...pageMeta('Saved Jobs', 'Jobs you saved on this device.', '/saved'),
  robots: { index: false },
});

export default function SavedPage() {
  const { t } = useSettings();
  const { saved, remove } = useSaved();
  const mounted = useMounted();
  const today = useToday();
  // Compare with the latest data to flag jobs that changed (admit card out, dates extended…).
  const latest = useApi<JobListPayload>(saved.length ? apiPaths.latest : null);
  const updatedAt = new Map(latest.data?.jobs.map((j) => [j.slug, j.updatedAt]));

  return (
    <Screen>
      <Txt variant="h1">{t('saved.title')}</Txt>
      {!mounted ? null : saved.length === 0 ? (
        <Message icon="bookmark-outline" text={t('saved.empty')} />
      ) : (
        saved.map((s) => {
          const newer = updatedAt.get(s.job.slug);
          return (
            <View key={s.job.slug} className="gap-1">
              <JobCard job={toSummary(s.job)} today={today} updated={!!newer && newer > s.seenUpdatedAt} />
              <Button kind="ghost" icon="trash-outline" label={t('saved.remove')} onPress={() => remove(s.job.slug)} className="self-end" />
            </View>
          );
        })
      )}
    </Screen>
  );
}
