import { useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { ListPage } from '@/components/list-page';
import { Message, Screen } from '@/components/ui';
import { apiPaths } from '@/core/api';
import { STATES, stateFromSlug } from '@/core/constants';
import type { JobListPayload } from '@/core/types';
import { pageMeta } from '@/lib/seo';
import { payloads } from '@/server/data';

export async function generateStaticParams() {
  return STATES.map((s) => ({ state: s.slug }));
}

export const loader: LoaderFunction<JobListPayload | null> = (_req, params) => {
  const info = stateFromSlug(String(params.state));
  return info ? payloads.state(info.code) : null;
};

export const generateMetadata: GenerateMetadataFunction = (_req, params) => {
  const info = stateFromSlug(String(params.state));
  if (!info) return null;
  return pageMeta(
    `${info.name} Govt Jobs ${new Date().getFullYear()} — Latest Vacancies`,
    `Latest ${info.name} government jobs: PSC, police, teacher, health, high court and other state recruitments, with last dates and official links.`,
    `/state/${info.slug}`,
  );
};

export default function StatePage() {
  const { state } = useLocalSearchParams<{ state: string }>();
  const info = stateFromSlug(state);
  if (!info) return <Screen><Message text="Unknown state." /></Screen>;
  return (
    <ListPage path={`/state/${info.slug}`}
      title={`${info.name} Government Jobs`}
      intro={`Recruitments by ${info.name} government bodies. Central government jobs are listed on the home page.`}
      apiPath={apiPaths.state(info.code)}
      showStateFilter={false}
    />
  );
}
