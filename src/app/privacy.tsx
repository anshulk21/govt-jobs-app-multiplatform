import type { GenerateMetadataFunction } from 'expo-router/server';
import { ProsePage } from '@/components/prose-page';
import { APP } from '@/config/app';
import { pageMeta } from '@/lib/seo';

export const generateMetadata: GenerateMetadataFunction = () => pageMeta('Privacy Policy', `How ${APP.name} handles your data.`, '/privacy');

export default function Privacy() {
  return (
    <ProsePage
      title="Privacy Policy"
      updated="20 October 2026"
      sections={[
        {
          paragraphs: [
            `This policy explains what data the ${APP.name} app and website use. You do not need an account, and we never ask for your name, phone number or email to use the app.`,
          ],
        },
        {
          heading: 'Stored only on your device',
          paragraphs: [
            'Your language, theme, chosen states, job categories and qualification, your saved jobs and your reminders are stored on your device. They are not sent to us. Uninstalling the app or clearing site data deletes them.',
            'The tools (age calculator, photo resizer, images to PDF, CGPA converter) work entirely on your device. Photos and documents you select are never uploaded.',
          ],
        },
        {
          heading: 'Notifications',
          paragraphs: [
            'If you allow notifications, the app registers with Firebase Cloud Messaging (Google) and subscribes to topics matching your choices (for example "Uttar Pradesh" or "12th pass"). We do not link this to your identity. Reminders you set for a job are scheduled on your device.',
          ],
        },
        {
          heading: 'Advertising',
          paragraphs: [
            'The free version shows ads from Google AdMob (app) and Google AdSense (website). Google and its partners may use cookies or your device advertising ID to show and measure ads, including personalised ads where you have agreed to them. Where required, we ask for your consent first, and you can change it at any time. Learn more at https://policies.google.com/technologies/ads.',
          ],
        },
        {
          heading: 'Analytics',
          paragraphs: [
            'We use Google Firebase Analytics to understand how the app is used (for example, which pages are opened and which features are used) so we can improve it. This data is aggregated and does not identify you personally.',
          ],
        },
        {
          heading: 'Purchases',
          paragraphs: [
            'If you buy a Pro subscription, payment is handled by Google Play, the App Store or Razorpay. We receive confirmation of your subscription status, not your card or bank details.',
          ],
        },
        {
          heading: 'Children',
          paragraphs: ['The app is meant for job seekers aged 18 and above and is not directed at children.'],
        },
        {
          heading: 'Contact',
          paragraphs: [`Questions about privacy: ${APP.contactEmail}`],
        },
      ]}
    />
  );
}
