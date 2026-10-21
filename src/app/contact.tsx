import type { GenerateMetadataFunction } from 'expo-router/server';
import { ProsePage } from '@/components/prose-page';
import { APP } from '@/config/app';
import { pageMeta } from '@/lib/seo';

export const generateMetadata: GenerateMetadataFunction = () => pageMeta('Contact', `Contact the ${APP.name} team.`, '/contact');

export default function Contact() {
  return (
    <ProsePage
      title="Contact"
      sections={[
        {
          paragraphs: [
            `Email: ${APP.contactEmail}`,
            'Found a mistake in a job, or a missing official source for your state? Write to us with the link to the official notification and we will fix it.',
            'We cannot help with individual applications, results or admit cards — please contact the recruiting organisation directly using the details in its notification.',
          ],
        },
      ]}
    />
  );
}
