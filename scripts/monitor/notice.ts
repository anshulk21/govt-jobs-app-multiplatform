// Reads one notice (the page or file a job link points to) and pulls out its details.
//   - a PDF (by URL or by content type): its text
//   - a web page: its main text, plus the notification PDF it links to, if there is one
// Same rule as extract.ts: only what is literally in the notice, with the text it came from.
import * as cheerio from 'cheerio';
import type { Job } from '../../src/core/types';
import { fetchWithRetry } from '../lib/http';
import { extractDetails, findDates, type Extracted } from './extract';
import { extractLinks, isPdfUrl, type PageLink } from './links';
import { pdfToText } from './pdf';

export interface NoticeDeps {
  timeoutMs: number;
  pdfMaxBytes: number;
  pdfMaxPages: number;
  /** yyyy-mm-dd the notice was found (dates far from it are ignored). */
  foundOn: string;
  isAllowed: (url: string) => Promise<boolean>;
  throttle: (url: string) => Promise<void>;
  /** Takes one from the per-run PDF budget; false when it is used up. */
  takePdf: () => boolean;
}

export interface NoticeResult {
  extracted: Extracted | null;
  method: Job['extraction']['method'];
  error?: string;
}

const MAX_PAGE_BYTES = 3 * 1024 * 1024;
/** Readable text of a web page: no menus, headers, footers or scripts; one line per block. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, header, footer, aside, form, iframe, svg, [role=navigation], [role=banner], [role=contentinfo]').remove();
  // Separators go inside the elements: text between table tags would be moved out of the table.
  $('br').replaceWith('\n');
  $('td, th').append(' | ');
  $('p, div, li, tr, h1, h2, h3, h4, h5, h6, table, section, article, dd, dt, ul, ol').append('\n');
  return $('body')
    .text()
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').replace(/\s*\|\s*$/, '').trim())
    .filter(Boolean)
    .join('\n');
}

const LAST_DATE_LABEL = /last\s+date|closing\s+date/gi;

/**
 * True for a page that lists several notices (a "Recruitment" index) rather than describing one:
 * its "last date" labels are followed by different dates, so they can't be pinned on this job.
 */
export function looksLikeListing(text: string): boolean {
  const dates = new Set<string>();
  for (const m of text.matchAll(LAST_DATE_LABEL)) {
    const d = findDates(text.slice(m.index!, m.index! + 120))[0];
    if (d) dates.add(d.iso);
  }
  return dates.size > 1;
}

const NOTICE_WORDS = /advt|advertisement|notification|detailed|notice|vacanc|recruitment|download/i;
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));

