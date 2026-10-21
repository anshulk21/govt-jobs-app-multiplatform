import type { Category, JobStatus, Level, Priority, QualificationId, StageId } from './constants';

export interface Source {
  id: string;
  name: string;
  /** Page to monitor. Empty string = not known yet (must be disabled). */
  url: string;
  level: Level;
  /** State/UT code, or null for central bodies. */
  state: string | null;
  category: Category;
  /** Words/extensions a link's URL or text must contain to count as a job link. */
  linkFilter: string[];
  /** high = checked every monitor run, normal = every second run. */
  priority: Priority;
  enabled: boolean;
  /** Set by `npm run verify-sources`. Never edit by hand. */
  verified: boolean;
  /** URL after redirects, recorded by verify-sources. */
  finalUrl?: string;
  /** ISO timestamp of the last verify-sources check. */
  lastVerifiedAt?: string;
  /** Free-text notes, e.g. TODOs for sources without a known URL. */
  notes?: string;
}

/** Shape of every file in data/sources/. */
export interface SourceFile {
  level: Level;
  state: string | null;
  name: string;
  sources: Source[];
}

export interface TimelineEntry {
  stage: StageId;
  /** ISO yyyy-mm-dd, or null if not announced yet. */
  date: string | null;
  /** Official link for this stage (admit card download page, result PDF, …). */
  url: string | null;
  note?: string;
}

/** Dates are ISO yyyy-mm-dd strings; null means "See official notification". */
export interface JobDates {
  notification: string | null;
  applyStart: string | null;
  lastDate: string | null;
  exam: string | null;
}

/**
 * One job. Drafts are created by the monitor; you review and publish them.
 * Any null field is shown as "See official notification".
 */
export interface Job {
  /** Stable id derived from the notification URL. */
  id: string;
  /** URL slug, e.g. uppsc-pcs-recruitment-2026-3f9a1c. Also the file name. */
  slug: string;
  status: JobStatus;
  title: string;
  organization: string;
  sourceId: string;
  level: Level;
  state: string | null;
  category: Category;
  postName: string | null;
  vacancies: number | null;
  qualifications: QualificationId[];
  ageLimit: string | null;
  fee: string | null;
  dates: JobDates;
  howToApply: string | null;
  links: {
    /** The notice/PDF the monitor found. */
    notification: string;
    /** The official page it was found on. */
    official: string;
    apply: string | null;
  };
  /** Notification → Apply → Admit Card → Answer Key → Result. Add entries as they happen. */
  timeline: TimelineEntry[];
  /** Demo data: only shown when building with SAMPLE_JOBS=1. */
  sample?: boolean;
  /** Free-text notes for the admin; never shown to users. */
  notes?: string;
  /** When the monitor first saw the link (ISO timestamp). */
  foundAt: string;
  updatedAt: string;
  publishedAt?: string;
  /** How the fields were filled in, so you know what to double-check. */
  extraction: {
    method: 'link-only' | 'pdf-regex' | 'ai';
    /** Fields filled automatically (they need review before publishing). */
    fields: string[];
    /** The exact text each automatic value came from. */
    evidence: Record<string, string>;
    error?: string;
  };
}

/** The small version of a job used in lists and the JSON API. */
export interface JobSummary {
  slug: string;
  title: string;
  organization: string;
  level: Level;
  state: string | null;
  category: Category;
  qualifications: QualificationId[];
  vacancies: number | null;
  lastDate: string | null;
  /** Latest stage reached, e.g. "admit-card". */
  stage: StageId;
  publishedAt: string;
  updatedAt: string;
}

/** Shape of every list file in the JSON API (/api/jobs/latest.json, /api/jobs/state/UP.json, …). */
export interface JobListPayload {
  generatedAt: string;
  jobs: JobSummary[];
}

export interface JobPayload {
  generatedAt: string;
  job: Job;
}
