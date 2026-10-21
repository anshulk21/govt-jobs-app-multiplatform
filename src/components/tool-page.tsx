import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { Screen, Txt } from './ui';

export function ToolPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title }} /> : null}
      <Txt variant="h1">{title}</Txt>
      <Txt variant="muted">{intro}</Txt>
      {children}
    </Screen>
  );
}
