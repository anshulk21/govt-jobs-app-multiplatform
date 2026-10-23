import { describe, expect, it } from 'vitest';
import { extractDetails } from '../scripts/monitor/extract';
import { htmlToText, looksLikeListing, mergeExtracted, pickNoticePdf } from '../scripts/monitor/notice';
import { fillMissing, MAX_TRIES, needsDetails } from '../scripts/monitor/enrich';
import type { Job } from '../src/core/types';

describe('notice pages', () => {
  it('keeps the main text, one line per block, without menus and scripts', () => {
    const html = `<html><body><nav>Home | About</nav><script>var x=1</script>
      <h1>Recruitment of Clerks</h1><p>Last date: 15.11.2026</p><table><tr><td>Posts</td><td>120</td></tr></table>
      <footer>© Govt</footer></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain('Recruitment of Clerks\nLast date: 15.11.2026');
    expect(text).toContain('Posts | 120');
    expect(text).not.toMatch(/Home|var x|© Govt/);
  });

  it('spots a page listing several notices (their last dates differ)', () => {
    expect(looksLikeListing('A (Last Date: 13.11.2026)\nB (Last Date: 30.11.2026)')).toBe(true);
    expect(looksLikeListing('Last date: 15.11.2026\nreminder: last date 15.11.2026')).toBe(false);
  });

  it('picks the notification PDF that matches the title, English over Hindi, even without .pdf in the URL', () => {
    const links = [
      { url: 'https://x.in/docs/brochure.pdf', text: 'Workshop brochure' },
      { url: 'https://x.in/d/notification-hi', text: 'Download Hindi Version (.pdf - 1.1 MB)' },
      { url: 'https://x.in/d/notification-en', text: 'Download English Version (.pdf - 965 KB)' },
      { url: 'https://x.in/about', text: 'About us' },
    ];
    expect(pickNoticePdf(links, 'Engagement of Graduate Apprentices')).toBe('https://x.in/d/notification-en');
    expect(pickNoticePdf([{ url: 'https://x.in/about', text: 'About' }], 'Clerk')).toBeNull();
  });

  it('merges page details into PDF details without overriding the PDF', () => {
    const pdf = extractDetails('Last date: 15.11.2026', '2026-10-20');
    const page = extractDetails('Last date: 20.11.2026\nTotal posts: 45', '2026-10-20');
    const m = mergeExtracted(pdf, page);
    expect(m.dates.lastDate).toBe('2026-11-15');
    expect(m.vacancies).toBe(45);
    expect(Object.keys(m.evidence).sort()).toEqual(['dates.lastDate', 'vacancies']);
  });
});

const job = (over: Partial<Job> = {}): Job =>
  ({
    id: 'a1',
    slug: 'x-a1',
    status: 'published',
    title: 'Clerk recruitment',
    organization: 'X',
    sourceId: 'x',
    level: 'central',
    state: null,
    category: 'SSC',
    postName: null,
    vacancies: null,
    qualifications: [],
    ageLimit: null,
    fee: null,
    dates: { notification: null, applyStart: null, lastDate: null, exam: null },
    howToApply: null,
    links: { notification: 'https://x.in/n', official: 'https://x.in', apply: null },
    timeline: [],
    foundAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
    extraction: { method: 'link-only', fields: [], evidence: {} },
    review: '',
    ...over,
  }) as Job;

describe('enrich', () => {
  const now = new Date('2026-10-23T00:00:00Z');

  it('only retries recent jobs with nothing read yet, a web link, and tries left', () => {
    expect(needsDetails(job(), now)).toBe(true);
    expect(needsDetails(job({ extraction: { method: 'pdf-regex', fields: ['vacancies'], evidence: {} } }), now)).toBe(false);
    expect(needsDetails(job({ extraction: { method: 'link-only', fields: [], evidence: {}, tries: MAX_TRIES } }), now)).toBe(false);
    expect(needsDetails(job({ foundAt: '2026-06-01T00:00:00.000Z' }), now)).toBe(false);
    expect(needsDetails(job({ links: { notification: 'javascript:x', official: '', apply: null } }), now)).toBe(false);
  });

  it('fills only empty fields and never overwrites what the admin typed', () => {
    const typed = job({ vacancies: 10, dates: { notification: null, applyStart: null, lastDate: null, exam: null } });
    const found = extractDetails('Total posts: 45\nLast date: 15.11.2026', '2026-10-20');
    const next = fillMissing(typed, found, 'page-regex', '2026-10-23T00:00:00.000Z')!;
    expect(next.vacancies).toBe(10);
    expect(next.dates.lastDate).toBe('2026-11-15');
    expect(next.extraction).toMatchObject({ method: 'page-regex', fields: ['dates.lastDate'] });
    expect(next.updatedAt).toBe('2026-10-23T00:00:00.000Z');
  });

  it('reports nothing new when every found value is already set', () => {
    const full = job({ vacancies: 10 });
    expect(fillMissing(full, extractDetails('Total posts: 45', '2026-10-20'), 'page-regex', 'now')).toBeNull();
  });
});
