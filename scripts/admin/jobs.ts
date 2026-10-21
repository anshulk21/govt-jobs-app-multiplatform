// Turns job files edited in the CMS (Decap) into clean data and decides where each belongs.
// Pure functions, tested in tests/admin.test.ts.
import { createHash } from 'node:crypto';
import { CATEGORIES, JOB_STATUSES, LEVELS, QUALIFICATIONS, STAGES, STATE_BY_CODE, type JobStatus } from '../../src/core/constants';
import type { Job, TimelineEntry } from '../../src/core/types';
import { reviewNotes, slugify } from '../monitor/drafts';

export const FOLDER: Record<JobStatus, 'drafts' | 'published' | 'rejected'> = { draft: 'drafts', published: 'published', rejected: 'rejected' };

type Raw = Record<string, any>;

/** "" / undefined → null; trims strings. */
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
/** Accepts "2026-11-15", "2026-11-15T00:00:00Z"; anything else → null. */
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const int = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/,/g, '')) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/**
 * Cleans a job saved by the CMS: empty fields become null, numbers and dates get the right
 * type, missing bookkeeping fields are filled in. Never invents job details.
 */
export function normalizeJob(raw: Raw, now: string): Job {
  const title = str(raw.title) ?? '';
  const slug = slugify(str(raw.slug) ?? title, 90) || 'job';
  const level = LEVELS.includes(raw.level) ? raw.level : raw.state ? 'state' : 'central';
  const statusIn = JOB_STATUSES.includes(raw.status) ? (raw.status as JobStatus) : 'draft';
  const quals = Array.isArray(raw.qualifications) ? raw.qualifications : raw.qualifications ? [raw.qualifications] : [];
  const timeline: TimelineEntry[] = (Array.isArray(raw.timeline) ? raw.timeline : [])
    .filter((t: Raw) => STAGES.some((s) => s.id === t?.stage))
    .map((t: Raw) => ({ stage: t.stage, date: date(t.date), url: str(t.url), ...(str(t.note) ? { note: str(t.note)! } : {}) }));
  const extraction = raw.extraction && typeof raw.extraction === 'object' ? raw.extraction : { method: 'link-only', fields: [], evidence: {} };

  const job: Job = {
    id: str(raw.id) ?? createHash('sha1').update(slug).digest('hex').slice(0, 10),
    slug,
    status: statusIn,
    title,
    organization: str(raw.organization) ?? '',
    sourceId: str(raw.sourceId) ?? 'manual',
    level,
    state: level === 'central' ? null : str(raw.state),
    category: CATEGORIES.includes(raw.category) ? raw.category : 'Other',
    postName: str(raw.postName),
    vacancies: int(raw.vacancies),
    qualifications: [...new Set(quals)].filter((q): q is Job['qualifications'][number] => QUALIFICATIONS.some((x) => x.id === q)),
    ageLimit: str(raw.ageLimit),
    ...(int(raw.ageMin) ? { ageMin: int(raw.ageMin) } : {}),
    ...(int(raw.ageMax) ? { ageMax: int(raw.ageMax) } : {}),
    ...(date(raw.ageAsOn) ? { ageAsOn: date(raw.ageAsOn) } : {}),
    fee: str(raw.fee),
    dates: {
      notification: date(raw.dates?.notification),
      applyStart: date(raw.dates?.applyStart),
      lastDate: date(raw.dates?.lastDate),
      exam: date(raw.dates?.exam),
    },
    howToApply: str(raw.howToApply),
    links: { notification: str(raw.links?.notification) ?? '', official: str(raw.links?.official) ?? '', apply: str(raw.links?.apply) },
    timeline,
    foundAt: str(raw.foundAt) ?? now,
    updatedAt: str(raw.updatedAt) ?? now,
    ...(str(raw.publishedAt) ? { publishedAt: str(raw.publishedAt)! } : {}),
    extraction,
    ...(raw.sample === true ? { sample: true } : {}),
    ...(str(raw.notes) ? { notes: str(raw.notes)! } : {}),
  };
  job.review = str(raw.review) ?? reviewNotes(job);
  return job;
}

const isUrl = (u: string) => /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(u);

/** Reasons a job can't go live yet (empty list = OK to publish). */
export function publishProblems(job: Job): string[] {
  const p: string[] = [];
  if (job.title.length < 8) p.push('title is missing or too short');
  if (!job.organization) p.push('organisation is missing');
  if (!isUrl(job.links.notification)) p.push('official notification link is missing or not a web address');
  if (!isUrl(job.links.official)) p.push('official website link is missing or not a web address');
  if (job.links.apply && !isUrl(job.links.apply)) p.push('apply link is not a web address');
  if (job.level !== 'central' && !(job.state && STATE_BY_CODE.has(job.state))) p.push('state is required for state/UT jobs');
  return p;
}

export interface Plan {
  job: Job;
  /** Where the file should end up, e.g. data/jobs/published/ssc-cgl-2026.json */
  target: string;
  event: 'published' | 'unpublished' | 'rejected' | 'held' | 'updated' | 'unchanged';
  problems: string[];
}

/**
 * Decides what to do with one job file.
 * `currentFolder` is where the file is now; `changed` = the file was edited in this push.
 */
export function planJob(raw: Raw, currentFolder: 'drafts' | 'published' | 'rejected', changed: boolean, now: string): Plan {
  const job = normalizeJob(raw, now);
  let problems: string[] = [];
  let event: Plan['event'] = 'unchanged';

  if (job.status === 'published') {
    problems = publishProblems(job);
    if (problems.length) {
      job.status = 'draft';
      job.notes = `Not published yet: ${problems.join('; ')}. Fix these, then set Status to Published again.`;
      event = 'held';
    } else if (currentFolder !== 'published') {
      job.publishedAt ??= now;
      job.updatedAt = now;
      if (!job.timeline.some((t) => t.stage === 'notification')) {
        job.timeline.unshift({ stage: 'notification', date: job.dates.notification, url: job.links.notification });
      }
      if (job.notes?.startsWith('Not published yet:')) delete job.notes;
      event = 'published';
    } else if (changed) {
      job.updatedAt = now;
      event = 'updated';
    }
  } else if (currentFolder === 'published') {
    event = 'unpublished'; // taken off the site (set back to Draft or Rejected)
  } else if (job.status === 'rejected' && currentFolder !== 'rejected') {
    event = 'rejected';
  }
  return { job, target: `data/jobs/${FOLDER[job.status]}/${job.slug}.json`, event, problems };
}

export function commitMessageFor(plans: Plan[]): string | null {
  const count = (e: Plan['event']) => plans.filter((p) => p.event === e).length;
  const published = count('published');
  const updated = count('updated');
  const rejected = count('rejected');
  const held = count('held');
  const unpublished = count('unpublished');
  const parts = [
    published && `published ${published}`,
    updated && `updated ${updated}`,
    unpublished && `unpublished ${unpublished}`,
    rejected && `rejected ${rejected}`,
    held && `${held} need fixes`,
  ].filter(Boolean);
  if (!parts.length) return null;
  // Rejections and fixes don't change the public site: skip the Cloudflare build.
  return `${published || updated || unpublished ? '' : '[CF-Pages-Skip] '}admin: ${parts.join(', ')}`;
}
