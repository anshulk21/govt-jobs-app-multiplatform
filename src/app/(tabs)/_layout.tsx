import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { View, type ColorValue } from 'react-native';
import { ThemeToggle } from '@/components/theme-toggle';
import { Icon, type IconName } from '@/components/ui';
import { useT } from '@/lib/settings';

const tabIcon = (name: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon name={(focused ? name : `${name}-outline`) as IconName} size={24} color={color as string} />;
  };

export default function TabsLayout() {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const active = colorScheme === 'dark' ? '#ffc9b5' : '#c2340e';
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: active }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.home'),
          tabBarIcon: tabIcon('home'),
          headerRight: () => (
            <View className="mr-3">
              <ThemeToggle />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="search" options={{ title: t('tab.search'), tabBarIcon: tabIcon('search') }} />
      <Tabs.Screen name="saved" options={{ title: t('tab.saved'), tabBarIcon: tabIcon('bookmark') }} />
      <Tabs.Screen name="tools" options={{ title: t('tab.tools'), tabBarIcon: tabIcon('construct') }} />
      <Tabs.Screen name="more" options={{ title: t('tab.more'), tabBarIcon: tabIcon('menu') }} />
    </Tabs>
  );
}
