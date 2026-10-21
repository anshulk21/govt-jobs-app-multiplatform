// Helpers for the website build: sitemaps, robots.txt, SEO audit, script loading (pure, tested).

export interface SitemapUrl {
  path: string;
  /** yyyy-mm-dd */
  lastmod?: string;
}

const MAX_URLS = 45_000; // Google's limit is 50,000 per file

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function urlset(siteUrl: string, urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => `  <url><loc>${esc(siteUrl + u.path)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapIndex(siteUrl: string, files: { name: string; lastmod: string }[]): string {
  const body = files.map((f) => `  <sitemap><loc>${esc(`${siteUrl}/${f.name}`)}</loc><lastmod>${f.lastmod}</lastmod></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/** Splits a big list into sitemap files: name.xml, or name-1.xml, name-2.xml… when large. */
export function chunkSitemap(name: string, urls: SitemapUrl[]): { name: string; urls: SitemapUrl[] }[] {
  if (urls.length <= MAX_URLS) return [{ name: `${name}.xml`, urls }];
  const out: { name: string; urls: SitemapUrl[] }[] = [];
  for (let i = 0; i < urls.length; i += MAX_URLS) out.push({ name: `${name}-${out.length + 1}.xml`, urls: urls.slice(i, i + MAX_URLS) });
  return out;
}

export function robotsTxt(siteUrl: string): string {
  return ['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /_expo/loaders/', 'Disallow: /admin/', '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n');
}

export interface PageSeo {
  file: string;
  title: string | null;
  description: string | null;
  canonical: string | null;
  noindex: boolean;
  h1Count: number;
}

/** Reads the SEO tags of a pre-rendered page. */
export function readPageSeo(file: string, html: string): PageSeo {
  const attr = (re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
  const robots = attr(/<meta name="robots" content="([^"]*)"/i) ?? '';
  return {
    file,
    title: attr(/<title>([^<]*)<\/title>/i),
    description: attr(/<meta name="description" content="([^"]*)"/i),
    canonical: attr(/<link rel="canonical" href="([^"]*)"/i),
    noindex: /noindex/i.test(robots),
    h1Count: (html.match(/<h1[\s>]/g) ?? []).length,
  };
}

/**
 * SEO check of the built pages. `errors` are bugs that must block the deploy (missing tags);
 * `warnings` are content issues (duplicate titles/descriptions) that should be fixed but
 * must never stop new jobs from going live.
 */
export function auditPages(pages: PageSeo[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const indexable = pages.filter((p) => !p.noindex);
  for (const p of indexable) {
    if (!p.title) errors.push(`${p.file}: missing <title>`);
    if (!p.description) errors.push(`${p.file}: missing meta description`);
    if (!p.canonical) errors.push(`${p.file}: missing canonical link`);
    if (p.h1Count !== 1) errors.push(`${p.file}: has ${p.h1Count} main headings (should be 1)`);
  }
  for (const key of ['title', 'description'] as const) {
    const seen = new Map<string, string>();
    for (const p of indexable) {
      const v = p[key];
      if (!v) continue;
      if (seen.has(v)) warnings.push(`${p.file}: same ${key} as ${seen.get(v)}`);
      else seen.set(v, p.file);
    }
  }
  return { errors, warnings };
}

/**
 * The page HTML already contains all text and links, so the app's JavaScript (which
 * adds interactivity) is loaded right after the first paint instead of competing with
 * it on slow mobile connections. Order is kept (async=false). Inline scripts (loader
 * data) stay where they are.
 */
export function deferAppScripts(html: string): string {
  const srcs: string[] = [];
  const out = html.replace(/<script defer="" src="(\/_expo\/static\/js\/[^"]+)"><\/script>/g, (_m, src: string) => {
    srcs.push(src);
    return '';
  });
  if (!srcs.length) return html;
  // Start loading right after the browser's first paint (or 1.5 s after `load` if no
  // paint event arrives, e.g. in a background tab).
  const loader =
    `<script>(function(){var s=${JSON.stringify(srcs)},done=false;function go(){if(done)return;done=true;s.forEach(function(u){var e=document.createElement('script');e.src=u;e.async=false;document.body.appendChild(e)})}` +
    `try{var po=new PerformanceObserver(function(l){if(l.getEntriesByName('first-contentful-paint').length){po.disconnect();setTimeout(go,0)}});po.observe({type:'paint',buffered:true})}catch(e){}` +
    `addEventListener('load',function(){setTimeout(go,1500)})})()</script>`;
  return out.replace('</body>', `${loader}</body>`);
}
