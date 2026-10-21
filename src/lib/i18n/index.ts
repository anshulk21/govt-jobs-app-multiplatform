import { en, type MessageKey } from './en';
import { hi } from './hi';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
] as const;
export type Language = (typeof LANGUAGES)[number]['code'];
export type { MessageKey };

const dictionaries: Record<Language, Partial<Record<MessageKey, string>>> = { en, hi };

/** Looks up a UI string, filling {placeholders}; falls back to English. */
export function translate(lang: Language, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = dictionaries[lang][key] ?? en[key];
  return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : text;
}
