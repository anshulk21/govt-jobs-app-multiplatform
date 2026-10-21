import type { GenerateMetadataFunction } from 'expo-router/server';
import { ProsePage } from '@/components/prose-page';
import { APP } from '@/config/app';
import { pageMeta } from '@/lib/seo';

export const generateMetadata: GenerateMetadataFunction = () => pageMeta('Disclaimer', `${APP.name} is not a government website.`, '/disclaimer');

export default function Disclaimer() {
  return (
    <ProsePage
      title="Disclaimer"
      sections={[
        {
          paragraphs: [
            `${APP.name} is NOT a government website and is NOT affiliated with, endorsed by, or connected to any central or state government, ministry, commission, board or public sector undertaking.`,
            'Job details are summarised in our own words from official notifications. Dates, vacancies, eligibility and fees can change or contain errors. Always read the official notification and apply only on the official website.',
            'We never ask for money to apply for any job. If anyone asks you to pay us or an "agent" for a government job, it is a fraud.',
          ],
        },
      ]}
    />
  );
}
