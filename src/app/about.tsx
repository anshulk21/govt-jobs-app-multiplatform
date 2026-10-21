import type { GenerateMetadataFunction } from 'expo-router/server';
import { ProsePage } from '@/components/prose-page';
import { APP } from '@/config/app';
import { pageMeta } from '@/lib/seo';

export const generateMetadata: GenerateMetadataFunction = () => pageMeta(`About ${APP.name}`, `${APP.name} lists Indian government job openings from official sources.`, '/about');

export default function About() {
  return (
    <ProsePage
      title={`About ${APP.name}`}
      sections={[
        {
          paragraphs: [
            `${APP.name} helps you find central and state government jobs across India in one place — for every state and union territory.`,
            'We check official recruitment websites (commissions, boards, ministries, PSUs, high courts and others) several times a day. Every new notice is reviewed by a person before it is published here.',
            'Each job page summarises the notification in simple words and links to the official notification and the official website. We never copy content from other job websites.',
          ],
        },
        {
          heading: 'Always verify',
          paragraphs: [
            `${APP.name} is not a government website and is not connected to any government body. Mistakes can happen, and dates can change. Always read the official notification before applying or paying any fee.`,
          ],
        },
      ]}
    />
  );
}
