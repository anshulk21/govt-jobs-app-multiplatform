import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CATEGORIES, QUALIFICATIONS, STAGES, STATES, type Category, type QualificationId } from '@/core/constants';
import { byUrgency, daysLeft, formatDate, isExpired, placeName, type JobFilters } from '@/core/jobs';
import type { JobSummary, TimelineEntry } from '@/core/types';
import { useT } from '@/lib/settings';
import { adPositions } from '@/lib/ad-rules';
import { ListAd } from './ads';
import { Reveal } from './motion';
import { Badge, Button, Card, Chip, ChipRow, Icon, Message, Txt } from './ui';

/** "5 days left", "Last day today", "Expired", or nothing if the date is unknown. */
export function DeadlineBadge({ lastDate, today }: { lastDate: string | null; today: string }) {
  const t = useT();
  const d = daysLeft(lastDate, today);
  if (d === null) return null;
  if (d < 0) return <Badge tone="neutral">{t('job.expired')}</Badge>;
  if (d === 0) return <Badge tone="red">{t('job.closesToday')}</Badge>;
  return <Badge tone={d <= 3 ? 'red' : d <= 7 ? 'amber' : 'green'}>{d === 1 ? t('job.oneDayLeft') : t('job.daysLeft', { n: d })}</Badge>;
}

const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));

/** Colour of the stripe on a job card: vermilion = closing within 3 days, sun = within a week, pink = open. */
function stripeClass(lastDate: string | null, today: string): string {
  const d = daysLeft(lastDate, today);
  if (d === null) return 'bg-rose';
  if (d < 0) return 'bg-slate-200 dark:bg-slate-700';
  return d <= 3 ? 'bg-brand-500' : d <= 7 ? 'bg-sun' : 'bg-pink';
}

