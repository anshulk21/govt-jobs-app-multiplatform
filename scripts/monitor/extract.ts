// Regex-based detection of job details in notification text (from PDFs or link
// text). Rule: only report what is literally in the text. Every value comes
// with the snippet it was found in, so a human can check it before publishing.
import type { QualificationId } from '../../src/core/constants';
import type { JobDates } from '../../src/core/types';

export interface Extracted {
  vacancies: number | null;
  dates: JobDates;
  ageLimit: string | null;
  fee: string | null;
  qualifications: QualificationId[];
  /** field name → exact text the value came from */
  evidence: Record<string, string>;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

// 15-11-2026, 15/11/2026, 15.11.2026, 15 Nov 2026, 15th November, 2026, November 15, 2026
const DATE_RE = new RegExp(
  [
    String.raw`\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b`,
    String.raw`\b(\d{1,2})(?:st|nd|rd|th)?[\s.-]*(${MONTH_RE})[a-z]*[\s.,-]*(\d{4})\b`,
    String.raw`\b(${MONTH_RE})[a-z]*[\s.-]+(\d{1,2})(?:st|nd|rd|th)?,?[\s.-]*(\d{4})\b`,
  ].join('|'),
  'gi',
);

const monthNumber = (name: string) => MONTHS[name.toLowerCase()] ?? MONTHS[name.toLowerCase().slice(0, 3)] ?? 0;

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // e.g. 31-02
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** All dates in a piece of text, in order, as ISO yyyy-mm-dd. Indian day-first order is assumed. */
export function findDates(text: string): { iso: string; index: number; raw: string }[] {
  const out: { iso: string; index: number; raw: string }[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    let value: string | null = null;
    if (m[1]) value = iso(Number(m[3]), Number(m[2]), Number(m[1]));
    else if (m[4]) value = iso(Number(m[6]), monthNumber(m[5]!), Number(m[4]));
    else if (m[7]) value = iso(Number(m[9]), monthNumber(m[7]!), Number(m[8]));
    if (value) out.push({ iso: value, index: m.index!, raw: m[0] });
  }
  return out;
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Text from the keyword to `len` characters after it, for use as evidence. */
function snippetAt(text: string, index: number, len = 160): string {
  return squash(text.slice(index, index + len));
}

/** Text from `start` to the end of its line; if nothing but punctuation follows the label, the next line too. */
function labelScope(text: string, start: number, labelEnd: number, window: number): string {
  const lineEnd = (from: number) => {
    const i = text.indexOf('\n', from);
    return i === -1 ? text.length : i;
  };
  let end = lineEnd(labelEnd);
  if (/^[\s:\-–.)]*$/.test(text.slice(labelEnd, end))) end = lineEnd(end + 1);
  return text.slice(start, Math.min(end, labelEnd + window));
}

/**
 * Finds the first date after one of the labels on the same line,
 * e.g. "Last date for online application: 15.11.2026".
 */
function dateAfterLabel(text: string, labels: RegExp, window = 120): { iso: string; evidence: string } | null {
  for (const m of text.matchAll(new RegExp(labels.source, 'gi'))) {
    const after = labelScope(text, m.index!, m.index! + m[0].length, window);
    const d = findDates(after)[0];
    if (d) return { iso: d.iso, evidence: squash(after.slice(0, d.index + d.raw.length)) };
  }
  return null;
}

const LABELS = {
  lastDate: /last\s+date|closing\s+date|end\s+date|last\s+day|apply\s+(?:on\s*line\s+)?(?:up\s*to|till|by|before)|(?:on\s*line\s+)?registration\s+(?:closes|ends)/,
  applyStart: /(?:starting|start|opening|commencement)\s+(?:date\s+)?(?:of|for)?\s*(?:on\s*line\s+)?(?:application|registration|submission)|application\s+(?:starts|start\s+date|opens)|on\s*line\s+(?:application|registration)\s+(?:starts|begins|from)/,
  exam: /(?:date\s+of\s+(?:the\s+)?(?:written\s+|online\s+|computer\s+based\s+|preliminary\s+)?(?:exam(?:ination)?|test|cbt))|(?:exam(?:ination)?|cbt|written\s+test)\s+date/,
  notification: /(?:date\s+of\s+(?:notification|advertisement|publication))|(?:dated|dt\.?)(?=\s*[:\-]?\s*\d)/,
};

// "Total No. of Posts: 1,234", "Total Vacancies - 12000", "No. of vacancies: 45", "12,000 posts"
const VACANCY_PATTERNS = [
  /(?:total\s+(?:no\.?\s*(?:of\s+)?)?(?:posts?|vacanc(?:y|ies))|no\.?\s*of\s+(?:posts?|vacanc(?:y|ies))|number\s+of\s+(?:posts?|vacanc(?:y|ies)))\s*[:\-–=]?\s*(\d{1,3}(?:,\d{2,3})*|\d+)/i,
  /\b(\d{1,3}(?:,\d{2,3})+|\d{2,6})\s+(?:posts|vacancies)\b/i,
];

function findVacancies(text: string): { value: number; evidence: string } | null {
  for (const re of VACANCY_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const value = Number(m[1]!.replace(/,/g, ''));
    if (value > 0 && value <= 500_000) return { value, evidence: squash(m[0]) };
  }
  return null;
}

function findAgeLimit(text: string): { value: string; evidence: string } | null {
  const m = text.match(/age\s*(?:limit|criteria|\(as\s+on[^)]*\))?[^.\n]{0,80}?(\d{2})\s*(?:years?\s*)?(?:to|-|–|and)\s*(\d{2})\s*years?/i);
  if (m) {
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    if (lo >= 14 && hi <= 70 && lo < hi) return { value: `${lo}–${hi} years`, evidence: squash(m[0]) };
  }
  const max = text.match(/(?:maximum|upper)\s+age(?:\s+limit)?[^.\n]{0,40}?(\d{2})\s*years?/i);
  if (max && Number(max[1]) >= 18 && Number(max[1]) <= 70) return { value: `Up to ${Number(max[1])} years`, evidence: squash(max[0]) };
  return null;
}

