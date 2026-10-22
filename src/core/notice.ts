// What kind of notice a job title describes. Shared by the auto-publisher (scripts/admin/auto.ts)
// and the Google job markup (structured-data.ts). Pure, tested.
import type { StageId } from './constants';
import type { Job } from './types';

export const RECRUITMENT = /recruit|vacanc|\badvt\b|advt\.|advertisement|notification for|apply\s*online|online\s*application|walk[\s-]?in|engagement of|posts? of|direct recruitment|भर्ती|विज्ञापन|रिक्ति|पदों/i;
export const UPDATE: [RegExp, StageId][] = [
  [/admit\s*card|hall\s*ticket|call\s*letter|interview letter|प्रवेश\s*पत्र/i, 'admit-card'],
  [/answer\s*key|उत्तर\s*कुंजी|model answer/i, 'answer-key'],
  [/result|merit\s*list|selection\s*list|selected candidates|cut[\s-]?off|final list|परिणाम/i, 'result'],
];
/** Words that mark a notice about an existing recruitment (published, but no "new job" push). */
export const UPDATE_NOTICE = /important\s*notice|notice\s*(?:regarding|reg\.?|to|for\s+the\s+candidates|about|on)\b|corrigendum|addendum|postpone|reschedul|revised|extension|cancell|rebuttal|press\s*release|regarding|document verification|physical|calendar|uploaded|सूचना|संशोधन|अन्तर्गत|अंतर्गत|शारीरिक|लिखित\s*परीक्षा/i;
/** Recruitment-sounding pages that are not one job opening. */
const NOT_AN_OPENING = /archive|calendar|shortlist|list of|annexure|guideline|instruction|admission|syllabus|reporting for|disqualified|left out candidates|skill test|interview slot|\bpet\b|\bpst\b/i;

/** "Canara Bank — Recruitment" → "Canara Bank", "Goa — Police Recruitment Board" → "Goa Police Recruitment Board". */
export function organizationName(organization: string): string {
  return organization.replace(/\s*\(also [^)]*\)$/i, '').replace(/\s+—\s+(recruitment|careers?)$/i, '').replace(/\s+—\s+/g, ' ');
}

/** Days a posting without a last date keeps its Google job markup. */
export const OPENING_DAYS_WITHOUT_LAST_DATE = 30;

/**
 * True if the page is one open job opening (Google only allows JobPosting markup on those),
 * not an admit card, result, corrigendum or other notice about a recruitment.
 */
export function isJobOpening(job: Pick<Job, 'title' | 'timeline' | 'postName' | 'vacancies' | 'dates'>): boolean {
  if (job.timeline.some((t) => t.stage !== 'notification' && t.stage !== 'apply')) return false;
  if (UPDATE.some(([re]) => re.test(job.title)) || UPDATE_NOTICE.test(job.title) || NOT_AN_OPENING.test(job.title)) return false;
  return RECRUITMENT.test(job.title) || Boolean(job.postName || job.vacancies || job.dates.lastDate);
}
