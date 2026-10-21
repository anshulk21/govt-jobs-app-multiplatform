// Shared constants used by the monitor scripts and (later) the app/website.

export const LEVELS = ['central', 'state', 'ut'] as const;
export type Level = (typeof LEVELS)[number];

export const CATEGORIES = [
  'SSC',
  'UPSC',
  'Railway',
  'Bank',
  'Defence',
  'Police',
  'Teaching',
  'PSU',
  'PSC',
  'Subordinate Services',
  'Health',
  'High Court',
  'Electricity',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ['high', 'normal'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface StateInfo {
  code: string;
  name: string;
  slug: string;
  level: Exclude<Level, 'central'>;
}

// All 28 states and 8 union territories. `code` is used in data files
// (lowercased for file names) and in push topics (e.g. state_UP).
export const STATES: readonly StateInfo[] = [
  { code: 'AP', name: 'Andhra Pradesh', slug: 'andhra-pradesh', level: 'state' },
  { code: 'AR', name: 'Arunachal Pradesh', slug: 'arunachal-pradesh', level: 'state' },
  { code: 'AS', name: 'Assam', slug: 'assam', level: 'state' },
  { code: 'BR', name: 'Bihar', slug: 'bihar', level: 'state' },
  { code: 'CG', name: 'Chhattisgarh', slug: 'chhattisgarh', level: 'state' },
  { code: 'GA', name: 'Goa', slug: 'goa', level: 'state' },
  { code: 'GJ', name: 'Gujarat', slug: 'gujarat', level: 'state' },
  { code: 'HR', name: 'Haryana', slug: 'haryana', level: 'state' },
  { code: 'HP', name: 'Himachal Pradesh', slug: 'himachal-pradesh', level: 'state' },
  { code: 'JH', name: 'Jharkhand', slug: 'jharkhand', level: 'state' },
  { code: 'KA', name: 'Karnataka', slug: 'karnataka', level: 'state' },
  { code: 'KL', name: 'Kerala', slug: 'kerala', level: 'state' },
  { code: 'MP', name: 'Madhya Pradesh', slug: 'madhya-pradesh', level: 'state' },
  { code: 'MH', name: 'Maharashtra', slug: 'maharashtra', level: 'state' },
  { code: 'MN', name: 'Manipur', slug: 'manipur', level: 'state' },
  { code: 'ML', name: 'Meghalaya', slug: 'meghalaya', level: 'state' },
  { code: 'MZ', name: 'Mizoram', slug: 'mizoram', level: 'state' },
  { code: 'NL', name: 'Nagaland', slug: 'nagaland', level: 'state' },
  { code: 'OD', name: 'Odisha', slug: 'odisha', level: 'state' },
  { code: 'PB', name: 'Punjab', slug: 'punjab', level: 'state' },
  { code: 'RJ', name: 'Rajasthan', slug: 'rajasthan', level: 'state' },
  { code: 'SK', name: 'Sikkim', slug: 'sikkim', level: 'state' },
  { code: 'TN', name: 'Tamil Nadu', slug: 'tamil-nadu', level: 'state' },
  { code: 'TG', name: 'Telangana', slug: 'telangana', level: 'state' },
  { code: 'TR', name: 'Tripura', slug: 'tripura', level: 'state' },
  { code: 'UP', name: 'Uttar Pradesh', slug: 'uttar-pradesh', level: 'state' },
  { code: 'UK', name: 'Uttarakhand', slug: 'uttarakhand', level: 'state' },
  { code: 'WB', name: 'West Bengal', slug: 'west-bengal', level: 'state' },
  { code: 'AN', name: 'Andaman and Nicobar Islands', slug: 'andaman-nicobar', level: 'ut' },
  { code: 'CH', name: 'Chandigarh', slug: 'chandigarh', level: 'ut' },
  { code: 'DD', name: 'Dadra and Nagar Haveli and Daman and Diu', slug: 'dadra-nagar-haveli-daman-diu', level: 'ut' },
  { code: 'DL', name: 'Delhi', slug: 'delhi', level: 'ut' },
  { code: 'JK', name: 'Jammu and Kashmir', slug: 'jammu-kashmir', level: 'ut' },
  { code: 'LA', name: 'Ladakh', slug: 'ladakh', level: 'ut' },
  { code: 'LD', name: 'Lakshadweep', slug: 'lakshadweep', level: 'ut' },
  { code: 'PY', name: 'Puducherry', slug: 'puducherry', level: 'ut' },
];

export const STATE_BY_CODE: ReadonlyMap<string, StateInfo> = new Map(STATES.map((s) => [s.code, s]));

// Qualification filters. `id` is used in push topics (e.g. qual_12th).
export const QUALIFICATIONS = [
  { id: '8th', label: '8th pass' },
  { id: '10th', label: '10th pass' },
  { id: '12th', label: '12th pass' },
  { id: 'iti', label: 'ITI' },
  { id: 'diploma', label: 'Diploma' },
  { id: 'graduate', label: 'Graduate' },
  { id: 'postgraduate', label: 'Post Graduate' },
  { id: 'engineering', label: 'Engineering (B.E./B.Tech)' },
  { id: 'medical', label: 'Medical (MBBS/BDS)' },
  { id: 'nursing', label: 'Nursing' },
  { id: 'law', label: 'Law (LLB)' },
  { id: 'bed', label: 'B.Ed / Teaching' },
] as const;
export type QualificationId = (typeof QUALIFICATIONS)[number]['id'];

export const JOB_STATUSES = ['draft', 'published', 'rejected'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

// Status timeline of a recruitment, in order.
export const STAGES = [
  { id: 'notification', label: 'Notification' },
  { id: 'apply', label: 'Apply' },
  { id: 'admit-card', label: 'Admit Card' },
  { id: 'answer-key', label: 'Answer Key' },
  { id: 'result', label: 'Result' },
] as const;
export type StageId = (typeof STAGES)[number]['id'];

/** URL slug for a category, e.g. "High Court" → "high-court". */
export function categorySlug(category: Category): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function categoryFromSlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => categorySlug(c) === slug);
}

export function stateFromSlug(slug: string): StateInfo | undefined {
  return STATES.find((s) => s.slug === slug);
}
