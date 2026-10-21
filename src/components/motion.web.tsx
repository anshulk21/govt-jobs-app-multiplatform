// Website entrance animations: CSS only (src/web.css), so the pre-rendered HTML animates before
// the app's JavaScript loads and nothing is hidden from search engines.
import type { ReactNode } from 'react';
import { View } from 'react-native';

export function Reveal({ children, index = 0, className = '' }: { children: ReactNode; index?: number; className?: string }) {
  return (
    <View className={`gj-reveal ${className}`} style={{ animationDelay: `${Math.min(index, 8) * 45}ms` } as object}>
      {children}
    </View>
  );
}
