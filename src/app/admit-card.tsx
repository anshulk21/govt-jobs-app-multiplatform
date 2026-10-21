import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { ListPage } from '@/components/list-page';
import { apiPaths } from '@/core/api';
import type { JobListPayload } from '@/core/types';
import { pageMeta } from '@/lib/seo';
import { payloads } from '@/server/data';

export const loader: LoaderFunction<JobListPayload> = () => payloads.updates('admit-card');

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('Admit Card ' + new Date().getFullYear() + ' — Latest Government Exams', 'Latest admit cards and hall tickets for government exams, with official download links.', '/admit-card');

export default function AdmitCardPage() {
  return <ListPage path="/admit-card" title="Admit Card" intro="Latest admit cards and hall tickets for government exams, with official download links." apiPath={apiPaths.updates('admit-card')} splitExpired={false} />;
}
