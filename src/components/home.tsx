// Home page pieces: the big hero, the live ticker of new jobs and the colourful category tiles.
// Motion on the website comes from the gj-* classes in src/web.css (ignored by the apps).
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { CATEGORIES, STATES, categorySlug, type Category } from '@/core/constants';
import { closingSoon, openJobs } from '@/core/jobs';
import type { JobSummary } from '@/core/types';
import { useT } from '@/lib/settings';
import { Reveal } from './motion';
import { Icon, type IconName } from './ui';

export interface HomeStats {
  open: number;
  closing: number;
  byCategory: Partial<Record<Category, number>>;
}

export function homeStats(jobs: JobSummary[], today: string): HomeStats {
  const open = openJobs(jobs, today);
  const byCategory: HomeStats['byCategory'] = {};
  for (const j of open) byCategory[j.category] = (byCategory[j.category] ?? 0) + 1;
  return {
    open: open.length,
    closing: closingSoon(jobs, today, 7).length,
    byCategory,
  };
}

function Stat({
  value,
  label,
  className,
  textClass,
  index,
}: {
  value: number | string;
  label: string;
  className: string;
  textClass: string;
  index: number;
}) {
  return (
    <Reveal index={index + 2}>
      <View className={`flex-row items-baseline gap-1.5 rounded-full px-4 py-2 ${className}`}>
        <Text className={`text-lg font-black ${textClass}`}>{value}</Text>
        <Text className={`text-sm font-semibold ${textClass}`}>{label}</Text>
      </View>
    </Reveal>
  );
}

export function Hero({ stats, children }: { stats: HomeStats; children: ReactNode }) {
  const t = useT();
  const line = 'text-4xl font-black uppercase leading-[0.95] tracking-tighter sm:text-6xl';
  return (
    <View className="relative overflow-hidden rounded-[32px] bg-cream-light px-5 pb-6 pt-9 dark:bg-slate-900">
      {/* Decorative shapes; hidden from screen readers. */}
      <View aria-hidden className="gj-float absolute -right-12 -top-12 h-44 w-44 rounded-full bg-pink/80" />
      <View aria-hidden className="gj-float-slow absolute -bottom-10 right-20 h-24 w-24 rounded-full bg-sun/90" />
      <View aria-hidden className="absolute left-5 top-4 h-2.5 w-2.5 rounded-full bg-brand-500" />
      <View aria-hidden className="absolute left-1/2 top-4 h-2.5 w-2.5 rounded-full bg-brand-500" />
      <View role="heading" aria-level={1} className="gap-0.5">
        <View className="gj-line">
          <Text className={`${line} text-ink dark:text-cream`}>{t('home.heroLine1')} </Text>
        </View>
        <View className="gj-line">
          <Text className={`${line} text-brand-600 dark:text-brand-400`}>{t('home.heroLine2')} </Text>
        </View>
        <View className="gj-line">
          <Text className={`${line} text-rose-dark dark:text-pink`}>{t('home.heroLine3')}</Text>
        </View>
      </View>
      <View className="mt-5 gap-4">
        {children}
        <View className="flex-row flex-wrap gap-2">
          <Stat index={0} value={stats.open.toLocaleString('en-IN')} label={t('home.statOpen')} className="bg-brand-700" textClass="text-white" />
          {stats.closing ? <Stat index={1} value={stats.closing} label={t('home.statClosing')} className="bg-sun" textClass="text-ink" /> : null}
          <Stat index={2} value={STATES.length} label={t('home.statStates')} className="bg-pink" textClass="text-ink" />
        </View>
      </View>
    </View>
  );
}

/** A scrolling strip of the newest job titles (on the website it moves by itself and pauses on hover). */
export function Ticker({ jobs }: { jobs: JobSummary[] }) {
  const t = useT();
  if (!jobs.length) return null;
  const items = (copy: number) =>
    jobs.map((j) => (
      <View key={`${copy}-${j.slug}`} className="flex-row items-center gap-6">
        <Link href={`/jobs/${j.slug}`} className="text-sm font-semibold text-cream hover:text-sun">
          {j.title.length > 70 ? `${j.title.slice(0, 68)}…` : j.title}
        </Link>
        <Text aria-hidden className="text-sun">
          ✦
        </Text>
      </View>
    ));
  const web = Platform.OS === 'web';
  const track = (
    <View className="gj-marquee flex-row gap-6 pr-6">
      {items(0)}
      {/* Second copy makes the loop seamless; hidden from screen readers. */}
      {web ? (
        <View aria-hidden className="flex-row gap-6">
          {items(1)}
        </View>
      ) : null}
    </View>
  );
  return (
    <View className="flex-row items-center gap-3 overflow-hidden rounded-full bg-ink py-3 pl-4">
      <View className="shrink-0 flex-row items-center gap-2 rounded-full bg-brand-700 px-3 py-1">
        <View className="gj-ping h-2 w-2 rounded-full bg-sun" />
        <Text className="text-xs font-black uppercase tracking-wider text-white">{t('home.live')}</Text>
      </View>
      {web ? (
        <View className="flex-1 overflow-hidden">{track}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
          {track}
        </ScrollView>
      )}
    </View>
  );
}

const CATEGORY_ICON: Record<Category, IconName> = {
  SSC: 'document-text-outline',
  UPSC: 'trophy-outline',
  Railway: 'train-outline',
  Bank: 'bank-outline',
  Defence: 'shield-outline',
  Police: 'siren-outline',
  Teaching: 'school-outline',
  PSU: 'factory-outline',
  PSC: 'building-outline',
  'Subordinate Services': 'briefcase-outline',
  Health: 'medkit-outline',
  'High Court': 'scale-outline',
  Electricity: 'flash-outline',
  Other: 'sparkles-outline',
};

// Tile colours cycle through the palette; each pairs with a text colour that passes contrast.
const TILE = [
  { box: 'bg-brand-600', text: 'text-white' },
  { box: 'bg-pink', text: 'text-ink' },
  { box: 'bg-sun', text: 'text-ink' },
  { box: 'bg-rose-dark', text: 'text-white' },
  { box: 'bg-ink', text: 'text-cream' },
];

export function CategoryTiles({ counts }: { counts: HomeStats['byCategory'] }) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {CATEGORIES.map((c, i) => {
        const s = TILE[i % TILE.length]!;
        const n = counts[c] ?? 0;
        return (
          <View key={c} className="grow basis-[46%] sm:basis-[30%]">
            <Reveal index={i}>
              <Link href={`/category/${categorySlug(c)}`} asChild>
                <Pressable className={`gj-tile min-h-[112px] justify-between gap-3 rounded-3xl p-4 active:scale-95 ${s.box}`}>
                  <View className="gj-tile-icon self-start">
                    <Icon name={CATEGORY_ICON[c]} size={26} className={s.text} />
                  </View>
                  <View>
                    <Text className={`text-xl font-black leading-6 tracking-tight ${s.text}`}>{c}</Text>
                    <Text className={`text-sm font-bold ${s.text}`}>{n ? `${n} open` : 'View jobs'} →</Text>
                  </View>
                </Pressable>
              </Link>
            </Reveal>
          </View>
        );
      })}
    </View>
  );
}
