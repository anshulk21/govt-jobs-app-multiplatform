import { useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { FilterBar, JobList } from '@/components/jobs';
import { Button, Icon, Loading, Message, OfflineNotice, Screen, Txt } from '@/components/ui';
import { apiPaths } from '@/core/api';
import { filterJobs, type JobFilters } from '@/core/jobs';
import type { JobListPayload } from '@/core/types';
import { useApi } from '@/lib/api';
import { pageMeta } from '@/lib/seo';
import { useSettings } from '@/lib/settings';
import { useToday } from '@/lib/use-today';

// Results depend on what the visitor types, so the page itself isn't indexed (links on it are followed).
export const generateMetadata: GenerateMetadataFunction = () => ({
  ...pageMeta('Search Government Jobs', 'Search and filter all latest government jobs by state, category, qualification and last date.', '/search'),
  robots: { index: false, follow: true },
});

export default function SearchPage() {
  const { t } = useSettings();
  const params = useLocalSearchParams<{ q?: string; closing?: string }>();
  const [filters, setFilters] = useState<JobFilters>(() => ({
    query: params.q ?? '',
    closingWithinDays: params.closing ? Number(params.closing) : undefined,
  }));
  const res = useApi<JobListPayload>(apiPaths.latest);
  const today = useToday(res.data?.generatedAt);
  const results = useMemo(() => (res.data ? filterJobs(res.data.jobs, filters, today) : []), [res.data, filters, today]);

  return (
    <Screen>
      <Txt variant="h1">{t('tab.search')}</Txt>
      <View className="flex-row items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
        <Icon name="search" />
        <TextInput
          value={filters.query}
          onChangeText={(query) => setFilters((f) => ({ ...f, query }))}
          placeholder={t('home.searchPlaceholder')}
          placeholderTextColor="#94a3b8"
          returnKeyType="search"
          autoCorrect={false}
          aria-label="Search jobs"
          className="h-12 flex-1 text-base text-slate-900 dark:text-slate-100"
        />
      </View>
      <FilterBar filters={filters} onChange={setFilters} />
      {res.offline ? <OfflineNotice /> : null}
      {res.data ? (
        <>
          <Txt variant="muted">{t('filter.results', { n: results.length })}</Txt>
          <JobList jobs={results} today={today} splitExpired={false} />
        </>
      ) : res.loading ? (
        <Loading />
      ) : (
        <Message icon="cloud-offline-outline" text={t('common.error')} action={<Button kind="secondary" label={t('common.retry')} onPress={res.refresh} />} />
      )}
    </Screen>
  );
}
