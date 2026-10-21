import { router } from 'expo-router';
import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { useMemo, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { JobCard, JobList } from '@/components/jobs';
import { JsonLd } from '@/components/json-ld';
import { Button, Card, ChipLink, ChipRow, Icon, Loading, Message, OfflineNotice, Screen, Section, Txt } from '@/components/ui';
import { APP } from '@/config/app';
import { apiPaths } from '@/core/api';
import { CATEGORIES, QUALIFICATIONS, STATES, categorySlug } from '@/core/constants';
import { byPublished, closingSoon, matchesPreferences, newToday, openJobs } from '@/core/jobs';
import { websiteJsonLd } from '@/core/structured-data';
import type { JobListPayload } from '@/core/types';
import { useApi } from '@/lib/api';
import { useRouteData } from '@/lib/route-data';
import { pageMeta } from '@/lib/seo';
import { useSettings } from '@/lib/settings';
import { useMounted, useToday } from '@/lib/use-today';
import { payloads } from '@/server/data';

/** The pre-rendered home page carries only the newest jobs; the full list loads in the browser. */
const HOME_HTML_JOBS = 60;

export const loader: LoaderFunction<JobListPayload> = () => {
  const all = payloads.latest();
  return { ...all, jobs: all.jobs.slice(0, HOME_HTML_JOBS) };
};

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta(
    `${APP.name} — Latest Sarkari Jobs ${new Date().getFullYear()} from Official Sources`,
    'Latest central and state government jobs across India — SSC, UPSC, Railway, Bank, Police, Teaching and more — with last dates and official notification links.',
    '/',
  );

const POPULAR_STATES = ['UP', 'BR', 'RJ', 'MP', 'MH', 'TN', 'KA', 'WB', 'GJ', 'DL'];

function SearchBox() {
  const { t } = useSettings();
  const [q, setQ] = useState('');
  const go = () => router.push({ pathname: '/search', params: q.trim() ? { q: q.trim() } : {} });
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
      <Icon name="search" />
      <TextInput
        value={q}
        onChangeText={setQ}
        onSubmitEditing={go}
        returnKeyType="search"
        placeholder={t('home.searchPlaceholder')}
        placeholderTextColor="#94a3b8"
        aria-label="Search jobs"
        className="h-12 flex-1 text-base text-slate-900 dark:text-slate-100"
      />
    </View>
  );
}

function ForYou({ jobs, today }: { jobs: JobListPayload['jobs']; today: string }) {
  const { t, prefs, ready } = useSettings();
  const mounted = useMounted();
  // The pre-rendered page always shows the "Personalise" card (so nothing jumps while
  // loading); once this device's settings are read, personalised users see their jobs.
  const personalised = mounted && ready && (prefs.states.length > 0 || prefs.categories.length > 0 || prefs.qualifications.length > 0);
  if (!personalised) {
    return (
      <Card className="gap-3">
        <Txt variant="label">{t('home.personalise')}</Txt>
        <Button icon="options-outline" label={t('home.personaliseButton')} href="/onboarding" className="self-start" />
      </Card>
    );
  }
  const mine = openJobs(jobs, today).filter((j) => matchesPreferences(j, prefs));
  return (
    <Section title={t('home.forYou')}>
      {mine.length ? mine.slice(0, 5).map((j) => <JobCard key={j.slug} job={j} today={today} />) : <Message text={t('home.noneForYou')} />}
    </Section>
  );
}

export default function Home() {
  const { t } = useSettings();
  const base = useRouteData<JobListPayload>(apiPaths.latest);
  // On the website the page HTML holds the newest jobs; fetch the full list for "For you" and "Closing soon".
  const full = useApi<JobListPayload>(Platform.OS === 'web' ? apiPaths.latest : null);
  const data = full.data ?? base.data;
  const today = useToday(base.data?.generatedAt);

  const sections = useMemo(() => {
    const jobs = data?.jobs ?? [];
    return { today: newToday(jobs, today), closing: closingSoon(jobs, today, 7), latest: [...openJobs(jobs, today)].sort(byPublished) };
  }, [data, today]);

  return (
    <Screen>
      <JsonLd data={websiteJsonLd(APP.siteUrl, APP.name, APP.tagline)} />
      <View className="gap-1">
        <Txt variant="h1">Latest Government Jobs in India</Txt>
        <Txt variant="muted">{APP.tagline}</Txt>
      </View>
      <SearchBox />
      {base.offline ? <OfflineNotice /> : null}

      {!data ? (
        base.loading ? <Loading /> : <Message icon="cloud-offline-outline" text={t('common.error')} action={<Button kind="secondary" label={t('common.retry')} onPress={base.refresh} />} />
      ) : (
        <>
          <ForYou jobs={data.jobs} today={today} />
          {sections.today.length ? (
            <Section title={t('home.newToday')}>
              {sections.today.slice(0, 5).map((j) => <JobCard key={j.slug} job={j} today={today} />)}
            </Section>
          ) : null}
          {sections.closing.length ? (
            <Section title={t('home.closingSoon')} href={{ pathname: '/search', params: { closing: '7' } }}>
              {sections.closing.slice(0, 5).map((j) => <JobCard key={j.slug} job={j} today={today} />)}
            </Section>
          ) : null}
          <Section title={t('home.latest')} href="/search">
            <JobList jobs={sections.latest} today={today} splitExpired={false} limit={10} />
          </Section>
        </>
      )}

      <Section title={t('home.updates')}>
        <View className="flex-row flex-wrap gap-2">
          <Button kind="secondary" icon="id-card-outline" label="Admit Card" href="/admit-card" />
          <Button kind="secondary" icon="key-outline" label="Answer Key" href="/answer-key" />
          <Button kind="secondary" icon="trophy-outline" label="Result" href="/result" />
        </View>
      </Section>

      <Section title={t('home.browseStates')} href="/states">
        <ChipRow>
          {POPULAR_STATES.map((code) => {
            const s = STATES.find((x) => x.code === code)!;
            return (
              <ChipLink key={code} href={`/state/${s.slug}`} label={s.name} />
            );
          })}
        </ChipRow>
      </Section>

      <Section title={t('home.browseCategories')} href="/categories">
        <ChipRow>
          {CATEGORIES.map((c) => (
            <ChipLink key={c} href={`/category/${categorySlug(c)}`} label={c} />
          ))}
        </ChipRow>
      </Section>

      <Section title={t('home.browseQualifications')}>
        <ChipRow>
          {QUALIFICATIONS.map((q) => (
            <ChipLink key={q.id} href={`/qualification/${q.id}`} label={q.label} />
          ))}
        </ChipRow>
      </Section>

      <Txt variant="small">{t('common.notGovt')}</Txt>
    </Screen>
  );
}
