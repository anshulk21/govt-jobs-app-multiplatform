// Auto-publishing: decides what to do with each new draft so nobody has to publish by hand.
// Pure functions (tested in tests/auto.test.ts); scripts/admin/auto-run.ts applies them.
import type { StageId } from '../../src/core/constants';
import { formatDate } from '../../src/core/jobs';
import { organizationName, RECRUITMENT, UPDATE, UPDATE_NOTICE } from '../../src/core/notice';
import type { Job } from '../../src/core/types';

export type AutoAction = 'publish' | 'reject' | 'keep';

export interface AutoDecision {
  action: AutoAction;
  /** Cleaned-up title. */
  title: string;
  /** Timeline stage this notice represents (admit card, answer key, result), if any. */
  stage: StageId | null;
  /** Publish without a push notification. */
  quiet: boolean;
  reason: string;
}

const EXAM_NOTICE = /exam|examination|test|interview|syllabus|schedule|postpone|corrigendum|document verification|physical|pet|pst|candidates|परीक्षा/i;
const JUNK =
  /crime in|\btimes\b|land acquisition|cpio|public information officer|right to service|financial assistance|investment promotion|sports department|bonafide|district code|authorised signatory|medical certificate|form of|accessible version|tender|quotation|auction|rti\b|annual report|budget|holiday|newsletter|press note on|vigilance|swachh/i;
const EXAM_BODIES = new Set(['PSC', 'SSC', 'UPSC', 'Subordinate Services', 'Police', 'Railway', 'Bank', 'Teaching', 'Health', 'Defence', 'High Court']);

const FILLER = [
  /\(\s*\d+(\.\d+)?\s*(kb|mb)\s*\)/gi,
  /\bclick here(?:\s+(?:to|for))?(?:\s+(?:download|apply|view))?\b/gi,
  /\bdownload( document)?\b/gi,
  /\bopens downloadable pdf document\b/gi,
  /^\s*(pdf|new|view)\b[:\s-]*/gi,
  /\s*\|\s*\d{4}-\d{2}-\d{2}\s*$/g,
  /\bread more\b|\[\s*new\s*\]/gi,
  /\b(?:last\s+)?(?:updated|uploaded|posted)\s*(?:on|date)?\s*[:-]*\s*\d{1,2}[./-]\d{1,2}[./-]20\d\d\b/gi,
];
/** A date or list number the site puts before the notice: "16 October 2026: ", "07-10-2026 ", "4. ", "1 Notification…". */
const LEADING =
  /^(?:\d{1,2}[./-]\d{1,2}[./-]20\d\d|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*,?\s+20\d\d)\s*[:–-]?\s+|^\d{1,2}[.)]\s+|^\d{1,2}\s+(?=(?:notification|vacancy|advertisement|notice|recruitment)\b)/i;
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with', 'under', 'is', 'are', 'be', 'will']);
/** Short words that are ordinary English, not acronyms. */
const COMMON = new Set([...SMALL, 'post', 'posts', 'list', 'exam', 'new', 'old', 'date', 'last', 'form', 'fee', 'fees', 'age', 'all', 'call', 'link', 'main', 'mains', 'part', 'held', 'not', 'has', 'this', 'that', 'its', 'year', 'note', 'mode', 'only', 'test', 'time', 'roll', 'mark', 'marks', 'pay', 'advt', 'no', 'ref', 'dt', 'sr', 'sl', 'vide', 'dated', 'asst', 'food', 'drug', 'land', 'road', 'area', 'work', 'high', 'head', 'unit', 'zone', 'city', 'life', 'home', 'case', 'rule', 'open', 'cell', 'data', 'team', 'plan', 'govt', 'dept', 'west', 'east', 'north', 'south']);
const LONG_ACRONYMS = /^(AIIMS|NABARD|UPSSSC|OSSSC|RSMSSB|DSSSB|UKSSSC|BPSSC|CHSL|NTPC|ICAR|ICMR|CSIR|NIELIT|NHAI|AAI|FSSAI|CBSE|NCERT|SEBI|NABARD|EPFO|ESIC|BARC|IOCL|ONGC|BHEL|GAIL|SAIL|HAL|BEL|ISRO|DRDO|ITBP|CRPF|CISF)$|(PSC|SSC|SSB|SSSC|PRB|RB)$/;

