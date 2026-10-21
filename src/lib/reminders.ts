// Apps: "Remind me" schedules local notifications before the last date.
import * as Notifications from 'expo-notifications';
import type { Job } from '@/core/types';
import { reminderTimes } from './reminder-times';
import { readJson, writeJson } from './storage';

const KEY = 'reminders:v1';
export type ReminderResult = 'set' | 'denied' | 'no-date' | 'past';

export async function remindedSlugs(): Promise<string[]> {
  return (await readJson<string[]>(KEY)) ?? [];
}

export async function setReminder(job: Job): Promise<ReminderResult> {
  const lastDate = job.dates.lastDate;
  if (!lastDate) return 'no-date';
  const times = reminderTimes(lastDate, new Date());
  if (!times.length) return 'past';

  const perm = await Notifications.getPermissionsAsync();
  const granted = perm.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return 'denied';

  for (const { date, daysBefore } of times) {
    await Notifications.scheduleNotificationAsync({
      identifier: `reminder:${job.slug}:${daysBefore}`,
      content: {
        title: daysBefore === 0 ? 'Last day to apply today' : `Last ${daysBefore === 1 ? 'day' : `${daysBefore} days`} to apply`,
        body: job.title,
        data: { url: `/jobs/${job.slug}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
  const slugs = await remindedSlugs();
  if (!slugs.includes(job.slug)) await writeJson(KEY, [...slugs, job.slug]);
  return 'set';
}

export async function cancelReminder(slug: string): Promise<void> {
  for (const d of [3, 1, 0]) await Notifications.cancelScheduledNotificationAsync(`reminder:${slug}:${d}`).catch(() => {});
  await writeJson(KEY, (await remindedSlugs()).filter((s) => s !== slug));
}
