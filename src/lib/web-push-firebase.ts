// Firebase browser SDK, loaded on demand by push.web.ts (only when web push is on).
// Both packages are imported here so they end up in one lazily-loaded file instead of
// leaking shared pieces into the bundle every page loads.
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

export async function getFcmToken(config: Record<string, string>, vapidKey: string, registration: ServiceWorkerRegistration): Promise<string> {
  return getToken(getMessaging(initializeApp(config)), { vapidKey, serviceWorkerRegistration: registration });
}
