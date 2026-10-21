import { describe, expect, it } from 'vitest';
import { calendarByMonth } from '../src/core/calendar';
import { jobSummaryHtml } from '../src/core/job-summary';
import { adPositions, canShowInterstitial } from '../src/lib/ad-rules';
import { eligibilityFor, parseAgeLimit } from '../src/core/eligibility';
import { booksFor, sponsoredFor } from '../src/core/monetization';
import { dailyQuestions, score } from '../src/core/quiz';
import type { Book, JobSummary, SponsoredCard } from '../src/core/types';

const job = (o: Partial<JobSummary> = {}): JobSummary => ({
  slug: 's', title: 'SSC GD Constable 2026', organization: 'SSC', level: 'central', state: null, category: 'SSC', qualifications: ['10th'],
  vacancies: null, lastDate: '2026-11-25', applyStart: '2026-10-15', examDate: '2027-02-10', age: { min: 18, max: 23, asOn: '2027-01-01' },
  stage: 'apply', publishedAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', ...o,
});

describe('age limit parsing', () => {
  it('reads common formats', () => {
    expect(parseAgeLimit('18–23 years')).toEqual({ min: 18, max: 23 });
    expect(parseAgeLimit('21 to 40 yrs (relaxation as per rules)')).toEqual({ min: 21, max: 40 });
    expect(parseAgeLimit('Up to 30 years')).toEqual({ min: null, max: 30 });
    expect(parseAgeLimit('See notification')).toEqual({ min: null, max: null });
    expect(parseAgeLimit(null)).toEqual({ min: null, max: null });
  });
});

describe('"Eligible for me"', () => {
  const me = { dob: '2005-06-01', reservation: 'gen' as const, qualifications: ['12th' as const, '10th' as const] };
  it('says yes when age and qualification fit', () => {
    expect(eligibilityFor(job(), me, '2026-10-21')).toBe('yes'); // 21y 7m on 1 Jan 2027
  });
  it('says no for over-age, applying category relaxation', () => {
    const older = { ...me, dob: '2000-06-01' }; // 26y on cutoff
    expect(eligibilityFor(job(), older, '2026-10-21')).toBe('no');
    expect(eligibilityFor(job(), { ...older, reservation: 'obc' }, '2026-10-21')).toBe('yes'); // 23 + 3
  });
  it('says no when the qualification clearly does not match', () => {
    expect(eligibilityFor(job({ qualifications: ['graduate'] }), me, '2026-10-21')).toBe('no');
  });
  it('says "check" when it cannot know', () => {
    expect(eligibilityFor(job({ age: { min: null, max: null, asOn: null } }), me, '2026-10-21')).toBe('check');
    expect(eligibilityFor(job(), { ...me, dob: null }, '2026-10-21')).toBe('check');
  });
});

describe('exam calendar', () => {
  it('lists upcoming dates by month, soonest first, skipping past ones', () => {
    const months = calendarByMonth([job(), job({ slug: 't', title: 'B job', applyStart: '2026-10-01', lastDate: '2026-12-05', examDate: null })], '2026-10-21');
    expect(months.map((m) => [m.month, m.events.map((e) => `${e.date} ${e.kind}`)])).toEqual([
      ['Nov 2026', ['2026-11-25 last-date']],
      ['Dec 2026', ['2026-12-05 last-date']],
      ['Feb 2027', ['2027-02-10 exam']],
    ]);
  });
});

describe('daily quiz', () => {
  const qs = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, q: `Q${i}`, options: ['a', 'b'], answer: i % 2 }));
  it('is the same for everyone on a day and changes the next day', () => {
    const today = dailyQuestions(qs, '2026-10-21', 10).map((q) => q.id);
    expect(dailyQuestions(qs, '2026-10-21', 10).map((q) => q.id)).toEqual(today);
    expect(dailyQuestions(qs, '2026-10-22', 10).map((q) => q.id)).not.toEqual(today);
    expect(new Set(today).size).toBe(10);
  });
  it('scores answers', () => {
    expect(score(qs.slice(0, 3), [0, 0, null])).toEqual({ correct: 1, total: 3 });
  });
});