/** One word of an ALL-CAPS title in normal case, keeping acronyms and codes. */
function caseWord(w: string, first: boolean): string {
  const bare = w.replace(/[^A-Za-z]/g, '');
  if (!bare) return w;
  if (/\d/.test(w) && bare.length <= 3) return w; // codes like A-1/E-1/2025, 10+2
  if (bare === bare.toUpperCase() && (LONG_ACRONYMS.test(bare) || (bare.length <= 4 && !COMMON.has(bare.toLowerCase())))) return w;
  const lower = w.toLowerCase();
  if (!first && SMALL.has(lower.replace(/[^a-z]/g, ''))) return lower;
  // Capitalise each part: "EXAMINATION-2026" → "Examination-2026", "(PRELIMINARY)" → "(Preliminary)"
  return lower.replace(/(^|[-(/"'“])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
}

/** "FINAL RESULT OF ASST. PROFESSOR (369 KB)" → "Final Result of Asst. Professor". */
export function cleanTitle(raw: string): string {
  let t = raw;
  try {
    t = decodeURIComponent(t);
  } catch {
    t = t.replace(/%20/g, ' ');
  }
  for (const re of FILLER) t = t.replace(re, ' ');
  t = t.trim();
  for (let i = 0; i < 2 && LEADING.test(t); i++) t = t.replace(LEADING, '');
  t = t.replace(/[_\s]+/g, ' ').replace(/\s+([,.:;)])/g, '$1').replace(/^[\s:–-]+|[\s:–-]+$/g, '').trim();
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length > 12 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) {
    t = t.split(' ').map((w, i) => caseWord(w, i === 0)).join(' ');
  }
  return t.length > 180 ? `${t.slice(0, 177).replace(/\s+\S*$/, '')}…` : t;
}

/**
 * Same notice seen again: same source, same title, same address apart from the query string.
 * Some sites (e.g. a high court's view_file_noti.php?token=…) give one document a new link every visit.
 */
export function duplicateKey(job: Pick<Job, 'sourceId' | 'links'>, title: string): string {
  const url = job.links.notification.split(/[?#]/)[0]!.replace(/^https?:\/\/(www\.)?/i, '');
  return `${job.sourceId}|${title.toLowerCase()}|${url}`;
}

export interface AutoConfig {
  mode: 'smart' | 'all' | 'off';
  staleDraftDays: number;
  lowSignalSources: string[];
  /** Notices whose newest date is older than this are rejected (old items listed on source pages). */
  maxNoticeAgeDays?: number;
}

const DEFAULT_MAX_NOTICE_AGE_DAYS = 180;

/**
 * The most recent date a notice mentions, from its title, link and known dates. Exact dates
 * (15.10.2026, 2026-10-15, 25/04/2019) give a day; a bare year (CEN-02/2018, 2025) counts as 31 Dec.
 * Returns null when nothing date-like is found.
 */
export function newestMention(texts: string[], now: Date): { date: Date; exact: boolean } | null {
  const maxYear = now.getUTCFullYear() + 1;
  let best: { date: Date; exact: boolean } | null = null;
  const consider = (y: number, m: number, d: number, exact: boolean) => {
    if (y < 2000 || y > maxYear || m < 1 || m > 12 || d < 1 || d > 31) return;
    const date = new Date(Date.UTC(y, m - 1, d));
    if (!best || date > best.date) best = { date, exact };
  };
  for (const raw of texts) {
    if (!raw) continue;
    let t = raw;
    for (const m of t.matchAll(/(?<!\d)(20\d\d)-(\d{1,2})-(\d{1,2})(?!\d)/g)) consider(+m[1]!, +m[2]!, +m[3]!, true);
    for (const m of t.matchAll(/(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](20\d\d)(?!\d)/g)) consider(+m[3]!, +m[2]!, +m[1]!, true);
    t = t.replace(/(?<!\d)(20\d\d)-\d{1,2}-\d{1,2}(?!\d)|(?<!\d)\d{1,2}[./-]\d{1,2}[./-]20\d\d(?!\d)/g, ' ');
    // "2026-27" is a session; its first year is what's mentioned.
    for (const m of t.matchAll(/(?<!\d)(20\d\d)(?!\d)/g)) consider(+m[1]!, 12, 31, false);
  }
  return best;
}


/** Fewer letters than this and a title can't be understood on its own. */
const MIN_TITLE_LETTERS = 8;
const tooShort = (t: string) => t.replace(/[^\p{L}\p{N}]/gu, '').length < MIN_TITLE_LETTERS;
/** The title jobTitle makes up when the link text was only a date stamp. */
const DATED_NOTICE = /^Notice dated \d{1,2} [A-Z][a-z]{2} 20\d\d$/;

/**
 * The title a job page shows. Cleaned link text; a vague one ("Detailed result", "DV cutoff") gets the
 * organisation added, and one with nothing left ("Updated On 21-10-2026") becomes a dated notice.
 */
export function jobTitle(raw: string, organization?: string): string {
  const title = cleanTitle(raw);
  if (!organization) return title;
  const org = organizationName(organization);
  if (tooShort(title)) {
    const exact = raw.match(/(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](20\d\d)(?!\d)/);
    const date = exact ? formatDate(`${exact[3]}-${exact[2]!.padStart(2, '0')}-${exact[1]!.padStart(2, '0')}`) : null;
    return date ? `Notice dated ${date} — ${org}` : title;
  }
  const words = title.split(/\s+/).length;
  const vague = words <= 4 || DATED_NOTICE.test(title);
  return vague && !title.toLowerCase().includes(org.toLowerCase()) ? `${title} — ${org}` : title;
}

export function decide(
  job: Pick<Job, 'title' | 'sourceId' | 'category' | 'links' | 'foundAt'> & { organization?: string; dates?: Partial<Job['dates']> },
  cfg: AutoConfig,
  now: Date,
): AutoDecision {
  // Rules read the notice's own words (a title fixed on an earlier run ends with " — <organisation>").
  const suffix = job.organization ? ` — ${organizationName(job.organization)}` : null;
  const own = suffix && job.title.endsWith(suffix) ? job.title.slice(0, -suffix.length) : job.title;
  const cleaned = cleanTitle(own);
  const title = jobTitle(own, job.organization);
  const text = `${cleaned} ${job.links.notification}`;
  const stage = UPDATE.find(([re]) => re.test(cleaned))?.[1] ?? null;
  const base = { title, stage };
  if (cfg.mode === 'off') return { ...base, action: 'keep', quiet: true, reason: 'auto-publishing is off' };
  if (JUNK.test(cleaned)) return { ...base, action: 'reject', quiet: true, reason: 'not a job notice' };
  // Source pages often still list notices from years ago; the monitor sees them as "new links".
  const newest = newestMention([job.title, job.links.notification, job.dates?.notification ?? '', job.dates?.lastDate ?? '', job.dates?.exam ?? ''], now);
  const maxAge = cfg.maxNoticeAgeDays ?? DEFAULT_MAX_NOTICE_AGE_DAYS;
  // An exact date counts by days; a bare year only when it is two or more years back (a 2025
  // recruitment can still have exams and results in 2026).
  const old = newest && (newest.exact ? (now.getTime() - newest.date.getTime()) / 86_400_000 > maxAge : newest.date.getUTCFullYear() < now.getUTCFullYear() - 1);
  if (newest && old) {
    const when = newest.exact ? newest.date.toISOString().slice(0, 10) : String(newest.date.getUTCFullYear());
    return { ...base, action: 'reject', quiet: true, reason: `old notice (newest date mentioned: ${when})` };
  }
  // A dated notice is a title jobTitle made up on an earlier run, not the notice's words.
  if (tooShort(cleaned) || DATED_NOTICE.test(own)) {
    return stale(job, cfg, now) ?? { ...base, action: 'keep', quiet: true, reason: 'title too short to understand' };
  }
  if (RECRUITMENT.test(text) && !stage) {
    // A new recruitment gets a push; an update about one (postponement, corrigendum…) is published quietly.
    const update = UPDATE_NOTICE.test(cleaned);
    return { ...base, action: 'publish', quiet: update, reason: update ? 'update to a recruitment' : 'recruitment notice' };
  }
  if (stage) return { ...base, action: 'publish', quiet: true, reason: `${stage} update` };
  if (cfg.mode === 'all') return { ...base, action: 'publish', quiet: true, reason: 'publish-all mode' };
  const lowSignal = cfg.lowSignalSources.includes(job.sourceId);
  if (!lowSignal && EXAM_BODIES.has(job.category) && EXAM_NOTICE.test(cleaned)) return { ...base, action: 'publish', quiet: true, reason: 'exam notice from a recruiting body' };
  if (lowSignal) return { ...base, action: 'reject', quiet: true, reason: 'general notice from an administration website' };
  return stale(job, cfg, now) ?? { ...base, action: 'keep', quiet: true, reason: 'unclear — left as a draft' };

  function stale(j: Pick<Job, 'foundAt'>, c: AutoConfig, n: Date): AutoDecision | null {
    const age = (n.getTime() - Date.parse(j.foundAt)) / 86_400_000;
    return age > c.staleDraftDays ? { ...base, action: 'reject', quiet: true, reason: `unclear for ${c.staleDraftDays}+ days` } : null;
  }
}
