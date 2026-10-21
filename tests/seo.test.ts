import { describe, expect, it } from 'vitest';
import type { Job } from '../src/core/types';
import { breadcrumbJsonLd, jobDescriptionHtml, jobPostingJsonLd } from '../src/core/structured-data';
import { auditPages, chunkSitemap, deferAppScripts, readPageSeo, robotsTxt, sitemapIndex, urlset } from '../scripts/lib/sitemap';

const SITE = 'https://example.in';

const job: Job = {
  id: 'abc123', slug: 'up-police-constable-2026', status: 'published', title: 'UP Police Constable 2026',
  organization: 'UP Police Recruitment & Promotion Board', sourceId: 'uppbpb', level: 'state', state: 'UP', category: 'Police',
  postName: 'Constable <Civil>', vacancies: 19220, qualifications: ['12th', 'graduate'], ageLimit: '18–22 years', fee: '₹400',
  dates: { notification: '2026-08-01', applyStart: '2026-08-05', lastDate: '2026-11-15', exam: null },
  howToApply: null, links: { notification: 'https://uppbpb.gov.in/n.pdf', official: 'https://uppbpb.gov.in/notices', apply: null },
  timeline: [], foundAt: '2026-08-01T04:00:00Z', publishedAt: '2026-08-02T04:00:00Z', updatedAt: '2026-08-02T04:00:00Z',
  extraction: { method: 'link-only', fields: [], evidence: {} },
};

describe('JobPosting structured data', () => {
  const ld = jobPostingJsonLd(job, SITE, '2026-10-20T00:00:00Z')!;

  it('has the fields Google requires, with validThrough at the end of the last day (IST)', () => {
    expect(ld['@type']).toBe('JobPosting');
    expect(ld.title).toBe('Constable <Civil>');
    expect(ld.datePosted).toBe('2026-08-02');
    expect(ld.validThrough).toBe('2026-11-15T23:59:59+05:30');
    expect(ld.hiringOrganization).toEqual({ '@type': 'Organization', name: job.organization, sameAs: 'https://uppbpb.gov.in' });
    expect(ld.jobLocation).toEqual({ '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'IN', addressRegion: 'Uttar Pradesh' } });
    expect(ld.totalJobOpenings).toBe(19220);
    expect(ld.educationRequirements).toEqual([
      { '@type': 'EducationalOccupationalCredential', credentialCategory: 'high school' },
      { '@type': 'EducationalOccupationalCredential', credentialCategory: 'bachelor degree' },
    ]);
    expect(ld.url).toBe(`${SITE}/jobs/up-police-constable-2026`);
  });

  it('omits the markup once the job has expired, and the region for central jobs', () => {
    expect(jobPostingJsonLd(job, SITE, '2026-11-16T00:00:00Z')).toBeNull();
    expect(jobPostingJsonLd(job, SITE, '2026-11-15T12:00:00Z')).not.toBeNull(); // last day itself is still open
    const central = jobPostingJsonLd({ ...job, level: 'central', state: null }, SITE, '2026-10-20T00:00:00Z')!;
    expect(central.jobLocation).toEqual({ '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'IN' } });
  });

  it('writes an escaped HTML description from the fields', () => {
    const html = jobDescriptionHtml(job);
    expect(html).toContain('<li>Post: Constable &lt;Civil&gt;</li>');
    expect(html).toContain('<li>Vacancies: 19,220</li>');
    expect(html).toContain('Last date: 15 Nov 2026');
    expect(html).not.toContain('Exam');
  });

  it('builds breadcrumbs', () => {
    const b = breadcrumbJsonLd(SITE, [{ name: 'Home', path: '/' }, { name: 'UP Jobs', path: '/state/uttar-pradesh' }]);
    expect(b.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'UP Jobs', item: `${SITE}/state/uttar-pradesh` },
    ]);
  });
});

describe('sitemaps and robots.txt', () => {
  it('writes escaped urlsets and an index', () => {
    const xml = urlset(SITE, [{ path: '/jobs/a&b', lastmod: '2026-10-20' }, { path: '/about' }]);
    expect(xml).toContain('<url><loc>https://example.in/jobs/a&amp;b</loc><lastmod>2026-10-20</lastmod></url>');
    expect(xml).toContain('<url><loc>https://example.in/about</loc></url>');
    expect(sitemapIndex(SITE, [{ name: 'sitemap-jobs.xml', lastmod: '2026-10-20' }])).toContain('<loc>https://example.in/sitemap-jobs.xml</loc>');
  });

  it('splits very large sitemaps', () => {
    const urls = Array.from({ length: 100_000 }, (_, i) => ({ path: `/jobs/${i}` }));
    expect(chunkSitemap('sitemap-jobs', urls).map((c) => [c.name, c.urls.length])).toEqual([
      ['sitemap-jobs-1.xml', 45000],
      ['sitemap-jobs-2.xml', 45000],
      ['sitemap-jobs-3.xml', 10000],
    ]);
    expect(chunkSitemap('sitemap-states', urls.slice(0, 36))[0]!.name).toBe('sitemap-states.xml');
  });

  it('points robots.txt at the sitemap and keeps the JSON API out of search', () => {
    const txt = robotsTxt(SITE);
    expect(txt).toContain('Sitemap: https://example.in/sitemap.xml');
    expect(txt).toContain('Disallow: /api/');
  });
});

describe('SEO audit', () => {
  const page = (file: string, title: string, desc: string, extra = '') =>
    readPageSeo(file, `<title>${title}</title><meta name="description" content="${desc}"/><link rel="canonical" href="${SITE}/${file}"/><h1 class="x">T</h1>${extra}`);

  it('reads tags', () => {
    expect(page('a.html', 'A', 'Desc A')).toEqual({ file: 'a.html', title: 'A', description: 'Desc A', canonical: `${SITE}/a.html`, noindex: false, h1Count: 1 });
  });

  it('flags duplicates and missing tags but ignores noindex pages', () => {
    const problems = auditPages([
      page('a.html', 'Same', 'Desc A'),
      page('b.html', 'Same', 'Desc B'),
      readPageSeo('c.html', '<title>C</title>'),
      page('d.html', 'Same', 'Desc A', '<meta name="robots" content="noindex"/>'),
    ]);
    expect(problems).toEqual([
      'c.html: missing meta description',
      'c.html: missing canonical link',
      'c.html: has 0 main headings (should be 1)',
      'b.html: same title as a.html',
    ]);
  });
});

describe('deferAppScripts', () => {
  const html = `<html><head><script defer="" src="/_expo/static/js/web/entry-1.js"></script><script defer="" src="/_expo/static/js/web/page-2.js"></script></head><body><div>x</div><script id="_R_">data</script></body></html>`;

  it('moves app scripts into a loader that runs after first paint, keeping order and inline data', () => {
    const out = deferAppScripts(html);
    expect(out).not.toContain('<script defer');
    expect(out).toContain('<script id="_R_">data</script>');
    expect(out).toContain('var s=["/_expo/static/js/web/entry-1.js","/_expo/static/js/web/page-2.js"]');
    expect(out).toContain("first-contentful-paint");
    expect(out.indexOf('first-contentful-paint')).toBeLessThan(out.indexOf('</body>'));
  });

  it('leaves pages without app scripts unchanged', () => {
    expect(deferAppScripts('<html><body>hi</body></html>')).toBe('<html><body>hi</body></html>');
  });
});
