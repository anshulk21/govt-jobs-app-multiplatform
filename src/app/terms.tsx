import type { GenerateMetadataFunction } from 'expo-router/server';
import { ProsePage } from '@/components/prose-page';
import { APP } from '@/config/app';
import { pageMeta } from '@/lib/seo';

export const generateMetadata: GenerateMetadataFunction = () => pageMeta('Terms of Use', `Terms for using ${APP.name}.`, '/terms');

export default function Terms() {
  return (
    <ProsePage
      title="Terms of Use"
      updated="20 October 2026"
      sections={[
        {
          paragraphs: [
            `By using ${APP.name} you agree to these terms.`,
            'The information here is provided for convenience only, without any guarantee of accuracy or completeness. The official notification published by the recruiting organisation is the only authoritative source.',
            'We are not responsible for any loss caused by relying on information in this app or website, including missed deadlines, wrong eligibility decisions or fees paid.',
            'Links to official websites and to third parties (including sponsored content and affiliate links, which are always labelled) are provided as-is; we do not control those websites.',
            'You may not copy our content in bulk, scrape the app or website, or use it to mislead others.',
            'We may change these terms; the date above shows the latest version.',
          ],
        },
      ]}
    />
  );
}
