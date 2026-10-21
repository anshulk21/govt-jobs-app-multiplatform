import type { GenerateMetadataFunction } from 'expo-router/server';
import { Stack } from 'expo-router';
import { Platform, View } from 'react-native';
import { LinkRow, Screen, Txt } from '@/components/ui';
import { STATES } from '@/core/constants';
import { pageMeta } from '@/lib/seo';

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('State-wise Government Jobs — All 28 States & 8 UTs', 'Browse government jobs for every Indian state and union territory.', '/states');

export default function StatesPage() {
  const groups = [
    { title: 'States', items: STATES.filter((s) => s.level === 'state') },
    { title: 'Union Territories', items: STATES.filter((s) => s.level === 'ut') },
  ];
  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title: 'States & UTs' }} /> : null}
      <Txt variant="h1">Jobs by State & UT</Txt>
      {groups.map((g) => (
        <View key={g.title} className="gap-1">
          <Txt variant="h2">{g.title}</Txt>
          {g.items.map((s) => (
            <LinkRow key={s.code} href={`/state/${s.slug}`} icon="location-outline" label={s.name} />
          ))}
        </View>
      ))}
    </Screen>
  );
}
