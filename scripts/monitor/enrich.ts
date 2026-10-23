// Usage: npm run enrich [-- --max=30] [--dry-run]
//
// Fills in missing details (last date, posts, age limit, fee, qualification) of existing draft and
// published jobs by reading their notice again: a PDF, or a web page and the PDF it links to.
// For jobs saved before notice pages were read, or when the per-run PDF limit was reached.
// Only empty fields are filled; nothing you typed in the admin is overwritten. Each job is tried
// at most 3 times. Published jobs first, newest first.
//
// Run by the monitor workflows after the monitor. Writes .enrich.json ({updated, updatedPublished})
// so the workflow knows whether the website needs rebuilding.
import fs from 'node:fs';
import path from 'node:path';
import type { Job } from '../../src/core/types';
import { loadMonitorConfig } from '../lib/config';
import { createHostThrottle, USER_AGENT } from '../lib/http';
import { ROOT } from '../lib/paths';
import { reviewNotes } from './drafts';
import type { Extracted } from './extract';
import { readNotice, type NoticeDeps } from './notice';
import { RobotsCache } from './robots';

export const MAX_TRIES = 3;
const MAX_AGE_DAYS = 60;
const TIME_BUDGET_MS = 6 * 60_000;

const isWebUrl = (u: string | null | undefined): u is string => !!u && /^https?:\/\//i.test(u);

/** Jobs worth another try: nothing read yet, not tried too often, found recently. */
export function needsDetails(job: Job, now: Date): boolean {
  if (job.sample || job.extraction.fields.length || (job.extraction.tries ?? 0) >= MAX_TRIES) return false;
  if (!isWebUrl(job.links.notification)) return false;
  return now.getTime() - Date.parse(job.foundAt) <= MAX_AGE_DAYS * 86_400_000;
}

/**
 * Copies values from `extracted` into the job's empty fields only. Returns the updated job, or
 * null if nothing new was filled in.
 */
export function fillMissing(job: Job, extracted: Extracted, method: Job['extraction']['method'], now: string): Job | null {
  const next: Job = { ...job, dates: { ...job.dates }, extraction: { ...job.extraction, evidence: { ...job.extraction.evidence } } };
  const filled: string[] = [];
  for (const [field, text] of Object.entries(extracted.evidence)) {
    if (field.startsWith('dates.')) {
      const k = field.slice(6) as keyof Job['dates'];
      if (next.dates[k] || !extracted.dates[k]) continue;
      next.dates[k] = extracted.dates[k];
    } else if (field === 'vacancies') {
      if (next.vacancies != null || extracted.vacancies == null) continue;
      next.vacancies = extracted.vacancies;
    } else if (field === 'ageLimit') {
      if (next.ageLimit || !extracted.ageLimit) continue;
      next.ageLimit = extracted.ageLimit;
    } else if (field === 'fee') {
      if (next.fee || !extracted.fee) continue;
      next.fee = extracted.fee;
    } else if (field === 'qualifications') {
      if (next.qualifications.length || !extracted.qualifications.length) continue;
      next.qualifications = extracted.qualifications;
    } else continue;
    next.extraction.evidence[field] = text;
    filled.push(field);
  }
  if (!filled.length) return null;
  next.extraction.fields = [...new Set([...job.extraction.fields, ...filled])];
  next.extraction.method = method;
  delete next.extraction.error;
  if (job.status === 'draft') next.review = reviewNotes(next);
  next.updatedAt = now;
  return next;
}

async function main() {
  const max = Number(process.argv.find((a) => a.startsWith('--max='))?.split('=')[1] ?? 30);
  const dryRun = process.argv.includes('--dry-run');
  const config = loadMonitorConfig();
  const now = new Date();
  const nowIso = now.toISOString();
  const deadline = Date.now() + TIME_BUDGET_MS;

  const files = (['drafts', 'published'] as const).flatMap((folder) => {
    const dir = path.join(ROOT, 'data/jobs', folder);
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ file: path.join(dir, f), job: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Job }));
  });
  const todo = files
    .filter(({ job }) => needsDetails(job, now))
    // Live jobs first (they're what visitors see), then drafts; newest first within each.
    .sort((a, b) => Number(b.job.status === 'published') - Number(a.job.status === 'published') || b.job.foundAt.localeCompare(a.job.foundAt))
    .slice(0, max);
  console.log(`${todo.length} job(s) to fill in${dryRun ? ' (dry run)' : ''}.`);

  const robots = new RobotsCache(USER_AGENT.split('/')[0]!);
  const throttle = createHostThrottle(config.hostGapMs.min, config.hostGapMs.max);
  let pdfBudget = config.pdf.enabled ? config.pdf.maxPerRun : 0;
  const result = { updated: 0, updatedPublished: 0 };

  for (const { file, job } of todo) {
    if (Date.now() > deadline) {
      console.log('Time limit reached; the rest are tried next run.');
      break;
    }
    const deps: NoticeDeps = {
      timeoutMs: config.timeoutMs,
      pdfMaxBytes: config.pdf.maxBytes,
      pdfMaxPages: config.pdf.maxPages,
      foundOn: job.foundAt.slice(0, 10),
      isAllowed: (url) => robots.isAllowed(url),
      throttle,
      takePdf: () => pdfBudget-- > 0,
    };
    let next: Job | null = null;
    let error: string | undefined;
    try {
      const notice = await readNotice(job.links.notification!, job.title, deps);
      next = notice.extracted ? fillMissing(job, notice.extracted, notice.method, nowIso) : null;
      error = notice.error;
    } catch (err) {
      error = `internal error: ${(err as Error).message}`;
    }
    if (next) {
      result.updated++;
      if (job.status === 'published') result.updatedPublished++;
      console.log(`✓ ${job.slug}: ${next.extraction.fields.join(', ')}`);
    } else {
      next = { ...job, extraction: { ...job.extraction, tries: (job.extraction.tries ?? 0) + 1, ...(error ? { error } : {}) } };
      console.log(`· ${job.slug}: nothing found${error ? ` (${error})` : ''}`);
    }
    if (!dryRun) fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  }

  console.log(`Filled in ${result.updated} job(s), ${result.updatedPublished} of them live.`);
  if (!dryRun) fs.writeFileSync(path.join(ROOT, '.enrich.json'), JSON.stringify(result));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
