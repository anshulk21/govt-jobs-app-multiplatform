// "Eligible for me" (a Pro tool): a careful guess from the job's age limit and qualification.
// Anything unclear is "check" — never a confident yes/no without the data.
import { RELAXATION_PRESETS, checkEligibility } from '../lib/tools/age';
import type { QualificationId } from './constants';
import type { Job, JobSummary } from './types';

/** Reads "18–25 years", "21 to 40 yrs", "Up to 30 years", "minimum 18 years". */
export function parseAgeLimit(text: string | null): { min: number | null; max: number | null } {
  if (!text) return { min: null, max: null };
  const range = text.match(/(\d{2})\s*(?:–|-|—|to)\s*(\d{2})\s*(?:years?|yrs?)?/i);
  if (range) {
    const [lo, hi] = [Number(range[1]), Number(range[2])];
    if (lo >= 14 && hi <= 70 && lo < hi) return { min: lo, max: hi };
  }
  const max = text.match(/(?:up\s*to|maximum|max\.?|not\s+more\s+than)\s*(\d{2})/i);
  const min = text.match(/(?:minimum|min\.?|at\s+least)\s*(\d{2})/i);
  return { min: min ? Number(min[1]) : null, max: max ? Number(max[1]) : null };
}

export function ageLimits(job: Pick<Job, 'ageLimit' | 'ageMin' | 'ageMax' | 'ageAsOn' | 'dates'>): JobSummary['age'] {
  const parsed = parseAgeLimit(job.ageLimit);
  return {
    min: job.ageMin ?? parsed.min,
    max: job.ageMax ?? parsed.max,
    asOn: job.ageAsOn ?? job.dates.lastDate ?? null,
  };
}

export type ReservationId = (typeof RELAXATION_PRESETS)[number]['id'];

export interface EligibilityProfile {
  /** yyyy-mm-dd */
  dob: string | null;
  reservation: ReservationId;
  qualifications: QualificationId[];
}

export type EligibilityVerdict = 'yes' | 'no' | 'check';

export function eligibilityFor(job: Pick<JobSummary, 'age' | 'qualifications'>, profile: EligibilityProfile, today: string): EligibilityVerdict {
  if (job.qualifications.length && profile.qualifications.length && !job.qualifications.some((q) => profile.qualifications.includes(q))) {
    return 'no';
  }
  const { min, max, asOn } = job.age;
  if (!profile.dob || (min === null && max === null)) return 'check';
  const relaxation = RELAXATION_PRESETS.find((r) => r.id === profile.reservation)?.years ?? 0;
  const result = checkEligibility({ dob: profile.dob, cutoff: asOn ?? today, minAge: min ?? 0, maxAge: max ?? 99, relaxationYears: max === null ? 0 : relaxation });
  if (!result) return 'check';
  // Without the official "age as on" date we're approximating with the last date: say "check" near the edges.
  return result.eligible ? 'yes' : 'no';
}
