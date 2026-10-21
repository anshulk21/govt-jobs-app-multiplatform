// Push notification targeting with FCM topics — no database needed.
//
// Each device subscribes to topics describing its owner's choices:
//   all                         every device (announcements)
//   central                     wants central government jobs
//   state_UP, state_TN, …       chosen states/UTs
//   cat_police, cat_ssc, …      chosen categories (every category if none chosen)
//   qual_12th, qual_graduate, … chosen qualifications (every qualification if none chosen)
//   pro                         Pro subscribers (they get new-job alerts first)
//   job_<id>                    one per saved job (admit card / result updates)
//
// A job is sent to FCM *conditions* that are true exactly when matchesPreferences()
// (the app's "For you" rule) would be true. FCM allows at most 5 topics per condition;
// ours use at most 4 (place, category, qualification, pro).
import { CATEGORIES, QUALIFICATIONS, STAGES, categorySlug, type Category, type QualificationId, type StageId } from './constants';
import { formatDate, type Preferences } from './jobs';
import type { Job, JobSummary } from './types';

export const ALL_TOPIC = 'all';
export const CENTRAL_TOPIC = 'central';
export const PRO_TOPIC = 'pro';

export const stateTopic = (code: string) => `state_${code}`;
export const categoryTopic = (c: Category) => `cat_${categorySlug(c)}`;
export const qualificationTopic = (q: QualificationId) => `qual_${q}`;
export const jobTopic = (jobId: string) => `job_${jobId}`;

/** Topics this device should be subscribed to. */
export function topicsForPreferences(prefs: Preferences, savedJobIds: string[] = [], isPro = false): string[] {
  const topics = new Set<string>([ALL_TOPIC]);
  if (prefs.central) topics.add(CENTRAL_TOPIC);
  for (const s of prefs.states) topics.add(stateTopic(s));
  for (const c of prefs.categories.length ? prefs.categories : CATEGORIES) topics.add(categoryTopic(c));
  for (const q of prefs.qualifications.length ? prefs.qualifications : QUALIFICATIONS.map((x) => x.id)) topics.add(qualificationTopic(q));
  if (isPro) topics.add(PRO_TOPIC);
  for (const id of savedJobIds) topics.add(jobTopic(id));
  return [...topics].sort();
}

const inTopics = (t: string) => `'${t}' in topics`;

/** Who a send is for: everyone, only Pro subscribers, or everyone except Pro subscribers. */
export type Audience = 'everyone' | 'pro' | 'free';

/**
 * FCM conditions that together reach exactly the users this job is "for".
 * One condition per qualification; a user who matches several gets one notification
 * because they share a collapse key (the job id).
 */
export function conditionsForJob(job: Pick<JobSummary, 'level' | 'state' | 'category' | 'qualifications'>, audience: Audience = 'everyone'): string[] {
  const place = job.level === 'central' ? CENTRAL_TOPIC : job.state ? stateTopic(job.state) : null;
  if (!place) return [];
  const who = audience === 'pro' ? ` && ${inTopics(PRO_TOPIC)}` : audience === 'free' ? ` && !(${inTopics(PRO_TOPIC)})` : '';
  const base = `${inTopics(place)} && ${inTopics(categoryTopic(job.category))}`;
  if (!job.qualifications.length) return [`${base}${who}`];
  return [...new Set(job.qualifications)].map((q) => `${base} && ${inTopics(qualificationTopic(q))}${who}`);
}

/**
 * Evaluates a condition the way FCM does (for tests and dry runs). Supports the subset
 * we generate: 'x' in topics, &&, ||, !, parentheses.
 */
export function evaluateCondition(condition: string, subscribed: ReadonlySet<string>): boolean {
  const tokens = condition.match(/'[^']+' in topics|&&|\|\||!|\(|\)/g) ?? [];
  let i = 0;
  const parseOr = (): boolean => {
    let v = parseAnd();
    while (tokens[i] === '||') {
      i++;
      const r = parseAnd();
      v = v || r;
    }
    return v;
  };
  const parseAnd = (): boolean => {
    let v = parseUnary();
    while (tokens[i] === '&&') {
      i++;
      const r = parseUnary();
      v = v && r;
    }
    return v;
  };
  const parseUnary = (): boolean => {
    const t = tokens[i++];
    if (t === '!') return !parseUnary();
    if (t === '(') {
      const v = parseOr();
      i++; // ')'
      return v;
    }
    return subscribed.has(t!.slice(1, t!.indexOf("'", 1)));
  };
  return parseOr();
}

export function topicCount(condition: string): number {
  return (condition.match(/' in topics/g) ?? []).length;
}

export interface PushContent {
  title: string;
  body: string;
  /** App route to open when tapped. */
  url: string;
  /** Same key = later notification replaces the earlier one on the phone. */
  collapseKey: string;
}

/** "15 Nov" */
const shortDate = (iso: string) => formatDate(iso)!.replace(/ \d{4}$/, '');

/** "New: UP Police Constable 2026 — 12,000 posts. Last date 15 Nov." */
export function newJobPush(job: Job): PushContent {
  const facts = [
    job.vacancies ? `${job.vacancies.toLocaleString('en-IN')} posts` : null,
    job.dates.lastDate ? `Last date ${shortDate(job.dates.lastDate)}` : null,
  ].filter(Boolean);
  return {
    title: `New: ${job.title}`,
    body: facts.length ? `${facts.join('. ')}.` : `${job.organization}. Tap for details.`,
    url: `/jobs/${job.slug}`,
    collapseKey: job.id,
  };
}

export function lastDaysPush(job: Job, daysLeft: number): PushContent {
  return {
    title: `Last ${daysLeft} days to apply`,
    body: `${job.title}${job.dates.lastDate ? ` — last date ${shortDate(job.dates.lastDate)}` : ''}.`,
    url: `/jobs/${job.slug}`,
    collapseKey: `${job.id}-deadline`,
  };
}

const STAGE_TITLE: Partial<Record<StageId, string>> = {
  'admit-card': 'Admit card released',
  'answer-key': 'Answer key released',
  result: 'Result declared',
};

export function stageUpdatePush(job: Job, stage: StageId): PushContent {
  return {
    title: STAGE_TITLE[stage] ?? `${STAGES.find((s) => s.id === stage)?.label} update`,
    body: job.title,
    url: `/jobs/${job.slug}`,
    collapseKey: `${job.id}-${stage}`,
  };
}

/** Stages present in `after` but not in `before` that saved-job followers should hear about. */
export function newStages(before: Job | null, after: Job): StageId[] {
  const had = new Set((before?.timeline ?? []).map((t) => t.stage));
  return after.timeline.map((t) => t.stage).filter((s) => !had.has(s) && s in STAGE_TITLE);
}
