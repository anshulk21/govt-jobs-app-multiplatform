// Build-time only: reads published jobs from data/jobs/published/ and builds the
// JSON payloads used by the website's static pages AND the public /api files the
// apps read. (data.native.ts is an empty stand-in so the apps never bundle this.)
//
// This module is also included in the website's browser bundle (route files import
// it for generateMetadata), so it must not touch Node APIs at import time: all work
// happens inside functions, which only ever run during the build.
import fs from 'node:fs';
import path from 'node:path';
import { MONETIZATION } from '../config/monetization';
import { apiPaths } from '../core/api';
import { categoryFromSlug, categorySlug, QUALIFICATIONS, STAGES, STATES, type StageId } from '../core/constants';
import { byPublished, formatDate, todayIST, toSummary } from '../core/jobs';
import { booksFor, sponsoredFor } from '../core/monetization';
import type { Book, Job, JobListPayload, JobPayload, JobSummary, Quiz, SponsoredCard } from '../core/types';

let cache: Job[] | undefined;
let generatedAt = '';

/**
 * All published jobs. Sample jobs are included only when SAMPLE_JOBS=1 (development)
 * AND there are no real published jobs yet — once you publish one, samples disappear.
 */
export function publishedJobs(): Job[] {
  if (cache) return cache;
  const PUBLISHED_DIR = path.join(process.cwd(), 'data', 'jobs', 'published');
  const withSamples = process.env.SAMPLE_JOBS === '1';
  generatedAt = new Date().toISOString();
  const files = fs.existsSync(PUBLISHED_DIR) ? fs.readdirSync(PUBLISHED_DIR).filter((f) => f.endsWith('.json')) : [];
  cache = files
    .map((f) => {
      const job = JSON.parse(fs.readFileSync(path.join(PUBLISHED_DIR, f), 'utf8')) as Job;
      if (job.slug !== path.basename(f, '.json')) {
        // Just edited in the admin panel: the publish workflow renames it within minutes.
        console.warn(`⚠ ${f}: slug "${job.slug}" doesn't match the file name yet — skipped in this build`);
        return null;
      }
      return job;
    })
    .filter((j): j is Job => j !== null && j.status === 'published');
  const real = cache.filter((j) => !j.sample);
  cache = withSamples && real.length === 0 ? cache : real;
  return cache;
}

export function getJob(slug: string): Job | undefined {
  return publishedJobs().find((j) => j.slug === slug);
}

function list(filter: (j: Job) => boolean, sort: (a: JobSummary, b: JobSummary) => number = byPublished): JobListPayload {
  const jobs = publishedJobs().filter(filter).map(toSummary).sort(sort);
  return { generatedAt, jobs };
}

const stageDate = (job: JobSummary, stage: StageId) => publishedJobs().find((j) => j.slug === job.slug)?.timeline.find((t) => t.stage === stage)?.date ?? '';

const readJson = <T,>(rel: string, fallback: T): T => {
  const file = path.join(process.cwd(), rel);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as T) : fallback;
};

/** Sponsored cards and books from the admin panel (empty when switched off). */
function monetizationData(): { cards: SponsoredCard[]; books: Book[] } {
  return {
    cards: MONETIZATION.sponsored.enabled ? readJson<{ cards: SponsoredCard[] }>('data/monetization/sponsored.json', { cards: [] }).cards : [],
    books: MONETIZATION.affiliate.enabled ? readJson<{ books: Book[] }>('data/monetization/books.json', { books: [] }).books : [],
  };
}

/** Quizzes in data/quizzes/. Sample quizzes are left out once a real one exists. */
export function quizzes(): Quiz[] {
  if (!MONETIZATION.quiz.enabled) return [];
  const dir = path.join(process.cwd(), 'data', 'quizzes');
  const all = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Quiz)
    : [];
  const real = all.filter((q) => !q.sample);
  return (real.length ? real : all).filter((q) => q.questions?.length);
}

const withSponsored = (payload: JobListPayload, where: Parameters<typeof sponsoredFor>[1]): JobListPayload => {
  const cards = sponsoredFor(monetizationData().cards, where, todayIST());
  return cards.length ? { ...payload, sponsored: cards } : payload;
};

export const payloads = {
  /** Every published job, newest first (used for home, search and "For you"). */
  latest: (): JobListPayload => list(() => true),
  job: (slug: string): JobPayload | null => {
    const job = getJob(slug); // loads jobs (and sets generatedAt) first
    if (!job) return null;
    const { cards, books } = monetizationData();
    const sponsored = sponsoredFor(cards, { category: job.category, state: job.state }, todayIST());
    const matched = booksFor(books, job);
    return { generatedAt, job, ...(matched.length ? { books: matched } : {}), ...(sponsored.length ? { sponsored } : {}) };
  },
  state: (code: string) => withSponsored(list((j) => j.state === code), { state: code }),
  category: (slug: string) => withSponsored(list((j) => categorySlug(j.category) === slug), { category: categoryFromSlug(slug) }),
  qualification: (id: string) => list((j) => j.qualifications.includes(id as never)),
  /** Jobs that reached a stage (admit card, answer key, result), most recent first. */
  updates: (stage: StageId) => list(
    (j) => j.timeline.some((t) => t.stage === stage),
    (a, b) => stageDate(b, stage).localeCompare(stageDate(a, stage)),
  ),
};

/** Every file of the public JSON API, as [path, data]. */
export function apiFiles(): [string, unknown][] {
  const files: [string, unknown][] = [[apiPaths.latest, payloads.latest()]];
  for (const job of publishedJobs()) files.push([apiPaths.job(job.slug), payloads.job(job.slug)]);
  for (const s of STATES) files.push([apiPaths.state(s.code), payloads.state(s.code)]);
  for (const c of new Set(publishedJobs().map((j) => categorySlug(j.category)))) files.push([apiPaths.category(c), payloads.category(c)]);
  for (const q of QUALIFICATIONS) files.push([apiPaths.qualification(q.id), payloads.qualification(q.id)]);
  for (const st of STAGES) if (st.id !== 'notification' && st.id !== 'apply') files.push([apiPaths.updates(st.id), payloads.updates(st.id)]);
  const qs = quizzes();
  files.push([apiPaths.quizzes, { generatedAt, quizzes: qs.map(({ questions, ...q }) => ({ ...q, count: questions.length })) }]);
  for (const q of qs) files.push([apiPaths.quiz(q.id), q]);
  return files;
}

/**
 * Title for the job's page <title>/description. When several published jobs have the same
 * title (common for auto-imported notices), the date or a short reference is added so every
 * page is distinct for search engines.
 */
export function pageTitleFor(job: Job): string {
  const same = publishedJobs().filter((j) => j.title === job.title);
  if (same.length < 2) return job.title;
  const day = (j: Job) => (j.dates.notification ?? (j.publishedAt ?? j.foundAt)).slice(0, 10);
  const dayUnique = same.filter((j) => day(j) === day(job)).length === 1;
  return dayUnique ? `${job.title} (${formatDate(day(job))})` : `${job.title} (ref. ${job.id.slice(0, 6)})`;
}
