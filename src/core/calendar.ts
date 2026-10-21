// Exam calendar (a Pro tool): upcoming important dates from published jobs, by month.
import { formatDate } from './jobs';
import type { JobSummary } from './types';

export type CalendarKind = 'apply-start' | 'last-date' | 'exam';

export interface CalendarEvent {
  date: string;
  kind: CalendarKind;
  job: JobSummary;
}

export const KIND_LABEL: Record<CalendarKind, string> = { 'apply-start': 'Apply from', 'last-date': 'Last date', exam: 'Exam' };

/** Events from today onwards, soonest first, grouped by month ("Nov 2026"). */
export function calendarByMonth(jobs: JobSummary[], today: string, maxDays = 365): { month: string; events: CalendarEvent[] }[] {
  const until = new Date(Date.parse(today) + maxDays * 86_400_000).toISOString().slice(0, 10);
  const events: CalendarEvent[] = [];
  for (const job of jobs) {
    const add = (date: string | null, kind: CalendarKind) => date && date >= today && date <= until && events.push({ date, kind, job });
    add(job.applyStart, 'apply-start');
    add(job.lastDate, 'last-date');
    add(job.examDate, 'exam');
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.job.title.localeCompare(b.job.title));
  const months = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const month = formatDate(e.date)!.replace(/^\d+ /, '');
    months.set(month, [...(months.get(month) ?? []), e]);
  }
  return [...months].map(([month, evs]) => ({ month, events: evs }));
}
