import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { Link, Stack } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';
import { CategoryTiles } from '@/components/home';
import { Reveal } from '@/components/motion';
import { PageHero } from '@/components/page-hero';
import { Icon, Screen, Section } from '@/components/ui';
import { apiPaths } from '@/core/api';
import { QUALIFICATIONS } from '@/core/constants';
import type { CountsPayload } from '@/core/types';
import { useRouteData } from '@/lib/route-data';
import { pageMeta } from '@/lib/seo';
import { payloads } from '@/server/data';

export const loader: LoaderFunction<CountsPayload> = () => payloads.counts();

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('Government Jobs by Category & Qualification', 'Browse SSC, UPSC, Railway, Bank, Police, Teaching, Defence and other government jobs, or find jobs for your qualification.', '/categories');

export default function CategoriesPage() {
  const counts = useRouteData<CountsPayload>(apiPaths.counts).data;
  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title: 'Categories' }} /> : null}
      <PageHero title="Jobs by" accent="Category" subtitle="SSC, UPSC, Railway, Bank, Police, Teaching and more — or find jobs for your qualification." />

      <Section title="Categories">
        <CategoryTiles counts={counts?.byCategory ?? {}} />
      </Section>

      <Section title="Jobs by qualification">
        <View className="-m-1.5 flex-row flex-wrap">
          {QUALIFICATIONS.map((q, i) => {
            const n = counts?.byQualification[q.id] ?? 0;
            return (
              <View key={q.id} className="w-1/2 p-1.5 sm:w-1/3">
                <Reveal index={i}>
                  <Link href={`/qualification/${q.id}`} asChild>
                    <Pressable className="gj-card h-28 justify-between rounded-3xl border border-slate-200 bg-white p-4 active:scale-95 dark:border-slate-800 dark:bg-slate-900">
                      <View className="h-9 w-9 items-center justify-center rounded-xl bg-pink-light dark:bg-brand-900">
                        <Icon name="school-outline" size={18} className="text-brand-700 dark:text-brand-100" />
                      </View>
                      <View>
                        <Text numberOfLines={1} className="text-base font-extrabold text-ink dark:text-slate-50">
                          {q.label}
                        </Text>
                        <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">{n ? `${n} open` : 'View jobs'} →</Text>
                      </View>
                    </Pressable>
                  </Link>
                </Reveal>
              </View>
            );
          })}
        </View>
      </Section>
    </Screen>
  );
}
