// A page listing jobs (state, category, qualification, admit card…), with filters.
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { filterJobs, type JobFilters } from '@/core/jobs';
import type { JobListPayload } from '@/core/types';
import { useRouteData } from '@/lib/route-data';
import { useSettings } from '@/lib/settings';
import { useToday } from '@/lib/use-today';
import { APP } from '@/config/app';
import { breadcrumbJsonLd } from '@/core/structured-data';
import { BannerSlot } from './ads';
import { FilterBar, JobList } from './jobs';
import { SponsoredCards } from './monetization';
import { JsonLd } from './json-ld';
import { Button, Loading, Message, OfflineNotice, Screen, Txt } from './ui';

export function ListPage({
  title,
  intro,
  apiPath,
  showStateFilter = true,
  showFilters = true,
  splitExpired = true,
  path,
}: {
  title: string;
  intro?: string;
  apiPath: string;
  showStateFilter?: boolean;
  showFilters?: boolean;
  splitExpired?: boolean;
  /** This page's URL path, for the breadcrumb structured data. */
  path: string;
}) {
  const { t } = useSettings();
  const res = useRouteData<JobListPayload>(apiPath);
  const today = useToday(res.data?.generatedAt);
  const [filters, setFilters] = useState<JobFilters>({});
  const jobs = useMemo(
    () => (res.data ? filterJobs(res.data.jobs, { ...filters, includeExpired: true }, today) : []),
    [res.data, filters, today],
  );

  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title }} /> : null}
      <JsonLd data={breadcrumbJsonLd(APP.siteUrl, [{ name: 'Home', path: '/' }, { name: title, path }])} />
      <Txt variant="h1">{title}</Txt>
      {intro ? <Txt variant="muted">{intro}</Txt> : null}
      {res.offline ? <OfflineNotice /> : null}
      <SponsoredCards cards={res.data?.sponsored} />
      {showFilters && res.data?.jobs.length ? <FilterBar filters={filters} onChange={setFilters} states={showStateFilter} /> : null}
      {res.data ? (
        <JobList jobs={jobs} today={today} splitExpired={splitExpired} />
      ) : res.loading ? (
        <Loading />
      ) : (
        <Message icon="cloud-offline-outline" text={t('common.error')} action={<Button kind="secondary" label={t('common.retry')} onPress={res.refresh} />} />
      )}
      <BannerSlot placement="belowList" />
    </Screen>
  );
}
