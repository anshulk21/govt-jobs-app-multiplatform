import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { DeadlineBadge, StatusTimeline } from '@/components/jobs';
import { JsonLd } from '@/components/json-ld';
import { BooksBlock, CommunityButtons, SponsoredCards } from '@/components/monetization';
import { Badge, Button, Card, InfoRow, Loading, Message, OfflineNotice, Screen, Txt } from '@/components/ui';
import { APP } from '@/config/app';
import { apiPaths } from '@/core/api';
import { QUALIFICATIONS, STAGES, STATE_BY_CODE, categorySlug } from '@/core/constants';
import { daysLeft, formatDate, latestStage, placeName } from '@/core/jobs';
import { jobSummaryHtml } from '@/core/job-summary';
import { breadcrumbJsonLd, jobPostingJsonLd } from '@/core/structured-data';
import type { Job, JobPayload } from '@/core/types';
import { maybeShowInterstitial } from '@/lib/ads';
import { track } from '@/lib/analytics';
import { openExternal, shareOnWhatsApp } from '@/lib/links';
import { sharePdf } from '@/lib/print';
import { useLimit, usePro } from '@/lib/pro';
import { cancelReminder, remindedSlugs, setReminder } from '@/lib/reminders';
import { useRouteData } from '@/lib/route-data';
import { useSaved } from '@/lib/saved';
import { pageMeta } from '@/lib/seo';
import { useSettings } from '@/lib/settings';
import { useToday } from '@/lib/use-today';
import { getJob, pageTitleFor, payloads, publishedJobs } from '@/server/data';

export async function generateStaticParams() {
  return publishedJobs().map((j) => ({ slug: j.slug }));
}

export const loader: LoaderFunction<JobPayload | null> = (_req, params) => payloads.job(String(params.slug));

export const generateMetadata: GenerateMetadataFunction = (_req, params) => {
  const job = getJob(String(params.slug));
  if (!job) return null;
  const bits = [
    job.vacancies ? `${job.vacancies.toLocaleString('en-IN')} posts` : null,
    job.dates.lastDate ? `last date ${formatDate(job.dates.lastDate)}` : null,
    placeName(job),
  ].filter(Boolean);
  const title = pageTitleFor(job);
  return pageMeta(title, `${title} by ${job.organization}: ${bits.join(', ')}. Eligibility, fees, dates and official links.`, `/jobs/${job.slug}`);
};

/** Home › Uttar Pradesh (or category for central jobs) › Job */
function crumbs(job: Job): { name: string; path: string }[] {
  const state = job.state ? STATE_BY_CODE.get(job.state) : undefined;
  const middle = state
    ? { name: `${state.name} Jobs`, path: `/state/${state.slug}` }
    : { name: `${job.category} Jobs`, path: `/category/${categorySlug(job.category)}` };
  return [{ name: 'Home', path: '/' }, middle, { name: job.title, path: `/jobs/${job.slug}` }];
}

const qualLabel = (id: string) => QUALIFICATIONS.find((q) => q.id === id)?.label ?? id;

function ActionBar({ job, today }: { job: Job; today: string }) {
  const { t } = useSettings();
  const { isSaved, toggle } = useSaved();
  const { hasProTools } = usePro();
  const reminderLimit = useLimit('reminders');
  const [reminded, setReminded] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const saved = isSaved(job.slug);
  const left = daysLeft(job.dates.lastDate, today);

  useEffect(() => {
    void remindedSlugs().then((s) => setReminded(s.includes(job.slug)));
  }, [job.slug]);

  const share = () => {
    const lines = [
      job.title,
      job.vacancies ? `Posts: ${job.vacancies.toLocaleString('en-IN')}` : null,
      job.dates.lastDate ? `Last date: ${formatDate(job.dates.lastDate)}` : null,
      `${APP.siteUrl}/jobs/${job.slug}`,
    ];
    void shareOnWhatsApp(lines.filter(Boolean).join('\n'));
    track('job_share', { method: 'whatsapp' });
  };

  const save = () => {
    if (toggle(job) === 'limit') router.push('/pro');
  };

  const pdf = async () => {
    if (!hasProTools) return router.push('/pro');
    setPdfBusy(true);
    try {
      await sharePdf(jobSummaryHtml(job, APP.siteUrl, APP.name), job.title);
    } finally {
      setPdfBusy(false);
    }
  };

  const remind = async () => {
    if (reminded) {
      await cancelReminder(job.slug);
      setReminded(false);
      return;
    }
    if ((await remindedSlugs()).length >= reminderLimit) return router.push('/pro');
    const result = await setReminder(job);
    if (result === 'set') {
      setReminded(true);
      track('reminder_set');
    }
    else if (result === 'denied') Alert.alert('Notifications are off', 'Allow notifications for this app in your phone settings to get reminders.');
  };

  return (
    <View className="flex-row flex-wrap gap-2">
      <Button kind={saved ? 'primary' : 'secondary'} icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? t('job.saved') : t('job.save')} onPress={save} />
      <Button kind="secondary" icon="logo-whatsapp" label={t('job.share')} onPress={share} />
      {left !== null && left >= 0 ? (
        <Button
          kind="secondary"
          icon={reminded ? 'notifications' : 'notifications-outline'}
          label={reminded ? t('job.reminderSet') : t('job.remind')}
          onPress={() => void remind()}
        />
      ) : null}
      <Button kind="secondary" icon="document-text-outline" label={pdfBusy ? 'Making PDF…' : `PDF summary${hasProTools ? '' : ' ★'}`} disabled={pdfBusy} onPress={() => void pdf()} />
    </View>
  );
}

