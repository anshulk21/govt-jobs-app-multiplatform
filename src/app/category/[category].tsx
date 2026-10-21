import { useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { ListPage } from '@/components/list-page';
import { Message, Screen } from '@/components/ui';
import { apiPaths } from '@/core/api';
import { CATEGORIES, categoryFromSlug, categorySlug } from '@/core/constants';
import type { JobListPayload } from '@/core/types';
import { pageMeta } from '@/lib/seo';
import { payloads } from '@/server/data';

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: categorySlug(c) }));
}

export const loader: LoaderFunction<JobListPayload | null> = (_req, params) =>
  categoryFromSlug(String(params.category)) ? payloads.category(String(params.category)) : null;

export const generateMetadata: GenerateMetadataFunction = (_req, params) => {
  const cat = categoryFromSlug(String(params.category));
  if (!cat) return null;
  return pageMeta(
    `${cat} Jobs ${new Date().getFullYear()} — Latest Government Recruitment`,
    `All latest ${cat} government job notifications across India, with vacancies, qualification, age limit, last date and official links.`,
    `/category/${categorySlug(cat)}`,
  );
};

export default function CategoryPage() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const cat = categoryFromSlug(category);
  if (!cat) return <Screen><Message text="Unknown category." /></Screen>;
  return <ListPage path={`/category/${category}`} title={`${cat} Jobs`} apiPath={apiPaths.category(category)} />;
}
