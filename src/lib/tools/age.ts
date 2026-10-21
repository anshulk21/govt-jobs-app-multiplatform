// Age maths for the Age calculator and Age eligibility tools. Dates are yyyy-mm-dd.

export interface Age {
  years: number;
  months: number;
  days: number;
}

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
};
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function isValidDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { y, m, d } = parse(iso);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) && y >= 1900 && y <= 2100;
}

/** Exact age in years, months and days on `onDate` (the way recruitment notices count it). */
export function ageOn(dob: string, onDate: string): Age | null {
  if (!isValidDate(dob) || !isValidDate(onDate) || dob > onDate) return null;
  const a = parse(dob);
  const b = parse(onDate);
  let years = b.y - a.y;
  let months = b.m - a.m;
  let days = b.d - a.d;
  if (days < 0) {
    months -= 1;
    // Borrow the length of the month before onDate's month.
    const pm = b.m === 1 ? 12 : b.m - 1;
    const py = b.m === 1 ? b.y - 1 : b.y;
    days += daysInMonth(py, pm);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

/** "dd/mm/yyyy" or "dd-mm-yyyy" typed by a user → yyyy-mm-dd (or null). */
export function parseIndianDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return isValidDate(iso) ? iso : null;
}

/** Typical relaxation in upper age limit for central government jobs. ALWAYS check the notification. */
export const RELAXATION_PRESETS = [
  { id: 'gen', label: 'General / EWS', years: 0 },
  { id: 'obc', label: 'OBC (Non-Creamy Layer)', years: 3 },
  { id: 'scst', label: 'SC / ST', years: 5 },
  { id: 'pwbd', label: 'PwBD (General)', years: 10 },
  { id: 'pwbd-obc', label: 'PwBD (OBC)', years: 13 },
  { id: 'pwbd-scst', label: 'PwBD (SC/ST)', years: 15 },
] as const;

export interface EligibilityInput {
  dob: string;
  /** "Age as on" date from the notification. */
  cutoff: string;
  minAge: number;
  maxAge: number;
  relaxationYears: number;
}

export interface EligibilityResult {
  age: Age;
  maxAllowed: number;
  eligible: boolean;
  reason: 'ok' | 'too-young' | 'too-old';
}

/**
 * Recruitment rules count completed years: "18–25 years" means at least 18 and not yet 26
 * on the cutoff date (25 years 11 months is still eligible). Relaxation raises the upper limit.
 */
export function checkEligibility(input: EligibilityInput): EligibilityResult | null {
  const age = ageOn(input.dob, input.cutoff);
  if (!age) return null;
  const maxAllowed = input.maxAge + input.relaxationYears;
  if (age.years < input.minAge) return { age, maxAllowed, eligible: false, reason: 'too-young' };
  if (age.years > maxAllowed) return { age, maxAllowed, eligible: false, reason: 'too-old' };
  return { age, maxAllowed, eligible: true, reason: 'ok' };
}
