// Entrance animations for the apps (Reanimated). The website version (motion.web.tsx) uses CSS,
// so pages are fully visible in the pre-rendered HTML. Both respect the system "reduce motion" setting.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

/** Fades and slides its children in; `index` staggers items in a list (capped so long lists don't lag). */
export function Reveal({ children, index = 0, className = '' }: { children: ReactNode; index?: number; className?: string }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45)
        .duration(320)
        .reduceMotion(ReduceMotion.System)}
    >
      <View className={className}>{children}</View>
    </Animated.View>
  );
}
