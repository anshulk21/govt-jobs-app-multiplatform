// Root layout for the Android and iOS apps (the website uses _layout.web.tsx).
import '../global.css';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Providers } from '@/components/providers';
import { initAds } from '@/lib/ads';
import { usePushNotifications } from '@/lib/push';
import { useSettings } from '@/lib/settings';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

function AppStack() {
  const { colorScheme } = useColorScheme();
  const { ready, onboarded } = useSettings();
  usePushNotifications();

  // First launch: ask for language, states, categories and qualification.
  useEffect(() => {
    if (ready && !onboarded) router.push('/onboarding');
    // Google's consent form (if needed in the user's country) appears after onboarding, then ads start.
    if (ready && onboarded) void initAds();
  }, [ready, onboarded]);

  // Tapping a reminder (local notification, or a job alert shown while the app was open) opens the job.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="jobs/[slug]" options={{ title: '' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <Providers>
      <AppStack />
    </Providers>
  );
}
