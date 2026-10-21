import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { ListPage } from '@/components/list-page';
import { apiPaths } from '@/core/api';
import type { JobListPayload } from '@/core/types';
import { pageMeta } from '@/lib/seo';
import { payloads } from '@/server/data';

export const loader: LoaderFunction<JobListPayload> = () => payloads.updates('answer-key');

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('Answer Key ' + new Date().getFullYear() + ' — Latest Government Exams', 'Latest answer keys for government recruitment exams, with official links to check and raise objections.', '/answer-key');

export default function AnswerKeyPage() {
  return <ListPage path="/answer-key" title="Answer Key" intro="Latest answer keys for government recruitment exams, with official links to check and raise objections." apiPath={apiPaths.updates('answer-key')} splitExpired={false} />;
}
