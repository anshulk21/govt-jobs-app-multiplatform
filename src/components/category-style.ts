// Colours and icons for job categories, shared by the home tiles, the Categories page and job cards.
import { CATEGORIES, type Category } from '@/core/constants';
import type { IconName } from './icon-names';

export const CATEGORY_ICON: Record<Category, IconName> = {
  SSC: 'document-text-outline',
  UPSC: 'trophy-outline',
  Railway: 'train-outline',
  Bank: 'bank-outline',
  Defence: 'shield-outline',
  Police: 'siren-outline',
  Teaching: 'school-outline',
  PSU: 'factory-outline',
  PSC: 'building-outline',
  'Subordinate Services': 'briefcase-outline',
  Health: 'medkit-outline',
  'High Court': 'scale-outline',
  Electricity: 'flash-outline',
  Other: 'sparkles-outline',
};

// Tile colours cycle through the palette; each pairs with a text colour that passes contrast.
export const TONES = [
  { box: 'bg-brand-600', text: 'text-white' },
  { box: 'bg-pink', text: 'text-ink' },
  { box: 'bg-sun', text: 'text-ink' },
  { box: 'bg-rose-dark', text: 'text-white' },
  { box: 'bg-ink dark:bg-cream', text: 'text-cream dark:text-ink' },
];

/** The tone a category always uses (same colour on tiles and job cards). */
export const toneFor = (c: Category) => TONES[CATEGORIES.indexOf(c) % TONES.length]!;

const SMALL_WORDS = new Set(['of', 'and', 'the', 'for', 'in', '&', '-']);

/** Short badge text for an organisation: "Bihar Public Service Commission" → "BPSC", "UP Police …" → "UPPRP". */
export function monogram(org: string): string {
  const inBrackets = /\(([A-Z]{2,6})\)/.exec(org)?.[1];
  if (inBrackets) return inBrackets;
  const words = org.split(/[\s,/—–]+/).filter((w) => /^[A-Za-z]/.test(w) && !SMALL_WORDS.has(w.toLowerCase()));
  // Words already in capitals (UP, GDS) are kept whole; others give their first letter.
  return words.map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w[0]!.toUpperCase())).join('').slice(0, 5) || '•';
}
