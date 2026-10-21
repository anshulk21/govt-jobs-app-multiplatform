import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProProvider } from '@/lib/pro';
import { SavedProvider } from '@/lib/saved';
import { SettingsProvider } from '@/lib/settings';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ProProvider>
          <SavedProvider>{children}</SavedProvider>
        </ProProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
