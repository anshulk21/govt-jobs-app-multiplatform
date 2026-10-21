// Light/dark switch for the website header and the app's home screen. Both icons are always
// rendered and the `dark:` classes pick one, so the pre-rendered page never shows the wrong icon.
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';
import { useSettings } from '@/lib/settings';
import { Icon } from './ui';

export function ThemeToggle() {
  const { update } = useSettings();
  const { colorScheme } = useColorScheme();
  return (
    <Pressable
      onPress={() => update({ theme: colorScheme === 'dark' ? 'light' : 'dark' })}
      role="button"
      aria-label="Switch between light and dark mode"
      className="gj-toggle h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white active:scale-90 dark:border-slate-700 dark:bg-slate-900"
    >
      <View className="gj-spin-in dark:hidden">
        <Icon name="moon-outline" size={20} className="text-ink" />
      </View>
      <View className="gj-spin-in hidden dark:flex">
        <Icon name="sunny-outline" size={20} className="text-sun" />
      </View>
    </Pressable>
  );
}
