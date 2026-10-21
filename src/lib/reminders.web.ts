// Web: "Remind me" downloads a calendar file (works with Google Calendar, Outlook, Apple Calendar).
import { APP } from '@/config/app';
import type { Job } from '@/core/types';
import { buildIcs, reminderTimes } from './reminder-times';
import { readJson, writeJson } from './storage';

const KEY = 'reminders:v1';
export type ReminderResult = 'set' | 'denied' | 'no-date' | 'past';

export async function remindedSlugs(): Promise<string[]> {
  return (await readJson<string[]>(KEY)) ?? [];
}

export async function setReminder(job: Job): Promise<ReminderResult> {
  const lastDate = job.dates.lastDate;
  if (!lastDate) return 'no-date';
  if (!reminderTimes(lastDate, new Date()).length) return 'past';
  const ics = buildIcs({ uid: `${job.slug}@${new URL(APP.siteUrl).host}`, title: job.title, lastDate, url: `${APP.siteUrl}/jobs/${job.slug}`, now: new Date() });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  link.download = `${job.slug}-last-date.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
  const slugs = await remindedSlugs();
  if (!slugs.includes(job.slug)) await writeJson(KEY, [...slugs, job.slug]);
  return 'set';
}

export async function cancelReminder(slug: string): Promise<void> {
  await writeJson(KEY, (await remindedSlugs()).filter((s) => s !== slug));
}
