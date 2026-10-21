import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CATEGORIES, QUALIFICATIONS, STAGES, STATES, type Category, type QualificationId } from '@/core/constants';
import { byUrgency, daysLeft, formatDate, isExpired, placeName, type JobFilters } from '@/core/jobs';
import type { JobSummary, TimelineEntry } from '@/core/types';
import { useT } from '@/lib/settings';
import { adPositions } from '@/lib/ad-rules';
import { ListAd } from './ads';
import { monogram, toneFor } from './category-style';
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

/** Days-left box on job cards: vermilion = 3 days or less, sun = a week or less, pink = later. */
function Countdown({ lastDate, today }: { lastDate: string | null; today: string }) {
  const t = useT();
  const d = daysLeft(lastDate, today);
  if (d === null) return null;
  if (d < 0) {
    return (
      <View className="items-center justify-center rounded-2xl bg-slate-100 px-2.5 py-2 dark:bg-slate-800">
        <Text className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{t('job.expired')}</Text>
      </View>
    );
  }
  const { box, text } = d <= 3 ? { box: 'bg-brand-600', text: 'text-white' } : d <= 7 ? { box: 'bg-sun', text: 'text-ink' } : { box: 'bg-pink-light dark:bg-pink', text: 'text-ink' };
  return (
    <View className={`min-w-[56px] items-center justify-center rounded-2xl px-2 py-1.5 ${box}`} aria-label={d === 0 ? t('job.closesToday') : t('job.daysLeft', { n: d })}>
      <Text className={`text-xl font-black leading-6 ${text}`}>{d === 0 ? '!' : d}</Text>
      <Text className={`text-[10px] font-extrabold uppercase tracking-wide ${text}`}>{d === 0 ? 'today' : d === 1 ? 'day left' : 'days left'}</Text>
    </View>
  );
}

/** "BPSC"-style badge in the job's category colour. */
function OrgBadge({ job, size = 'md' }: { job: JobSummary; size?: 'md' | 'lg' }) {
  const tone = toneFor(job.category);
  const code = monogram(job.organization);
  return (
    <View className={`items-center justify-center rounded-2xl ${tone.box} ${size === 'lg' ? 'h-14 w-14' : 'h-12 w-12'}`} aria-hidden>
      <Text className={`font-black tracking-tight ${tone.text} ${code.length > 4 ? 'text-[11px]' : 'text-sm'}`}>{code}</Text>
    </View>
  );
}

const isNew = (job: JobSummary, today: string) => {
  const days = (Date.parse(today) - Date.parse(job.publishedAt.slice(0, 10))) / 86_400_000;
  return days >= 0 && days <= 1;
};

export function JobCard({ job, today, updated }: { job: JobSummary; today: string; updated?: boolean }) {
  const t = useT();
  return (
    <Link href={`/jobs/${job.slug}`} asChild>
      <Pressable className="gj-card gap-3 rounded-3xl border border-slate-200 bg-white p-4 active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900">
        <View className="flex-row items-start gap-3">
          <OrgBadge job={job} />
          <View className="flex-1 gap-1">
            <Text numberOfLines={1} className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {job.organization}
            </Text>
            <Txt variant="label" numberOfLines={3} className="font-extrabold leading-snug">
              {job.title}
            </Txt>
          </View>
          <Countdown lastDate={job.lastDate} today={today} />
        </View>
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row flex-wrap items-center gap-2">
            {isNew(job, today) ? <Badge tone="sun">NEW</Badge> : null}
            {job.stage !== 'notification' && job.stage !== 'apply' ? <Badge tone="brand">{STAGE_LABEL[job.stage]}</Badge> : null}
            {updated ? <Badge tone="amber">{t('job.updated')}</Badge> : null}
            <Badge>{placeName(job)}</Badge>
            <Badge>{job.category}</Badge>
            {job.vacancies ? <Badge>{t('job.posts', { n: job.vacancies.toLocaleString('en-IN') })}</Badge> : null}
          </View>
          <View className="gj-arrow h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Icon name="arrow-forward" size={16} className="text-brand-700 dark:text-brand-200" />
          </View>
        </View>
        {job.lastDate ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="calendar-outline" size={14} />
            <Txt variant="small">
              {t('job.lastDate')}: {formatDate(job.lastDate)}
            </Txt>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

/** Big colourful cards in a sideways row (home page "New today"). */
export function FeaturedJobs({ jobs, today }: { jobs: JobSummary[]; today: string }) {
  const t = useT();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gj-snap" contentContainerClassName="gap-3 pb-2">
      {jobs.map((job, i) => {
        const tone = toneFor(job.category);
        const d = daysLeft(job.lastDate, today);
        return (
          <Reveal key={job.slug} index={i}>
            <Link href={`/jobs/${job.slug}`} asChild>
              <Pressable className={`gj-tile h-full w-72 justify-between gap-4 rounded-[28px] p-5 active:scale-95 ${tone.box}`}>
                <View className="flex-row items-start justify-between">
                  <View className="rounded-2xl bg-white/90 px-3 py-2">
                    <Text className="text-sm font-black text-ink">{monogram(job.organization)}</Text>
                  </View>
                  {isNew(job, today) ? (
                    <View className="-rotate-6 rounded-full bg-white px-3 py-1">
                      <Text className="text-xs font-black text-brand-700">NEW</Text>
                    </View>
                  ) : null}
                </View>
                <View className="gap-1.5">
                  <Text numberOfLines={3} className={`text-xl font-black leading-6 tracking-tight ${tone.text}`}>
                    {job.title}
                  </Text>
                  <Text numberOfLines={1} className={`text-sm font-semibold ${tone.text}`}>
                    {job.organization}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className={`text-sm font-extrabold ${tone.text}`}>
                    {d === null ? placeName(job) : d < 0 ? t('job.expired') : d === 0 ? t('job.closesToday') : d === 1 ? t('job.oneDayLeft') : t('job.daysLeft', { n: d })}
                  </Text>
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-white">
                    <Icon name="arrow-forward" size={16} className="text-ink" />
                  </View>
                </View>
              </Pressable>
            </Link>
          </Reveal>
        );
      })}
    </ScrollView>
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
