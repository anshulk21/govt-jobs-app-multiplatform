import type { GenerateMetadataFunction } from 'expo-router/server';
import { Stack } from 'expo-router';
import { Platform, View } from 'react-native';
import { LinkRow, Screen, Txt } from '@/components/ui';
import { CATEGORIES, QUALIFICATIONS, categorySlug } from '@/core/constants';
import { pageMeta } from '@/lib/seo';

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('Government Jobs by Category & Qualification', 'Browse SSC, UPSC, Railway, Bank, Police, Teaching, Defence and other government jobs, or find jobs for your qualification.', '/categories');

export default function CategoriesPage() {
  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title: 'Categories' }} /> : null}
      <Txt variant="h1">Jobs by Category</Txt>
      <View className="gap-1">
        {CATEGORIES.map((c) => (
          <LinkRow key={c} href={`/category/${categorySlug(c)}`} icon="briefcase-outline" label={`${c} Jobs`} />
        ))}
      </View>
      <Txt variant="h2">Jobs by Qualification</Txt>
      <View className="gap-1">
        {QUALIFICATIONS.map((q) => (
          <LinkRow key={q.id} href={`/qualification/${q.id}`} icon="school-outline" label={`For ${q.label}`} />
        ))}
      </View>
    </Screen>
  );
}
