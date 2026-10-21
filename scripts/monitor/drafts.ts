import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Job, Source } from '../../src/core/types';
import type { Extracted } from './extract';
import { seenKey, type PageLink } from './links';

export const JOB_DIRS = ['drafts', 'published', 'rejected'] as const;

export function jobId(url: string): string {
  return createHash('sha1').update(seenKey(url)).digest('hex').slice(0, 10);
}

/** "UPPSC PCS Recruitment 2026 (Advt. No. 5)" → "uppsc-pcs-recruitment-2026-advt-no-5" (max ~60 chars). */
export function slugify(text: string, maxLength = 60): string {
  const words = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  let out = '';
  for (const w of words) {
    if ((out ? out.length + 1 : 0) + w.length > maxLength) break;
    out = out ? `${out}-${w}` : w;
  }
  return out;
}

export function jobSlug(source: Source, title: string, id: string): string {
  let base = slugify(title);
  if (!base.startsWith(source.id)) base = slugify(`${source.id} ${base}`);
  return `${base || source.id}-${id.slice(0, 6)}`;
}

export interface DraftInput {
  source: Source;
  link: PageLink;
  /** The page the link was found on. */
  pageUrl: string;
  now: string;
  extracted: Extracted | null;
  method: Job['extraction']['method'];
  error?: string;
}

/** Builds a draft job using only facts from the link and (if read) the notification text. */
export function makeDraft({ source, link, pageUrl, now, extracted, method, error }: DraftInput): Job {
  const id = jobId(link.url);
  const title = link.text || link.url.split('/').pop() || source.name;
  const fields = extracted ? Object.keys(extracted.evidence) : [];
  return {
    id,
    slug: jobSlug(source, title, id),
    status: 'draft',
    title,
    organization: source.name,
    sourceId: source.id,
    level: source.level,
    state: source.state,
    category: source.category,
    postName: null,
    vacancies: extracted?.vacancies ?? null,
    qualifications: extracted?.qualifications ?? [],
    ageLimit: extracted?.ageLimit ?? null,
    fee: extracted?.fee ?? null,
    dates: extracted?.dates ?? { notification: null, applyStart: null, lastDate: null, exam: null },
    howToApply: null,
    links: { notification: link.url, official: pageUrl, apply: null },
    timeline: [],
    foundAt: now,
    updatedAt: now,
    extraction: { method, fields, evidence: extracted?.evidence ?? {}, ...(error ? { error } : {}) },
  };
}

/** True if a job with this id already exists as a draft, published or rejected job. */
export function jobExists(jobsDir: string, id: string): boolean {
  const suffix = `-${id.slice(0, 6)}.json`;
  return JOB_DIRS.some((d) => {
    const dir = path.join(jobsDir, d);
    return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(suffix));
  });
}

/** Writes data/jobs/drafts/<slug>.json. Returns false if the job already exists anywhere. */
export function writeDraft(jobsDir: string, job: Job): boolean {
  if (jobExists(jobsDir, job.id)) return false;
  const dir = path.join(jobsDir, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${job.slug}.json`), JSON.stringify(job, null, 2) + '\n');
  return true;
}
