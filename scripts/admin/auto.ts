// Auto-publishing: decides what to do with each new draft so nobody has to publish by hand.
// Pure functions (tested in tests/auto.test.ts); scripts/admin/auto-run.ts applies them.
import type { StageId } from '../../src/core/constants';
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

const RECRUITMENT = /recruit|vacanc|\badvt\b|advt\.|advertisement|notification for|apply\s*online|online\s*application|walk[\s-]?in|engagement of|posts? of|direct recruitment|भर्ती|विज्ञापन|रिक्ति|पदों/i;
const UPDATE: [RegExp, StageId][] = [
  [/admit\s*card|hall\s*ticket|call\s*letter|interview letter|प्रवेश\s*पत्र/i, 'admit-card'],
  [/answer\s*key|उत्तर\s*कुंजी|model answer/i, 'answer-key'],
  [/result|merit\s*list|selection\s*list|selected candidates|cut[\s-]?off|final list|परिणाम/i, 'result'],
];
/** Words that mark a notice about an existing recruitment (published, but no "new job" push). */
const UPDATE_NOTICE = /important\s*notice|notice\s*(?:regarding|reg\.?|to|for\s+the\s+candidates|about|on)\b|corrigendum|addendum|postpone|reschedul|revised|extension|cancell|rebuttal|press\s*release|regarding|document verification|physical|calendar|uploaded|सूचना|संशोधन|अन्तर्गत|अंतर्गत|शारीरिक|लिखित\s*परीक्षा/i;
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
];
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
  t = t.replace(/[_\s]+/g, ' ').replace(/\s+([,.:;)])/g, '$1').replace(/^[\s:–-]+|[\s:–-]+$/g, '').trim();
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length > 12 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) {
    t = t.split(' ').map((w, i) => caseWord(w, i === 0)).join(' ');
  }
  return t.length > 180 ? `${t.slice(0, 177).replace(/\s+\S*$/, '')}…` : t;
}

export interface AutoConfig {
  mode: 'smart' | 'all' | 'off';
  staleDraftDays: number;
  lowSignalSources: string[];
}

export function decide(job: Pick<Job, 'title' | 'sourceId' | 'category' | 'links' | 'foundAt'>, cfg: AutoConfig, now: Date): AutoDecision {
  const title = cleanTitle(job.title);
  const text = `${title} ${job.links.notification}`;
  const stage = UPDATE.find(([re]) => re.test(title))?.[1] ?? null;
  const base = { title, stage };
  if (cfg.mode === 'off') return { ...base, action: 'keep', quiet: true, reason: 'auto-publishing is off' };
  if (JUNK.test(title)) return { ...base, action: 'reject', quiet: true, reason: 'not a job notice' };
  if (title.replace(/[^\p{L}\p{N}]/gu, '').length < 8) {
    return stale(job, cfg, now) ?? { ...base, action: 'keep', quiet: true, reason: 'title too short to understand' };
  }
  if (RECRUITMENT.test(text) && !stage) {
    // A new recruitment gets a push; an update about one (postponement, corrigendum…) is published quietly.
    const update = UPDATE_NOTICE.test(title);
    return { ...base, action: 'publish', quiet: update, reason: update ? 'update to a recruitment' : 'recruitment notice' };
  }
  if (stage) return { ...base, action: 'publish', quiet: true, reason: `${stage} update` };
  if (cfg.mode === 'all') return { ...base, action: 'publish', quiet: true, reason: 'publish-all mode' };
  const lowSignal = cfg.lowSignalSources.includes(job.sourceId);
  if (!lowSignal && EXAM_BODIES.has(job.category) && EXAM_NOTICE.test(title)) return { ...base, action: 'publish', quiet: true, reason: 'exam notice from a recruiting body' };
  if (lowSignal) return { ...base, action: 'reject', quiet: true, reason: 'general notice from an administration website' };
  return stale(job, cfg, now) ?? { ...base, action: 'keep', quiet: true, reason: 'unclear — left as a draft' };

  function stale(j: Pick<Job, 'foundAt'>, c: AutoConfig, n: Date): AutoDecision | null {
    const age = (n.getTime() - Date.parse(j.foundAt)) / 86_400_000;
    return age > c.staleDraftDays ? { ...base, action: 'reject', quiet: true, reason: `unclear for ${c.staleDraftDays}+ days` } : null;
  }
}