export function JobCard({ job, today, updated }: { job: JobSummary; today: string; updated?: boolean }) {
  const t = useT();
  return (
    <Link href={`/jobs/${job.slug}`} asChild>
      <Pressable className="gj-card flex-row gap-3 rounded-3xl border border-slate-200 bg-white p-4 active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900">
        <View className={`w-1.5 self-stretch rounded-full ${stripeClass(job.lastDate, today)}`} />
        <View className="flex-1 gap-2">
          <Txt variant="label" numberOfLines={3}>
            {job.title}
          </Txt>
          <Txt variant="muted" numberOfLines={1}>
            {job.organization}
          </Txt>
          <View className="flex-row flex-wrap items-center gap-2">
            <DeadlineBadge lastDate={job.lastDate} today={today} />
            {job.stage !== 'notification' && job.stage !== 'apply' ? <Badge tone="brand">{STAGE_LABEL[job.stage]}</Badge> : null}
            {updated ? <Badge tone="amber">{t('job.updated')}</Badge> : null}
            <Badge>{placeName(job)}</Badge>
            <Badge>{job.category}</Badge>
          </View>
          <View className="flex-row flex-wrap gap-x-4 gap-y-1">
            {job.vacancies ? (
              <View className="flex-row items-center gap-1">
                <Icon name="people-outline" size={14} />
                <Txt variant="small">{t('job.posts', { n: job.vacancies.toLocaleString('en-IN') })}</Txt>
              </View>
            ) : null}
            {job.lastDate ? (
              <View className="flex-row items-center gap-1">
                <Icon name="calendar-outline" size={14} />
                <Txt variant="small">
                  {t('job.lastDate')}: {formatDate(job.lastDate)}
                </Txt>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

/** Open jobs first; expired ones in their own section (they stay online). */
export function JobList({ jobs, today, splitExpired = true, limit }: { jobs: JobSummary[]; today: string; splitExpired?: boolean; limit?: number }) {
  const t = useT();
  const [showExpired, setShowExpired] = useState(false);
  if (!jobs.length) return <Message icon="briefcase-outline" text={t('list.empty')} />;
  const open = splitExpired ? jobs.filter((j) => !isExpired(j, today)) : jobs;
  const expired = splitExpired ? jobs.filter((j) => isExpired(j, today)).sort(byUrgency(today)) : [];
  const shown = limit ? open.slice(0, limit) : open;
  const ads = new Set(adPositions(shown.length));
  return (
    <View className="gap-3">
      {shown.map((j, i) => (
        <Reveal key={j.slug} index={i} className="gap-3">
          <JobCard job={j} today={today} />
          {ads.has(i) ? <ListAd /> : null}
        </Reveal>
      ))}
      {!open.length ? <Message icon="briefcase-outline" text={t('list.empty')} /> : null}
      {expired.length ? (
        <View className="gap-3 pt-2">
          <Txt variant="h2">
            {t('list.expired')} ({expired.length})
          </Txt>
          {showExpired ? (
            expired.map((j) => <JobCard key={j.slug} job={j} today={today} />)
          ) : (
            <Button kind="secondary" icon="archive-outline" label={t('list.showExpired')} onPress={() => setShowExpired(true)} />
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Notification → Apply → Admit Card → Answer Key → Result, with reached stages highlighted. */
export function StatusTimeline({ timeline }: { timeline: TimelineEntry[] }) {
  return (
    <View className="gap-0">
      {STAGES.map((stage, i) => {
        const entry = timeline.find((e) => e.stage === stage.id);
        const done = !!entry;
        return (
          <View key={stage.id} className="flex-row gap-3">
            <View className="items-center">
              <View className={`h-4 w-4 rounded-full ${done ? 'bg-brand-500 ring-4 ring-brand-100 dark:ring-brand-900' : 'border-2 border-slate-300 dark:border-slate-600'}`} />
              {i < STAGES.length - 1 ? <View className={`w-0.5 flex-1 ${done ? 'bg-brand-200 dark:bg-brand-800' : 'bg-slate-200 dark:bg-slate-700'}`} /> : null}
            </View>
            <View className="flex-1 pb-4">
              <Txt variant={done ? 'label' : 'muted'}>{stage.label}</Txt>
              {entry?.date ? <Txt variant="small">{formatDate(entry.date)}</Txt> : null}
              {entry?.note ? <Txt variant="small">{entry.note}</Txt> : null}
              {entry?.url ? (
                <Link href={entry.url as never} target="_blank" rel="noopener" className="text-sm font-semibold text-brand-700 dark:text-brand-200">
                  Official link
                </Link>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Filter chips: Central/State, state, category, qualification, closing soon. */
export function FilterBar({ filters, onChange, states = true }: { filters: JobFilters; onChange: (f: JobFilters) => void; states?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState<'state' | 'category' | 'qualification' | null>(null);
  const set = (patch: Partial<JobFilters>) => onChange({ ...filters, ...patch });
  const toggleOpen = (k: typeof open) => setOpen((o) => (o === k ? null : k));
  const active = Boolean(filters.level || filters.state || filters.category || filters.qualification || filters.closingWithinDays !== undefined);

  return (
    <View className="gap-3">
      <ChipRow scroll>
        <Chip label={t('filter.all')} selected={!filters.level} onPress={() => set({ level: undefined })} />
        <Chip label={t('filter.central')} selected={filters.level === 'central'} onPress={() => set({ level: 'central', state: undefined })} />
        {states ? <Chip label={filters.state ? STATES.find((s) => s.code === filters.state)!.name : `${t('filter.state')} ▾`} selected={!!filters.state} onPress={() => toggleOpen('state')} /> : null}
        <Chip label={filters.category ?? `${t('filter.category')} ▾`} selected={!!filters.category} onPress={() => toggleOpen('category')} />
        <Chip
          label={filters.qualification ? QUALIFICATIONS.find((q) => q.id === filters.qualification)!.label : `${t('filter.qualification')} ▾`}
          selected={!!filters.qualification}
          onPress={() => toggleOpen('qualification')}
        />
        <Chip label={t('filter.closing')} selected={filters.closingWithinDays !== undefined} onPress={() => set({ closingWithinDays: filters.closingWithinDays === undefined ? 7 : undefined })} />
      </ChipRow>
      {open === 'state' ? (
        <Card>
          <ChipRow>
            {STATES.map((s) => (
              <Chip key={s.code} label={s.name} selected={filters.state === s.code} onPress={() => (set({ state: filters.state === s.code ? undefined : s.code, level: undefined }), setOpen(null))} />
            ))}
          </ChipRow>
        </Card>
      ) : null}
      {open === 'category' ? (
        <Card>
          <ChipRow>
            {CATEGORIES.map((c: Category) => (
              <Chip key={c} label={c} selected={filters.category === c} onPress={() => (set({ category: filters.category === c ? undefined : c }), setOpen(null))} />
            ))}
          </ChipRow>
        </Card>
      ) : null}
      {open === 'qualification' ? (
        <Card>
          <ChipRow>
            {QUALIFICATIONS.map((q) => (
              <Chip
                key={q.id}
                label={q.label}
                selected={filters.qualification === q.id}
                onPress={() => (set({ qualification: filters.qualification === q.id ? undefined : (q.id as QualificationId) }), setOpen(null))}
              />
            ))}
          </ChipRow>
        </Card>
      ) : null}
      {active ? <Button kind="ghost" icon="close-circle-outline" label={t('filter.clear')} onPress={() => onChange({ query: filters.query })} className="self-start" /> : null}
    </View>
  );
}
