import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import type { ColorValue } from 'react-native';
import { Icon, type IconName } from '@/components/ui';
import { useT } from '@/lib/settings';

const tabIcon = (name: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon name={(focused ? name : `${name}-outline`) as IconName} size={24} color={color as string} />;
  };

export default function TabsLayout() {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const active = colorScheme === 'dark' ? '#bfdbfe' : '#1d4ed8';
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: active }}>
      <Tabs.Screen name="index" options={{ title: t('tab.home'), tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="search" options={{ title: t('tab.search'), tabBarIcon: tabIcon('search') }} />
      <Tabs.Screen name="saved" options={{ title: t('tab.saved'), tabBarIcon: tabIcon('bookmark') }} />
      <Tabs.Screen name="tools" options={{ title: t('tab.tools'), tabBarIcon: tabIcon('construct') }} />
      <Tabs.Screen name="more" options={{ title: t('tab.more'), tabBarIcon: tabIcon('menu') }} />
    </Tabs>
  );
}
