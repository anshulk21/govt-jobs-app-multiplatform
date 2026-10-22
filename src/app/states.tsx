import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Reveal } from '@/components/motion';
import { FilterInput, PageHero } from '@/components/page-hero';
import { Icon, Message, Screen, Section } from '@/components/ui';
import { apiPaths } from '@/core/api';
import { STATES, type StateInfo } from '@/core/constants';
import type { CountsPayload } from '@/core/types';
import { useRouteData } from '@/lib/route-data';
import { pageMeta } from '@/lib/seo';
import { payloads } from '@/server/data';

export const loader: LoaderFunction<CountsPayload> = () => payloads.counts();

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('State-wise Government Jobs — All 28 States & 8 UTs', 'Browse government jobs for every Indian state and union territory.', '/states');

// The big state code cycles through these colours (all readable on white and on dark cards).
const CODE_COLOURS = [
  'text-brand-600 dark:text-brand-400',
  'text-rose-dark dark:text-pink',
  'text-ink dark:text-cream',
  'text-amber-700 dark:text-sun',
];

/** `width` sets how many boxes share a row: states use 4 on desktop, the union territories 1 (their own column on the right). */
function StateTile({ state, count, index, width }: { state: StateInfo; count: number; index: number; width: string }) {
  return (
    <View className={`p-1.5 ${width}`}>
      <Reveal index={index}>
        <Link href={`/state/${state.slug}`} asChild>
          <Pressable className="gj-card h-36 justify-between rounded-3xl border border-slate-200 bg-white p-4 active:scale-95 dark:border-slate-800 dark:bg-slate-900">
            <View className="flex-row items-start justify-between">
              <Text className={`text-4xl font-black tracking-tighter ${CODE_COLOURS[index % CODE_COLOURS.length]}`}>{state.code}</Text>
              {count ? <View className="gj-ping mt-2 h-2.5 w-2.5 rounded-full bg-brand-500" /> : null}
            </View>
            <View className="gap-1">
              <Text numberOfLines={1} className="text-base font-extrabold text-ink dark:text-slate-50">
                {state.name}
              </Text>
              {count ? (
                <Text className="self-start rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-100">
                  {count} open {count === 1 ? 'job' : 'jobs'}
                </Text>
              ) : (
                <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">No openings now</Text>
              )}
            </View>
          </Pressable>
        </Link>
      </Reveal>
    </View>
  );
}

export default function StatesPage() {
  const counts = useRouteData<CountsPayload>(apiPaths.counts).data;
  const [q, setQ] = useState('');
  const match = (s: StateInfo) => !q.trim() || `${s.name} ${s.code}`.toLowerCase().includes(q.trim().toLowerCase());
  const states = STATES.filter((s) => s.level === 'state' && match(s));
  const uts = STATES.filter((s) => s.level === 'ut' && match(s));
  const withJobs = Object.keys(counts?.byState ?? {}).length;
  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title: 'States & UTs' }} /> : null}
      <PageHero
        title="Jobs by"
        accent="State & UT"
        subtitle={`All 28 states and 8 union territories${withJobs ? ` — ${withJobs} with openings right now` : ''}. Pick yours to see every recruitment, admit card and result.`}
      >
        <FilterInput value={q} onChange={setQ} placeholder="Find your state, e.g. Bihar or UP" />
      </PageHero>

      <Link href={{ pathname: '/search', params: { level: 'central' } }} asChild>
        <Pressable className="gj-tile flex-row items-center gap-4 rounded-3xl bg-ink p-5 active:scale-95">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-brand-600">
            <Icon name="globe-outline" size={28} className="text-white" />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-black text-cream">All-India (Central) jobs</Text>
            <Text className="text-sm font-semibold text-slate-300">
              SSC, UPSC, Railway, Bank, Defence and more{counts?.central ? ` · ${counts.central} open` : ''}
            </Text>
          </View>
          <Icon name="arrow-forward" size={20} className="text-sun" />
        </Pressable>
      </Link>

      {/* Desktop: 5 equal columns (4 for states, 1 for UTs) so every box is the same size. */}
      <View className="gap-5 lg:-mx-1.5 lg:flex-row lg:items-start lg:gap-0">
        {states.length ? (
          <View className="lg:w-4/5 lg:px-1.5">
            <Section title="States" count={states.length}>
              <View className="-m-1.5 flex-row flex-wrap">
                {states.map((s, i) => (
                  <StateTile key={s.code} state={s} count={counts?.byState[s.code] ?? 0} index={i} width="w-1/2 sm:w-1/3 lg:w-1/4" />
                ))}
              </View>
            </Section>
          </View>
        ) : null}
        {uts.length ? (
          <View className="lg:w-1/5 lg:px-1.5">
            <Section title="Union Territories" count={uts.length}>
              <View className="-m-1.5 flex-row flex-wrap">
                {uts.map((s, i) => (
                  <StateTile key={s.code} state={s} count={counts?.byState[s.code] ?? 0} index={i} width="w-1/2 sm:w-1/3 lg:w-full" />
                ))}
              </View>
            </Section>
          </View>
        ) : null}
      </View>
      {!states.length && !uts.length ? <Message icon="map-outline" text={`No state or UT matches “${q}”.`} /> : null}
    </Screen>
  );
}
