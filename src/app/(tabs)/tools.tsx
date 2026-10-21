import type { GenerateMetadataFunction } from 'expo-router/server';
import { View } from 'react-native';
import { LinkRow, Screen, Txt } from '@/components/ui';
import { pageMeta } from '@/lib/seo';
import { useSettings } from '@/lib/settings';

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta(
    'Free Tools for Govt Job Forms — Age Calculator, Photo Resizer, PDF',
    'Free tools for government job applications: age calculator, age eligibility with relaxation, photo & signature resizer, images to PDF, CGPA to percentage. Works in your browser.',
    '/tools',
  );

export default function ToolsPage() {
  const { t } = useSettings();
  return (
    <Screen>
      <Txt variant="h1">{t('tools.title')}</Txt>
      <Txt variant="muted">{t('tools.subtitle')}</Txt>
      <View>
        <LinkRow href="/tools/age-calculator" icon="calendar-number-outline" label={t('tools.age')} description={t('tools.ageDesc')} />
        <LinkRow href="/tools/age-eligibility" icon="checkmark-done-outline" label={t('tools.eligibility')} description={t('tools.eligibilityDesc')} />
        <LinkRow href="/tools/photo-resizer" icon="image-outline" label={t('tools.photo')} description={t('tools.photoDesc')} />
        <LinkRow href="/tools/images-to-pdf" icon="document-attach-outline" label={t('tools.pdf')} description={t('tools.pdfDesc')} />
        <LinkRow href="/tools/cgpa-to-percentage" icon="calculator-outline" label={t('tools.cgpa')} description={t('tools.cgpaDesc')} />
        <LinkRow href="/calendar" icon="calendar-number-outline" label="Exam calendar" description="Every upcoming last date and exam date" />
        <LinkRow href="/quiz" icon="school-outline" label="Daily quiz & mock tests" description="A free quiz every day" />
      </View>
    </Screen>
  );
}
