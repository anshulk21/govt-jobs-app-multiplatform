// Sends notifications to FCM topic conditions with the Firebase Admin SDK.
// Needs the FIREBASE_SERVICE_ACCOUNT environment variable (the service-account JSON).
// Without it (or with --dry-run), messages are only printed.
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { APP } from '../../src/config/app';
import type { PushContent } from '../../src/core/push';

export const ANDROID_CHANNEL_ID = 'jobs';

export interface Sender {
  live: boolean;
  send(condition: string, content: PushContent): Promise<void>;
}

export function createSender(opts: { dryRun?: boolean } = {}): Sender {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (opts.dryRun || !raw) {
    if (!opts.dryRun) console.log('FIREBASE_SERVICE_ACCOUNT not set — printing instead of sending.');
    return {
      live: false,
      async send(condition, c) {
        console.log(`[dry run] ${c.title} — ${c.body}\n          to: ${condition}`);
      },
    };
  }
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(raw)) });
  const messaging = getMessaging();
  return {
    live: true,
    async send(condition, c) {
      const id = await messaging.send({
        condition,
        notification: { title: c.title, body: c.body },
        data: { url: c.url },
        android: { priority: 'high', collapseKey: c.collapseKey, notification: { tag: c.collapseKey, channelId: ANDROID_CHANNEL_ID } },
        apns: { headers: { 'apns-collapse-id': c.collapseKey.slice(0, 64) }, payload: { aps: { sound: 'default' } } },
        webpush: { notification: { tag: c.collapseKey }, fcmOptions: { link: `${APP.siteUrl}${c.url}` } },
      });
      console.log(`sent ${id}: ${c.title}\n          to: ${condition}`);
    },
  };
}

/** Sends one notification to several conditions, reporting failures without stopping. */
export async function sendAll(sender: Sender, conditions: string[], content: PushContent): Promise<number> {
  let failures = 0;
  for (const condition of conditions) {
    try {
      await sender.send(condition, content);
    } catch (err) {
      failures++;
      console.error(`✗ failed: ${content.title} → ${condition}: ${(err as Error).message}`);
    }
  }
  return failures;
}
