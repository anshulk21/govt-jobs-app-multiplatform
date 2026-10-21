// Pure helpers for job data, shared by the build scripts and the app.
import { STAGES, STATE_BY_CODE, type Category, type QualificationId, type StageId } from './constants';
import { ageLimits } from './eligibility';
import type { CountsPayload, Job, JobSummary } from './types';

/** Today's date in India (yyyy-mm-dd), regardless of the device or server timezone. */
export function todayIST(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** Calendar date (IST) of an ISO timestamp. */
export function dateIST(iso: string): string {
  return todayIST(new Date(iso));
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

/** Days left to apply: 0 = today is the last day, negative = expired, null = unknown. */
export function daysLeft(lastDate: string | null, today: string): number | null {
  return lastDate ? daysBetween(today, lastDate) : null;
}

export function isExpired(job: Pick<JobSummary, 'lastDate'>, today: string): boolean {
  const d = daysLeft(job.lastDate, today);
  return d !== null && d < 0;
}

/** The furthest stage in the timeline that has happened. */
export function latestStage(job: Pick<Job, 'timeline'>): StageId {
  let best = 0;
  for (const entry of job.timeline) {
    const i = STAGES.findIndex((s) => s.id === entry.stage);
    if (i > best) best = i;
  }
  return STAGES[best]!.id;
}

export function toSummary(job: Job): JobSummary {
  return {
    slug: job.slug,
    title: job.title,
    organization: job.organization,
    level: job.level,
    state: job.state,
    category: job.category,
    qualifications: job.qualifications,
    vacancies: job.vacancies,
    lastDate: job.dates.lastDate,
    applyStart: job.dates.applyStart,
    examDate: job.dates.exam,
    age: ageLimits(job),
    stage: latestStage(job),
    publishedAt: job.publishedAt ?? job.foundAt,
    updatedAt: job.updatedAt,
  };
}

/** Newest first. */
export function byPublished(a: JobSummary, b: JobSummary): number {
  return b.publishedAt.localeCompare(a.publishedAt);
}

/** Open jobs first (closing soonest first, unknown dates after), then expired ones newest first. */
export function byUrgency(today: string) {
  return (a: JobSummary, b: JobSummary): number => {
    const ea = isExpired(a, today);
    const eb = isExpired(b, today);
    if (ea !== eb) return ea ? 1 : -1;
    if (ea) return (b.lastDate ?? '').localeCompare(a.lastDate ?? '');
    if (a.lastDate && b.lastDate) return a.lastDate.localeCompare(b.lastDate);
    if (a.lastDate || b.lastDate) return a.lastDate ? -1 : 1;
    return byPublished(a, b);
  };
}

export function closingSoon(jobs: JobSummary[], today: string, withinDays = 7): JobSummary[] {
  return jobs
    .filter((j) => {
      const d = daysLeft(j.lastDate, today);
      return d !== null && d >= 0 && d <= withinDays;
    })
    .sort(byUrgency(today));
}

export function newToday(jobs: JobSummary[], today: string): JobSummary[] {
  return jobs.filter((j) => dateIST(j.publishedAt) === today).sort(byPublished);
}

/** How many open jobs there are per state, category and qualification. */
export function openCounts(jobs: JobSummary[], today: string): Omit<CountsPayload, 'generatedAt'> {
  const out: Omit<CountsPayload, 'generatedAt'> = { central: 0, byState: {}, byCategory: {}, byQualification: {} };
  const add = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1);
  for (const j of jobs) {
    if (isExpired(j, today)) continue;
    if (j.level === 'central') out.central++;
    if (j.state) add(out.byState, j.state);
    add(out.byCategory, j.category);
    for (const q of j.qualifications) add(out.byQualification, q);
  }
  return out;
}

export function openJobs(jobs: JobSummary[], today: string): JobSummary[] {
  return jobs.filter((j) => !isExpired(j, today));
}

export interface Preferences {
  /** State/UT codes the user cares about. */
  states: string[];
  /** Include central (all-India) jobs. */
  central: boolean;
  /** Empty = all categories. */
  categories: Category[];
  /** Empty = any qualification. */
  qualifications: QualificationId[];
}

/**
 * "For you": jobs from the user's states (or central, if chosen), in their
 * categories, open to their qualification. A job whose qualification isn't
 * known yet is included rather than hidden.
 */
export function matchesPreferences(job: JobSummary, prefs: Preferences): boolean {
  const placeOk = job.level === 'central' ? prefs.central : job.state !== null && prefs.states.includes(job.state);
  if (!placeOk) return false;
  if (prefs.categories.length && !prefs.categories.includes(job.category)) return false;
  if (prefs.qualifications.length && job.qualifications.length && !job.qualifications.some((q) => prefs.qualifications.includes(q))) {
    return false;
  }
  return true;
}

export interface JobFilters {
  level?: 'central' | 'state';
  state?: string;
  category?: Category;
  qualification?: QualificationId;
  /** Only jobs whose last date is within this many days (and not passed). */
  closingWithinDays?: number;
  includeExpired?: boolean;
  query?: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9ऀ-ॿ ]+/g, ' ');

/** Every word of the query must appear in the job's title, organisation, state or category. */
export function matchesQuery(job: JobSummary, query: string): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm(
    [job.title, job.organization, job.category, job.state ?? 'central', job.state ? (STATE_BY_CODE.get(job.state)?.name ?? '') : 'all india'].join(' '),
  );
  return words.every((w) => hay.includes(w));
}

export function filterJobs(jobs: JobSummary[], f: JobFilters, today: string): JobSummary[] {
  return jobs.filter((j) => {
    if (f.level === 'central' && j.level !== 'central') return false;
    if (f.level === 'state' && j.level === 'central') return false;
    if (f.state && j.state !== f.state) return false;
    if (f.category && j.category !== f.category) return false;
    if (f.qualification && j.qualifications.length && !j.qualifications.includes(f.qualification)) return false;
    if (!f.includeExpired && isExpired(j, today)) return false;
    if (f.closingWithinDays !== undefined) {
      const d = daysLeft(j.lastDate, today);
      if (d === null || d < 0 || d > f.closingWithinDays) return false;
    }
    if (f.query && !matchesQuery(j, f.query)) return false;
    return true;
  });
}

/** "15 Nov 2026" */
export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][(m ?? 1) - 1];
  return `${d} ${month} ${y}`;
}

export function placeName(job: Pick<JobSummary, 'state'>): string {
  return job.state ? (STATE_BY_CODE.get(job.state)?.name ?? job.state) : 'All India';
}