/** The PDF on a notice page most likely to be the notification itself: notice-like, and sharing the most words with the title. */
export function pickNoticePdf(links: PageLink[], title: string): string | null {
  const want = words(title);
  // Some sites' PDF links don't end in .pdf; their text says so instead ("Download (.pdf - 965 KB)").
  const isPdf = (l: PageLink) => isPdfUrl(l.url) || /\bpdf\b/i.test(l.text);
  const score = (l: PageLink) => {
    const text = `${l.text} ${decodeURIComponentSafe(l.url)}`;
    const shared = [...words(text)].filter((w) => want.has(w)).length;
    // The English version reads better than the Hindi one.
    return shared + (/english/i.test(text) ? 2 : 0) - (/hindi/i.test(text) ? 2 : 0);
  };
  const pdfs = links
    .filter((l) => isPdf(l) && NOTICE_WORDS.test(`${l.text} ${l.url}`))
    .map((l) => ({ url: l.url, score: score(l) }))
    .sort((a, b) => b.score - a.score);
  return pdfs[0]?.url ?? null;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const hasFacts = (e: Extracted | null): e is Extracted => !!e && Object.keys(e.evidence).length > 0;

/** Values from `primary` win; `extra` only fills what `primary` doesn't have. */
export function mergeExtracted(primary: Extracted, extra: Extracted): Extracted {
  const out: Extracted = { ...primary, dates: { ...primary.dates }, evidence: { ...primary.evidence } };
  for (const [field, text] of Object.entries(extra.evidence)) {
    if (field in out.evidence) continue;
    if (field.startsWith('dates.')) {
      const k = field.slice(6) as keyof Extracted['dates'];
      out.dates[k] = extra.dates[k];
    } else if (field === 'vacancies') out.vacancies = extra.vacancies;
    else if (field === 'ageLimit') out.ageLimit = extra.ageLimit;
    else if (field === 'fee') out.fee = extra.fee;
    else if (field === 'qualifications') out.qualifications = extra.qualifications;
    out.evidence[field] = text;
  }
  return out;
}

async function pdfDetails(bytes: Uint8Array, deps: NoticeDeps): Promise<{ extracted: Extracted | null; error?: string }> {
  try {
    const { text } = await pdfToText(bytes, deps.pdfMaxPages);
    // pdf-parse adds "-- 1 of 10 --" page markers even when the pages are only images.
    if (text.replace(/-- \d+ of \d+ --/g, '').replace(/\s/g, '').length < 50) return { extracted: null, error: 'PDF has no text layer (probably scanned)' };
    return { extracted: extractDetails(text, deps.foundOn) };
  } catch (err) {
    return { extracted: null, error: `PDF could not be parsed (${(err as Error).message})` };
  }
}

async function fetchPdf(url: string, deps: NoticeDeps): Promise<{ extracted: Extracted | null; error?: string }> {
  if (!(await deps.isAllowed(url))) return { extracted: null, error: 'PDF not read (robots.txt disallows)' };
  if (!deps.takePdf()) return { extracted: null, error: 'PDF not read (per-run PDF limit reached)' };
  await deps.throttle(url);
  const r = await fetchWithRetry(url, { read: 'bytes', maxBytes: deps.pdfMaxBytes, timeoutMs: deps.timeoutMs, retries: 1 });
  if (!r.ok || !r.bytes) return { extracted: null, error: `PDF not read (${r.error ?? `HTTP ${r.status}`})` };
  return pdfDetails(r.bytes, deps);
}

export async function readNotice(url: string, title: string, deps: NoticeDeps): Promise<NoticeResult> {
  if (isPdfUrl(url)) {
    const { extracted, error } = await fetchPdf(url, deps);
    return { extracted, method: extracted ? 'pdf-regex' : 'link-only', error };
  }
  if (!(await deps.isAllowed(url))) return { extracted: null, method: 'link-only', error: 'Page not read (robots.txt disallows)' };
  await deps.throttle(url);
  const r = await fetchWithRetry(url, { read: 'bytes', maxBytes: Math.max(MAX_PAGE_BYTES, deps.pdfMaxBytes), timeoutMs: deps.timeoutMs, retries: 1 });
  if (!r.ok || !r.bytes) return { extracted: null, method: 'link-only', error: `Page not read (${r.error ?? `HTTP ${r.status}`})` };

  // Links like ".../release/744118" often serve the PDF itself.
  if (/application\/pdf/i.test(r.contentType ?? '') || new TextDecoder().decode(r.bytes.slice(0, 5)) === '%PDF-') {
    if (!deps.takePdf()) return { extracted: null, method: 'link-only', error: 'PDF not read (per-run PDF limit reached)' };
    const { extracted, error } = await pdfDetails(r.bytes, deps);
    return { extracted, method: extracted ? 'pdf-regex' : 'link-only', error };
  }

  const html = new TextDecoder().decode(r.bytes);
  const text = htmlToText(html);
  // A listing page's dates belong to other notices; only its linked PDF can be trusted.
  const fromPage = looksLikeListing(text) ? null : extractDetails(text, deps.foundOn);
  const pdfUrl = pickNoticePdf(extractLinks(html, r.finalUrl ?? url), title);
  const fromPdf = pdfUrl ? await fetchPdf(pdfUrl, deps) : null;

  if (hasFacts(fromPdf?.extracted ?? null)) {
    const pdf = fromPdf!.extracted!;
    return { extracted: hasFacts(fromPage) ? mergeExtracted(pdf, fromPage) : pdf, method: 'pdf-regex' };
  }
  if (hasFacts(fromPage)) return { extracted: fromPage, method: 'page-regex' };
  return { extracted: null, method: 'link-only', error: fromPdf?.error };
}
