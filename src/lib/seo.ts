// Page titles and descriptions for the website (used by each route's generateMetadata).
import type { Metadata } from 'expo-router/server';
import { APP } from '@/config/app';

export function pageMeta(title: string, description: string, path: string): Metadata {
  const url = `${APP.siteUrl}${path}`;
  return {
    title: title.includes(APP.name) ? title : `${title} | ${APP.name}`,
    description: description.length > 160 ? `${description.slice(0, 157)}…` : description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: APP.name, type: 'website', locale: 'en_IN' },
  };
}
