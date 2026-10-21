import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SavedProvider } from '@/lib/saved';
import { SettingsProvider } from '@/lib/settings';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <SavedProvider>{children}</SavedProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
