// Website push notifications (experimental, behind FEATURES.webPush).
// The browser gets an FCM token, then asks our Cloudflare Pages Function (functions/push/subscribe.ts)
// to subscribe it to topics — browsers can't do that themselves.
import { useEffect } from 'react';
import { FEATURES } from '@/config/features';
import { FIREBASE_JS_VERSION, FIREBASE_WEB } from '@/config/firebase-web';
import { topicsForPreferences } from '@/core/push';
import { useSaved } from './saved';
import { useSettings } from './settings';
import { readJson, writeJson } from './storage';

const TOPICS_KEY = 'push:topics:v1';

export function remotePushAvailable(): boolean {
  return FEATURES.webPush && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window && !!FIREBASE_WEB.apiKey;
}

export type EnableResult = 'enabled' | 'denied';

export async function enableNotifications(): Promise<EnableResult> {
  if (!remotePushAvailable()) return 'denied';
  return (await Notification.requestPermission()) === 'granted' ? 'enabled' : 'denied';
}

let tokenPromise: Promise<string | null> | null = null;

function getWebToken(): Promise<string | null> {
  tokenPromise ??= (async () => {
    const { getFcmToken } = await import('./web-push-firebase');
    const { vapidKey, ...config } = FIREBASE_WEB;
    // The service worker receives config via its URL so the settings live in one place.
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?v=${FIREBASE_JS_VERSION}&config=${encodeURIComponent(JSON.stringify(config))}`,
    );
    return getFcmToken(config, vapidKey, registration);
  })().catch(() => null);
  return tokenPromise;
}

export async function syncTopics(desired: string[]): Promise<void> {
  if (!remotePushAvailable() || Notification.permission !== 'granted') return;
  const token = await getWebToken();
  if (!token) return;
  const current = (await readJson<string[]>(TOPICS_KEY)) ?? [];
  const add = desired.filter((t) => !current.includes(t));
  const remove = current.filter((t) => !desired.includes(t));
  if (!add.length && !remove.length) return;
  const res = await fetch('/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, add, remove }),
  }).catch(() => null);
  if (res?.ok) await writeJson(TOPICS_KEY, [...desired].sort());
}

export function usePushNotifications(): void {
  const { ready, notifications, prefs } = useSettings();
  const { saved } = useSaved();
  const savedIds = saved.map((s) => s.job.id).join(',');
  useEffect(() => {
    if (!ready || !remotePushAvailable()) return;
    void syncTopics(notifications ? topicsForPreferences(prefs, savedIds ? savedIds.split(',') : []) : []);
  }, [ready, notifications, prefs, savedIds]);
}