describe('sponsored cards and books', () => {
  const card = (o: Partial<SponsoredCard>): SponsoredCard => ({ id: 'c', title: 'T', text: 'x', url: 'https://x.in', active: true, ...o });
  it('targets by category, state and dates', () => {
    const cards = [
      card({ id: 'all' }),
      card({ id: 'police-up', categories: ['Police'], states: ['UP'] }),
      card({ id: 'expired', endDate: '2026-10-01' }),
      card({ id: 'off', active: false }),
      card({ id: 'future', startDate: '2026-12-01' }),
    ];
    expect(sponsoredFor(cards, { category: 'Police', state: 'UP' }, '2026-10-21').map((c) => c.id)).toEqual(['all', 'police-up']);
    expect(sponsoredFor(cards, { category: 'Bank', state: 'UP' }, '2026-10-21').map((c) => c.id)).toEqual(['all']);
  });
  it('picks keyword-matching books first, then same category', () => {
    const b = (id: string, o: Partial<Book>): Book => ({ id, title: id, url: 'https://amzn.to/x', store: 'Amazon', active: true, ...o });
    const books = [b('cat', { categories: ['SSC'] }), b('kw', { keywords: ['GD Constable'] }), b('other', { categories: ['Bank'] }), b('off', { active: false, keywords: ['SSC'] })];
    expect(booksFor(books, { title: 'SSC GD Constable 2026', category: 'SSC' }).map((x) => x.id)).toEqual(['kw', 'cat']);
  });
});

describe('job PDF summary', () => {
  it('includes the details, escapes text and says "See official notification" for blanks', () => {
    const html = jobSummaryHtml(
      {
        id: 'x', slug: 'ssc-gd', status: 'published', title: 'SSC GD <2026>', organization: 'SSC', sourceId: 'ssc', level: 'central', state: null,
        category: 'SSC', postName: null, vacancies: 12000, qualifications: ['10th'], ageLimit: '18–23 years', fee: null,
        dates: { notification: null, applyStart: null, lastDate: '2026-11-25', exam: null }, howToApply: null,
        links: { notification: 'https://ssc.gov.in/a.pdf', official: 'https://ssc.gov.in/', apply: null },
        timeline: [{ stage: 'notification', date: '2026-10-15', url: null }], foundAt: '', updatedAt: '', extraction: { method: 'link-only', fields: [], evidence: {} },
      },
      'https://example.in',
      'Govt Jobs Finder',
    );
    expect(html).toContain('<h1>SSC GD &lt;2026&gt;</h1>');
    expect(html).toContain('<tr><th>Vacancies</th><td>12,000</td></tr>');
    expect(html).toContain('<tr><th>Last date</th><td>25 Nov 2026</td></tr>');
    expect(html).toContain('<tr><th>Application fee</th><td>See official notification</td></tr>');
    expect(html).toContain('Not a government website');
  });
});

describe('ad rules', () => {
  const cfg = { graceSeconds: 90, minMinutes: 4 };
  it('never shows right after launch and caps frequency', () => {
    const launch = 1_000_000;
    expect(canShowInterstitial(launch + 30_000, launch, null, cfg)).toBe(false);
    expect(canShowInterstitial(launch + 120_000, launch, null, cfg)).toBe(true);
    expect(canShowInterstitial(launch + 300_000, launch, launch + 120_000, cfg)).toBe(false);
    expect(canShowInterstitial(launch + 400_000, launch, launch + 120_000, cfg)).toBe(true);
  });
  it('places list ads every N jobs, never last', () => {
    expect(adPositions(20, 7)).toEqual([6, 13]);
    expect(adPositions(7, 7)).toEqual([]);
    expect(adPositions(3, 7)).toEqual([]);
  });
});
