import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { ListPage } from '@/components/list-page';
import { apiPaths } from '@/core/api';
import type { JobListPayload } from '@/core/types';
import { pageMeta } from '@/lib/seo';
import { payloads } from '@/server/data';

export const loader: LoaderFunction<JobListPayload> = () => payloads.updates('result');

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('Result ' + new Date().getFullYear() + ' — Latest Government Exams', 'Latest government exam results and merit lists, with official links.', '/result');

export default function ResultPage() {
  return <ListPage path="/result" title="Result" intro="Latest government exam results and merit lists, with official links." apiPath={apiPaths.updates('result')} splitExpired={false} />;
}
