import { useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { ListPage } from '@/components/list-page';
import { Message, Screen } from '@/components/ui';
import { apiPaths } from '@/core/api';
import { QUALIFICATIONS } from '@/core/constants';
import type { JobListPayload } from '@/core/types';
import { pageMeta } from '@/lib/seo';
import { payloads } from '@/server/data';

const find = (id: string) => QUALIFICATIONS.find((q) => q.id === id);

export async function generateStaticParams() {
  return QUALIFICATIONS.map((q) => ({ qualification: q.id }));
}

export const loader: LoaderFunction<JobListPayload | null> = (_req, params) =>
  find(String(params.qualification)) ? payloads.qualification(String(params.qualification)) : null;

export const generateMetadata: GenerateMetadataFunction = (_req, params) => {
  const q = find(String(params.qualification));
  if (!q) return null;
  return pageMeta(
    `Govt Jobs for ${q.label} ${new Date().getFullYear()}`,
    `Latest central and state government jobs you can apply for with ${q.label}, with last dates and official notification links.`,
    `/qualification/${q.id}`,
  );
};

export default function QualificationPage() {
  const { qualification } = useLocalSearchParams<{ qualification: string }>();
  const q = find(qualification);
  if (!q) return <Screen><Message text="Unknown qualification." /></Screen>;
  return <ListPage path={`/qualification/${q.id}`} title={`Govt Jobs for ${q.label}`} apiPath={apiPaths.qualification(q.id)} />;
}