function findFee(text: string): { value: string; evidence: string } | null {
  const m = text.match(/(?:application|examination|exam)\s+fee[s]?/i);
  if (!m) return null;
  const evidence = snippetAt(text, m.index!, 200);
  const amounts = [...evidence.matchAll(/(?:rs\.?|₹|inr)\s*\/?-?\s*(\d[\d,]*)/gi)].map((a) => Number(a[1]!.replace(/,/g, '')));
  const nil = /\b(nil|no\s+fee|exempted)\b/i.test(evidence);
  if (!amounts.length && !nil) return null;
  const parts = [...new Set(amounts)].map((a) => `₹${a.toLocaleString('en-IN')}`);
  if (nil) parts.push('nil for some categories');
  return { value: parts.join(', '), evidence };
}

const QUAL_PATTERNS: [QualificationId, RegExp][] = [
  ['8th', /\b8th\s+(?:pass|class|standard)\b/i],
  ['10th', /\b(?:10th|matric(?:ulation)?|high\s+school|sslc|secondary\s+school\s+(?:certificate|examination))\b/i],
  ['12th', /\b(?:12th|10\s*\+\s*2|intermediate|higher\s+secondary|hsc|senior\s+secondary)\b/i],
  ['iti', /\biti\b|industrial\s+training\s+institute|\bncvt\b|\bscvt\b/i],
  ['diploma', /\bdiploma\b/i],
  ['graduate', /\b(?:bachelor'?s?\s+degree|graduat(?:e|ion)\s+(?:degree|in|from)|any\s+graduate|degree\s+(?:in|from)\s+(?:a\s+)?recogni[sz]ed)\b|degree\s*\(\s*graduation\s*\)|graduation\)?\s+in\s+any\s+discipline/i],
  ['postgraduate', /\b(?:master'?s?\s+degree|post\s*-?\s*graduat(?:e|ion))\b/i],
  // Dotted "B.E." only: an undotted "be" is the ordinary English word.
  ['engineering', /(?:\bb\.\s?e\.|\bb\.?\s?tech\b|\bbachelor\s+of\s+(?:engineering|technology)\b)/i],
  ['medical', /\b(?:m\.?b\.?b\.?s|b\.?d\.?s)\b/i],
  ['nursing', /\b(?:b\.?\s*sc\.?\s*nursing|gnm|anm|nursing)\b/i],
  ['law', /\b(?:ll\.?b|degree\s+in\s+law|bachelor\s+of\s+laws?)\b/i],
  ['bed', /\b(?:b\.?\s*ed\.?|d\.?\s*el\.?\s*ed|ctet|tet)\b/i],
];

function findQualifications(text: string): { ids: QualificationId[]; evidence: string } | null {
  // Only look near the eligibility section, so e.g. "10th" in a date isn't counted.
  const m = text.match(/(?:educational\s+qualification|essential\s+qualification|qualification|eligibility)/i);
  if (!m) return null;
  const section = text.slice(m.index!, m.index! + 1500);
  const ids = QUAL_PATTERNS.filter(([, re]) => re.test(section)).map(([id]) => id);
  return ids.length ? { ids, evidence: snippetAt(text, m.index!, 240) } : null;
}

/** How far (in days) before/after the day the notice was found each kind of date can plausibly be. */
const DATE_WINDOW: Record<keyof JobDates, [number, number]> = {
  notification: [-730, 7],
  applyStart: [-365, 180],
  lastDate: [-365, 365],
  exam: [-365, 730],
};

/**
 * `foundOn` (yyyy-mm-dd, default today) is when the notice was found. Dates implausibly far
 * from it (e.g. a 2013 "notification date" on a notice found in 2026) are dropped, not saved.
 */
export function extractDetails(text: string, foundOn: string = new Date().toISOString().slice(0, 10)): Extracted {
  const evidence: Record<string, string> = {};
  const dates: JobDates = { notification: null, applyStart: null, lastDate: null, exam: null };
  const ref = Date.parse(foundOn);
  for (const key of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
    const found = dateAfterLabel(text, LABELS[key]);
    const offset = found ? (Date.parse(found.iso) - ref) / 86_400_000 : 0;
    if (found && offset >= DATE_WINDOW[key][0] && offset <= DATE_WINDOW[key][1]) {
      dates[key] = found.iso;
      evidence[`dates.${key}`] = found.evidence;
    }
  }
  const vac = findVacancies(text);
  if (vac) evidence.vacancies = vac.evidence;
  const age = findAgeLimit(text);
  if (age) evidence.ageLimit = age.evidence;
  const fee = findFee(text);
  if (fee) evidence.fee = fee.evidence;
  const qual = findQualifications(text);
  if (qual) evidence.qualifications = qual.evidence;

  return {
    vacancies: vac?.value ?? null,
    dates,
    ageLimit: age?.value ?? null,
    fee: fee?.value ?? null,
    qualifications: qual?.ids ?? [],
    evidence,
  };
}
