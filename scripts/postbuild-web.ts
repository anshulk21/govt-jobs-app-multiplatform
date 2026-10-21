// Runs after `expo export` (part of `npm run build:web`):
//   - sitemaps (jobs, states, categories, pages) + sitemap index, robots.txt
//   - 404.html, Cloudflare cache headers
//   - removes dev-only pages from the output
//   - audits every page's title/description/canonical and fails on problems
import fs from 'node:fs';
import path from 'node:path';
import { APP } from '../src/config/app';
import { CATEGORIES, QUALIFICATIONS, STATES, categorySlug } from '../src/core/constants';
import { publishedJobs } from '../src/server/data';
import { ROOT } from './lib/paths';
import { auditPages, chunkSitemap, deferAppScripts, readPageSeo, robotsTxt, sitemapIndex, urlset, type SitemapUrl } from './lib/sitemap';

const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run `expo export --platform web` first (npm run build:web does both).');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const jobs = publishedJobs();
const latestFor = (pred: (j: (typeof jobs)[number]) => boolean) =>
  jobs.filter(pred).reduce<string | undefined>((max, j) => (!max || j.updatedAt > max ? j.updatedAt : max), undefined)?.slice(0, 10) ?? today;

// 1. Remove pages that must not be public: Expo Router's dev route list, the
//    placeholder pages for dynamic routes (e.g. jobs/[slug].html), and duplicate
//    copies under route groups (e.g. (tabs)/index.html duplicates index.html).
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const entry of fs.readdirSync(DIST)) {
  if (/^\(.+\)$/.test(entry)) fs.rmSync(path.join(DIST, entry), { recursive: true });
}
for (const file of walk(DIST)) {
  const rel = path.relative(DIST, file);
  if (rel === '_sitemap.html' || (/\[.+\]\.html$/.test(rel) && !rel.startsWith('_expo'))) fs.rmSync(file);
}

// 2. 404 page (Cloudflare Pages serves /404.html for unknown URLs).
const notFound = path.join(DIST, '+not-found.html');
if (fs.existsSync(notFound)) fs.renameSync(notFound, path.join(DIST, '404.html'));

// 3. Sitemaps.
const groups: Record<string, SitemapUrl[]> = {
  'sitemap-jobs': jobs.map((j) => ({ path: `/jobs/${j.slug}`, lastmod: j.updatedAt.slice(0, 10) })),
  'sitemap-states': [
    { path: '/states', lastmod: latestFor((j) => j.level !== 'central') },
    ...STATES.map((s) => ({ path: `/state/${s.slug}`, lastmod: latestFor((j) => j.state === s.code) })),
  ],
  'sitemap-categories': [
    { path: '/categories', lastmod: latestFor(() => true) },
    ...CATEGORIES.map((c) => ({ path: `/category/${categorySlug(c)}`, lastmod: latestFor((j) => j.category === c) })),
    ...QUALIFICATIONS.map((q) => ({ path: `/qualification/${q.id}`, lastmod: latestFor((j) => j.qualifications.includes(q.id)) })),
    ...['admit-card', 'answer-key', 'result'].map((s) => ({ path: `/${s}`, lastmod: latestFor((j) => j.timeline.some((t) => t.stage === s)) })),
  ],
  'sitemap-pages': [
    { path: '/', lastmod: latestFor(() => true) },
    ...['/tools', '/tools/age-calculator', '/tools/age-eligibility', '/tools/photo-resizer', '/tools/images-to-pdf', '/tools/cgpa-to-percentage', '/about', '/contact', '/privacy', '/terms', '/disclaimer'].map((p) => ({ path: p })),
  ],
};
const files = Object.entries(groups).flatMap(([name, urls]) => chunkSitemap(name, urls));
for (const f of files) fs.writeFileSync(path.join(DIST, f.name), urlset(APP.siteUrl, f.urls));
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemapIndex(APP.siteUrl, files.map((f) => ({ name: f.name, lastmod: today }))));
fs.writeFileSync(path.join(DIST, 'robots.txt'), robotsTxt(APP.siteUrl));

// 4. Cloudflare Pages headers: hashed assets cached forever, API briefly, pages revalidated.
fs.writeFileSync(
  path.join(DIST, '_headers'),
  [
    '/_expo/static/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '/api/*',
    '  Cache-Control: public, max-age=300',
    '  Access-Control-Allow-Origin: *',
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '',
  ].join('\n'),
);

// 5. Inline the (small) stylesheet into every page: the browser can paint without
//    waiting for a separate CSS request, which matters on slow mobile networks.
const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html'));
const cssCache = new Map<string, string>();
for (const file of htmlFiles) {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<link rel="preload" href="(\/_expo\/static\/css\/[^"]+\.css)" as="style"\/>/g, '');
  html = html.replace(/<link rel="stylesheet" href="(\/_expo\/static\/css\/[^"]+\.css)"\/>/g, (tag, href: string) => {
    const cssFile = path.join(DIST, href);
    if (!fs.existsSync(cssFile)) return tag;
    if (!cssCache.has(href)) cssCache.set(href, fs.readFileSync(cssFile, 'utf8'));
    const css = cssCache.get(href)!;
    return css.length < 30_000 ? `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>` : tag;
  });
  html = deferAppScripts(html);
  fs.writeFileSync(file, html);
}

// 6. SEO audit of every page.
const pages = walk(DIST)
  .filter((f) => f.endsWith('.html') && !f.endsWith('404.html'))
  .map((f) => readPageSeo(path.relative(DIST, f), fs.readFileSync(f, 'utf8')));
const { errors, warnings } = auditPages(pages);
const urlCount = files.reduce((n, f) => n + f.urls.length, 0);
console.log(`✓ ${pages.length} pages, ${urlCount} URLs in ${files.length} sitemaps, robots.txt, 404.html, _headers`);
if (warnings.length) {
  console.warn(`⚠ SEO: ${warnings.length} content warning(s) — the site still deploys; improve these job titles in the admin panel:`);
  for (const w of warnings) console.warn(`  - ${w}`);
}
if (errors.length) {
  console.error(`✗ SEO audit found ${errors.length} problem(s) that block the deploy:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('✓ SEO audit: every indexable page has a title, description, canonical link and one main heading');
