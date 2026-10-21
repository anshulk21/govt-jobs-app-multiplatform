import { Stack } from 'expo-router';
import { Platform, View } from 'react-native';
import { Screen, Txt } from './ui';

export interface ProseSection {
  heading?: string;
  paragraphs: string[];
}

export function ProsePage({ title, updated, sections }: { title: string; updated?: string; sections: ProseSection[] }) {
  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title }} /> : null}
      <Txt variant="h1">{title}</Txt>
      {updated ? <Txt variant="small">Last updated: {updated}</Txt> : null}
      {sections.map((s, i) => (
        <View key={i} className="gap-2">
          {s.heading ? <Txt variant="h2">{s.heading}</Txt> : null}
          {s.paragraphs.map((p, j) => (
            <Txt key={j}>{p}</Txt>
          ))}
        </View>
      ))}
    </Screen>
  );
}
