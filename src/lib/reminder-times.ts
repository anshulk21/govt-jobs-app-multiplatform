// Pure helpers for "Set reminder" (tested in tests/app-logic.test.ts).

/** 9:00 AM IST on 3 days before, 1 day before and the last date itself — only those still in the future. */
export function reminderTimes(lastDate: string, now: Date): { date: Date; daysBefore: number }[] {
  const nineAmIst = Date.parse(`${lastDate}T03:30:00.000Z`);
  return [3, 1, 0]
    .map((daysBefore) => ({ date: new Date(nineAmIst - daysBefore * 86_400_000), daysBefore }))
    .filter((r) => r.date.getTime() > now.getTime());
}

const icsDate = (iso: string) => iso.replace(/-/g, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/** A calendar file with an all-day event on the last date and alarms 3 days and 1 day before. */
export function buildIcs(opts: { uid: string; title: string; lastDate: string; url: string; now: Date }): string {
  const next = new Date(Date.parse(`${opts.lastDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const stamp = opts.now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const alarm = (days: number) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(`Last date in ${days} day(s): ${opts.title}`)}`, `TRIGGER:-P${days}D`, 'END:VALARM'];
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Govt Jobs Finder//EN',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(opts.lastDate)}`,
    `DTEND;VALUE=DATE:${icsDate(next)}`,
    `SUMMARY:${icsText(`Last date: ${opts.title}`)}`,
    `DESCRIPTION:${icsText(`Apply before the last date. Check the official notification: ${opts.url}`)}`,
    `URL:${opts.url}`,
    ...alarm(3),
    ...alarm(1),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