export default function JobPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useSettings();
  const { isSaved, refreshJob, saved } = useSaved();
  const res = useRouteData<JobPayload>(apiPaths.job(slug));
  const offlineCopy = saved.find((s) => s.job.slug === slug)?.job;
  const job = res.data?.job ?? offlineCopy;
  const today = useToday(res.data?.generatedAt);

  useEffect(() => {
    if (!res.data?.job) return;
    track('job_view', { slug: res.data.job.slug, category: res.data.job.category, state: res.data.job.state ?? 'central' });
    // A full-screen ad at most every few minutes, never right after the app opens.
    const timer = setTimeout(() => void maybeShowInterstitial(), 1200);
    return () => clearTimeout(timer);
  }, [res.data?.job.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the offline copy of a saved job up to date, and clear its "Updated" badge.
  useEffect(() => {
    if (res.data?.job && isSaved(res.data.job.slug)) refreshJob(res.data.job, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.data?.job.updatedAt]);

  if (!job) {
    return (
      <Screen>
        {res.loading ? <Loading /> : <Message icon="alert-circle-outline" text={res.error === 'Not found' ? t('job.notFound') : t('common.error')} />}
      </Screen>
    );
  }

  const see = t('job.seeOfficial');
  const stage = latestStage(job);
  const dates: [string, string | null][] = [
    [t('job.notificationDate'), job.dates.notification],
    [t('job.applyStart'), job.dates.applyStart],
    [t('job.lastDate'), job.dates.lastDate],
    [t('job.examDate'), job.dates.exam],
  ];

  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title: job.organization }} /> : null}
      {res.data ? <JsonLd data={[jobPostingJsonLd(job, APP.siteUrl, res.data.generatedAt), breadcrumbJsonLd(APP.siteUrl, crumbs(job))]} /> : null}
      {Platform.OS === 'web' ? (
        <View role="navigation" aria-label="Breadcrumb" className="flex-row flex-wrap items-center gap-1">
          {crumbs(job)
            .slice(0, -1)
            .map((c) => (
              <View key={c.path} className="flex-row items-center gap-1">
                <Link href={c.path as never} className="text-sm text-brand-700 dark:text-brand-200">
                  {c.name}
                </Link>
                <Txt variant="small">›</Txt>
              </View>
            ))}
        </View>
      ) : null}
      {job.sample ? <Badge tone="red">{t('job.sample')}</Badge> : null}
      {res.offline || (!res.data && offlineCopy) ? <OfflineNotice /> : null}

      <View className="gap-2">
        <Txt variant="h1">{job.title}</Txt>
        <Txt variant="muted">{job.organization}</Txt>
        <View className="flex-row flex-wrap gap-2">
          <DeadlineBadge lastDate={job.dates.lastDate} today={today} />
          {stage !== 'notification' && stage !== 'apply' ? <Badge tone="brand">{STAGES.find((s) => s.id === stage)!.label}</Badge> : null}
          <Badge>{placeName(job)}</Badge>
          <Badge>{job.category}</Badge>
        </View>
      </View>

      <ActionBar job={job} today={today} />

      <Card>
        <InfoRow label={t('job.post')} value={job.postName ?? see} />
        <InfoRow label={t('job.organization')} value={job.organization} />
        <InfoRow label={t('job.location')} value={placeName(job)} />
        <InfoRow label={t('job.vacancies')} value={job.vacancies ? job.vacancies.toLocaleString('en-IN') : see} />
        <InfoRow label={t('job.qualification')} value={job.qualifications.length ? job.qualifications.map(qualLabel).join(', ') : see} />
        <InfoRow label={t('job.ageLimit')} value={job.ageLimit ?? see} />
        <InfoRow label={t('job.fee')} value={job.fee ?? see} />
      </Card>

      <View className="gap-2">
        <Txt variant="h2">{t('job.importantDates')}</Txt>
        <Card>
          {dates.map(([label, value]) => (
            <InfoRow key={label} label={label} value={formatDate(value) ?? see} />
          ))}
        </Card>
      </View>

      <View className="gap-2">
        <Txt variant="h2">{t('job.howToApply')}</Txt>
        <Card>
          <Txt>{job.howToApply ?? `${see}. Read it fully, then apply only on the official website.`}</Txt>
        </Card>
      </View>

      <View className="gap-2">
        <Button icon="document-text-outline" label={t('job.officialPdf')} onPress={() => void openExternal(job.links.notification)} />
        {job.links.apply ? <Button kind="secondary" icon="open-outline" label={t('job.applyOnline')} onPress={() => void openExternal(job.links.apply!)} /> : null}
        <Button kind="secondary" icon="globe-outline" label={t('job.officialSite')} onPress={() => void openExternal(job.links.official)} />
      </View>

      <View className="gap-2">
        <Txt variant="h2">{t('job.status')}</Txt>
        <Card>
          <StatusTimeline timeline={job.timeline} />
        </Card>
      </View>

      <SponsoredCards cards={res.data?.sponsored} />
      <BooksBlock books={res.data?.books} />
      <CommunityButtons />
      <Txt variant="small">{t('job.verifyNote')}</Txt>
    </Screen>
  );
}
