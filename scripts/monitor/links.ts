import * as cheerio from 'cheerio';

export interface PageLink {
  /** Absolute, normalized URL. */
  url: string;
  /** Best human-readable title: link text, or nearby text if the link text is vague. */
  text: string;
}

export interface LinkRules {
  /** Words from the source's linkFilter. Matched anywhere in the link text or URL path. */
  include: string[];
  /** Words from config.exclude. Matched at a word start in the link text or URL path. */
  exclude: string[];
}

const SKIP_EXTENSIONS = /\.(jpe?g|png|gif|svg|webp|ico|css|js|mp4|mp3|woff2?|ttf)$/i;
const SESSION_PARAMS = new Set(['jsessionid', 'phpsessid', 'sessionid', 'sid', 'aspsessionid']);
const CONTEXT_SELECTOR = 'li, tr, p, td, dd, h1, h2, h3, h4, h5, h6';

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Lowercase and turn -, _ and + into spaces so "right-to-information" matches "right to information". */
const fold = (s: string) => s.toLowerCase().replace(/[-_+]+/g, ' ');

/**
 * Makes a URL absolute and canonical: drops #fragments and session ids so the
 * same notice isn't seen as "new" on every visit. Returns null for non-web links.
 */
export function normalizeUrl(href: string, base: string): string | null {
  const raw = href.trim();
  if (!raw || /^(javascript|mailto|tel|data|whatsapp):/i.test(raw) || raw.startsWith('#')) return null;
  let u: URL;
  try {
    u = new URL(raw, base);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.hash = '';
  u.pathname = u.pathname.replace(/;jsessionid=[^/;?]*/i, '');
  for (const key of [...u.searchParams.keys()]) {
    if (SESSION_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
  }
  return u.toString().replace(/\?$/, '');
}

/** Key used to decide whether a link was seen before: ignores http/https and www. */
export function seenKey(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

/** Text of an element with a space between text nodes, so table cells don't run together. */
function spacedText(node: any): string {
  const parts: string[] = [];
  const walk = (n: any) => {
    if (n.type === 'text') parts.push(n.data);
    else if (n.type === 'tag' && n.name !== 'script' && n.name !== 'style') n.children?.forEach(walk);
  };
  walk(node);
  return squash(parts.join(' '));
}

function linkTitle($: cheerio.CheerioAPI, el: cheerio.Cheerio<any>, generic: Set<string>): string {
  // Untranslated template placeholders like {{'Exam_HM' | translate}} carry no meaning.
  const own = squash((el.text() || el.attr('title') || el.attr('aria-label') || '').replace(/\{\{[^}]*\}\}/g, ''));
  const vague = own.length < 4 || generic.has(own.toLowerCase().replace(/[^a-z ]/g, '').trim());
  if (!vague) return own.slice(0, 200);
  // Vague text like "Click here" or "Download": use the surrounding row/item instead.
  for (const parent of el.parents(CONTEXT_SELECTOR).toArray()) {
    const around = spacedText(parent);
    if (around.length > 400) break;
    if (around !== own) return around.slice(0, 200);
  }
  if (own) return own;
  // Nothing readable at all: fall back to the file name, e.g. "advt-05-2026.pdf".
  const file = decodeURIComponent(el.attr('href')?.split(/[?#]/)[0]?.split('/').pop() ?? '');
  return squash(file.replace(/[-_]+/g, ' '));
}

/** Every web link on a page, made absolute, de-duplicated (longest title wins). */
export function extractLinks(html: string, pageUrl: string, genericLinkText: string[] = []): PageLink[] {
  const $ = cheerio.load(html);
  const base = $('base[href]').attr('href');
  const baseUrl = base ? (normalizeUrl(base, pageUrl) ?? pageUrl) : pageUrl;
  const generic = new Set(genericLinkText.map((g) => g.toLowerCase()));
  const byUrl = new Map<string, PageLink>();

  $('a[href]').each((_, a) => {
    const el = $(a);
    const url = normalizeUrl(el.attr('href') ?? '', baseUrl);
    if (!url || SKIP_EXTENSIONS.test(new URL(url).pathname)) return;
    const text = linkTitle($, el, generic);
    const prev = byUrl.get(url);
    if (!prev || text.length > prev.text.length) byUrl.set(url, { url, text });
  });
  return [...byUrl.values()];
}

export function isPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

/** The part of a link we match words against: its text plus the URL path and query (not the host). */
function haystack(link: PageLink): string {
  let pathAndQuery = link.url;
  try {
    const u = new URL(link.url);
    pathAndQuery = u.pathname + u.search;
  } catch {
    /* keep raw */
  }
  let decoded = pathAndQuery;
  try {
    decoded = decodeURIComponent(pathAndQuery);
  } catch {
    /* keep raw */
  }
  return fold(`${link.text} ${decoded}`);
}

/** True if `word` appears in `text` starting at a word boundary ("tender" matches "tenders", not "attender"). */
export function matchesAtWordStart(text: string, word: string): boolean {
  const w = fold(word).trim();
  if (!w) return false;
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}`).test(text);
}

export function isExcluded(link: PageLink, exclude: string[]): boolean {
  const hay = haystack(link);
  return exclude.some((w) => matchesAtWordStart(hay, w));
}

/** Kept if it looks like a job notice (linkFilter word or a PDF) and isn't on the exclude list. */
export function isJobLink(link: PageLink, rules: LinkRules): boolean {
  const hay = haystack(link);
  const included = isPdfUrl(link.url) || rules.include.some((w) => w && hay.includes(fold(w)));
  return included && !isExcluded(link, rules.exclude);
}

export function filterJobLinks(links: PageLink[], rules: LinkRules): PageLink[] {
  return links.filter((l) => isJobLink(l, rules));
}

/**
 * For a source's first run with --seed: the links most likely to be current notices
 * (PDFs, or text mentioning a year or date), in page order — notice boards usually list
 * the newest first.
 */
export function pickSeedLinks(links: PageLink[], count: number): PageLink[] {
  const looksLikeNotice = (l: PageLink) => isPdfUrl(l.url) || /\b20\d{2}\b|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(l.text);
  return links.filter(looksLikeNotice).slice(0, count);
}
