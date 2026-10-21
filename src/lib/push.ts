// Push notifications in the apps: Firebase Cloud Messaging topics (see src/core/push.ts).
// Expo Go doesn't contain Firebase, so remote push is switched off there; local reminders
// (expo-notifications) still work. The website uses push.web.ts.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { topicsForPreferences } from '@/core/push';
import { track } from './analytics';
import { usePro } from './pro';
import { useSaved } from './saved';
import { useSettings } from './settings';
import { readJson, writeJson } from './storage';

type FirebaseMessaging = typeof import('@react-native-firebase/messaging');

const TOPICS_KEY = 'push:topics:v1';
export const ANDROID_CHANNEL_ID = 'jobs';

let firebase: FirebaseMessaging | null | undefined;

/** The Firebase messaging module, or null when unavailable (Expo Go, or Firebase not configured). */
function messagingModule(): FirebaseMessaging | null {
  if (firebase !== undefined) return firebase;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (firebase = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/messaging') as FirebaseMessaging;
    mod.getMessaging(); // throws if google-services.json / GoogleService-Info.plist were not set up
    firebase = mod;
  } catch {
    firebase = null;
  }
  return firebase;
}

/** True when this build can receive job alerts from the server. */
export function remotePushAvailable(): boolean {
  return messagingModule() !== null;
}

export type EnableResult = 'enabled' | 'denied';

/** Asks for notification permission (Android 13+ and iOS) and prepares the alert channel. */
export async function enableNotifications(): Promise<EnableResult> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Job alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  return granted ? 'enabled' : 'denied';
}

/** Subscribes to new topics and unsubscribes from ones no longer wanted. */
export async function syncTopics(desired: string[]): Promise<void> {
  const fb = messagingModule();
  if (!fb) return;
  const messaging = fb.getMessaging();
  const current = new Set((await readJson<string[]>(TOPICS_KEY)) ?? []);
  const want = new Set(desired);
  const done = new Set(current);
  for (const t of want) {
    if (current.has(t)) continue;
    try {
      await fb.subscribeToTopic(messaging, t);
      done.add(t);
    } catch {
      // Offline or Firebase error: retried on the next sync.
    }
  }
  for (const t of current) {
    if (want.has(t)) continue;
    try {
      await fb.unsubscribeFromTopic(messaging, t);
      done.delete(t);
    } catch {
      /* retried next time */
    }
  }
  await writeJson(TOPICS_KEY, [...done].sort());
}

function openFromNotification(data: Record<string, unknown> | undefined) {
  const url = data?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
}

/**
 * Keeps topic subscriptions in line with the user's choices and saved jobs, shows alerts
 * that arrive while the app is open, and opens the job when an alert is tapped.
 */
export function usePushNotifications(): void {
  const { ready, notifications, prefs } = useSettings();
  const { saved } = useSaved();
  const { isPro } = usePro();
  const savedIds = saved.map((s) => s.job.id).join(',');

  useEffect(() => {
    if (!ready) return;
    const topics = notifications ? topicsForPreferences(prefs, savedIds ? savedIds.split(',') : [], isPro) : [];
    void syncTopics(topics);
  }, [ready, notifications, prefs, savedIds, isPro]);

  useEffect(() => {
    const fb = messagingModule();
    if (!fb) return;
    const messaging = fb.getMessaging();
    // Alerts arriving while the app is open aren't shown by the system: show them ourselves.
    const offMessage = fb.onMessage(messaging, async (m) => {
      if (!m.notification) return;
      await Notifications.scheduleNotificationAsync({
        content: { title: m.notification.title ?? '', body: m.notification.body ?? '', data: m.data ?? {} },
        trigger: null,
      });
    });
    const opened = (data: Record<string, unknown> | undefined) => {
      track('push_open', { url: String(data?.url ?? '') });
      openFromNotification(data);
    };
    const offOpened = fb.onNotificationOpenedApp(messaging, (m) => opened(m.data));
    void fb.getInitialNotification(messaging).then((m) => m && opened(m.data));
    return () => {
      offMessage();
      offOpened();
    };
  }, []);
}
