// Pure logic used by the app and website (no React Native needed).
import { describe, expect, it } from 'vitest';
import { categoryFromSlug, categorySlug } from '../src/core/constants';
import { byUrgency, closingSoon, daysLeft, filterJobs, formatDate, isExpired, matchesPreferences, matchesQuery, newToday, todayIST } from '../src/core/jobs';
import type { JobSummary } from '../src/core/types';
import { translate } from '../src/lib/i18n';
import { buildIcs, reminderTimes } from '../src/lib/reminder-times';
import { ageOn, checkEligibility, parseIndianDate } from '../src/lib/tools/age';
import { cgpaToPercent } from '../src/lib/tools/cgpa';
import { buildPdf, jpegSize } from '../src/lib/tools/pdf';

const job = (over: Partial<JobSummary>): JobSummary => ({
  slug: 'x', title: 'UP Police Constable 2026', organization: 'UPPRPB', level: 'state', state: 'UP', category: 'Police',
  qualifications: ['12th'], vacancies: 100, lastDate: '2026-11-15', stage: 'apply',
  publishedAt: '2026-10-20T04:00:00Z', updatedAt: '2026-10-20T04:00:00Z', ...over,
});
const TODAY = '2026-10-20';

describe('dates', () => {
  it('uses India time for "today"', () => {
    expect(todayIST(new Date('2026-10-19T19:00:00Z'))).toBe('2026-10-20'); // 00:30 IST
    expect(todayIST(new Date('2026-10-19T18:00:00Z'))).toBe('2026-10-19'); // 23:30 IST
  });
  it('counts days left and expiry', () => {
    expect(daysLeft('2026-10-20', TODAY)).toBe(0);
    expect(daysLeft('2026-10-25', TODAY)).toBe(5);
    expect(daysLeft(null, TODAY)).toBeNull();
    expect(isExpired(job({ lastDate: '2026-10-19' }), TODAY)).toBe(true);
    expect(isExpired(job({ lastDate: null }), TODAY)).toBe(false);
  });
  it('formats dates', () => {
    expect(formatDate('2026-11-05')).toBe('5 Nov 2026');
    expect(formatDate(null)).toBeNull();
  });
});

describe('job lists', () => {
  const jobs = [
    job({ slug: 'a', lastDate: '2026-10-22' }),
    job({ slug: 'b', lastDate: '2026-12-01', publishedAt: '2026-10-19T20:00:00Z' }),
    job({ slug: 'c', lastDate: '2026-10-01' }),
    job({ slug: 'd', lastDate: null, level: 'central', state: null, category: 'SSC', qualifications: ['10th'] }),
  ];
  it('closing soon = open and within 7 days, soonest first', () => {
    expect(closingSoon(jobs, TODAY).map((j) => j.slug)).toEqual(['a']);
  });
  it('new today uses the IST date of publishing', () => {
    expect(newToday(jobs, TODAY).map((j) => j.slug).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
  it('sorts open jobs by deadline, unknown dates next, expired last', () => {
    expect([...jobs].sort(byUrgency(TODAY)).map((j) => j.slug)).toEqual(['a', 'b', 'd', 'c']);
  });
  it('filters by level, state, category, qualification, closing and text', () => {
    expect(filterJobs(jobs, { level: 'central' }, TODAY).map((j) => j.slug)).toEqual(['d']);
    expect(filterJobs(jobs, { state: 'UP' }, TODAY).map((j) => j.slug)).toEqual(['a', 'b']);
    expect(filterJobs(jobs, { state: 'UP', includeExpired: true }, TODAY)).toHaveLength(3);
    expect(filterJobs(jobs, { qualification: '10th' }, TODAY).map((j) => j.slug)).toEqual(['d']);
    expect(filterJobs(jobs, { closingWithinDays: 7 }, TODAY).map((j) => j.slug)).toEqual(['a']);
    expect(filterJobs(jobs, { query: 'ssc' }, TODAY).map((j) => j.slug)).toEqual(['d']);
  });
  it('search matches every word against title, organisation and state name', () => {
    expect(matchesQuery(job({}), 'uttar pradesh police')).toBe(true);
    expect(matchesQuery(job({}), 'police bihar')).toBe(false);
    expect(matchesQuery(job({ state: null, level: 'central' }), 'all india')).toBe(true);
  });
});

describe('"For you" matching', () => {
  const prefs = { states: ['UP'], central: true, categories: [], qualifications: ['12th' as const] };
  it('matches state or central jobs for the user', () => {
    expect(matchesPreferences(job({}), prefs)).toBe(true);
    expect(matchesPreferences(job({ state: 'BR' }), prefs)).toBe(false);
    expect(matchesPreferences(job({ level: 'central', state: null }), prefs)).toBe(true);
    expect(matchesPreferences(job({ level: 'central', state: null }), { ...prefs, central: false })).toBe(false);
  });
  it('respects categories and qualifications, keeping jobs with unknown qualification', () => {
    expect(matchesPreferences(job({}), { ...prefs, categories: ['Teaching'] })).toBe(false);
    expect(matchesPreferences(job({ qualifications: ['graduate'] }), prefs)).toBe(false);
    expect(matchesPreferences(job({ qualifications: [] }), prefs)).toBe(true);
  });
});

describe('category slugs', () => {
  it('round-trips', () => {
    expect(categorySlug('High Court')).toBe('high-court');
    expect(categoryFromSlug('subordinate-services')).toBe('Subordinate Services');
    expect(categoryFromSlug('nope')).toBeUndefined();
  });
});

describe('i18n', () => {
  it('translates, fills placeholders and falls back to English', () => {
    expect(translate('hi', 'tab.home')).toBe('होम');
    expect(translate('hi', 'job.daysLeft', { n: 5 })).toBe('5 days left');
    expect(translate('en', 'filter.results', { n: 3 })).toBe('3 jobs');
  });
});

describe('reminders', () => {
  it('schedules 9 AM IST on 3 days before, 1 day before and the last date, future only', () => {
    const times = reminderTimes('2026-11-15', new Date('2026-11-13T00:00:00Z'));
    expect(times.map((t) => [t.daysBefore, t.date.toISOString()])).toEqual([
      [1, '2026-11-14T03:30:00.000Z'],
      [0, '2026-11-15T03:30:00.000Z'],
    ]);
    expect(reminderTimes('2026-10-01', new Date('2026-10-20T00:00:00Z'))).toEqual([]);
  });
  it('builds a calendar file with alarms', () => {
    const ics = buildIcs({ uid: 'x@y', title: 'SSC GD, 2026', lastDate: '2026-11-25', url: 'https://x.in/jobs/x', now: new Date('2026-10-20T00:00:00Z') });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261125');
    expect(ics).toContain('DTEND;VALUE=DATE:20261126');
    expect(ics).toContain('SUMMARY:Last date: SSC GD\\, 2026');
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
  });
});

describe('age tools', () => {
  it('calculates exact age', () => {
    expect(ageOn('2000-01-15', '2026-01-01')).toEqual({ years: 25, months: 11, days: 17 });
    expect(ageOn('2000-03-31', '2026-04-30')).toEqual({ years: 26, months: 0, days: 30 });
    // Born on 29 Feb: in non-leap years the birthday is counted on 1 March.
    expect(ageOn('2004-02-29', '2026-03-01')).toEqual({ years: 22, months: 0, days: 0 });
    expect(ageOn('2026-01-02', '2026-01-01')).toBeNull();
  });
  it('parses dd/mm/yyyy', () => {
    expect(parseIndianDate('05/08/2001')).toBe('2001-08-05');
    expect(parseIndianDate('5-8-2001')).toBe('2001-08-05');
    expect(parseIndianDate('31/02/2001')).toBeNull();
  });
  it('counts completed years: 25y 11m is still within "18–25"', () => {
    const base = { cutoff: '2026-01-01', minAge: 18, maxAge: 25, relaxationYears: 0 };
    expect(checkEligibility({ ...base, dob: '2000-01-15' })!.eligible).toBe(true); // 25y 11m
    expect(checkEligibility({ ...base, dob: '2000-01-01' })!.reason).toBe('too-old'); // exactly 26
    expect(checkEligibility({ ...base, dob: '2008-01-02' })!.reason).toBe('too-young'); // 17y 11m
    expect(checkEligibility({ ...base, dob: '1997-06-01', relaxationYears: 3 })!.eligible).toBe(true); // 28y with OBC
  });
});

describe('CGPA', () => {
  it('converts with the chosen formula', () => {
    expect(cgpaToPercent(8.4, 'cbse')).toBe(79.8);
    expect(cgpaToPercent(8.4, 'minus075')).toBe(76.5);
    expect(cgpaToPercent(3.2, 'scale4')).toBe(80);
    expect(cgpaToPercent(8, 'custom', 9.25)).toBe(74);
  });
  it('rejects out-of-range input', () => {
    expect(cgpaToPercent(11, 'cbse')).toBeNull();
    expect(cgpaToPercent(5, 'scale4')).toBeNull();
    expect(cgpaToPercent(8, 'custom')).toBeNull();
  });
});

describe('images to PDF', () => {
  // Minimal JPEG header: SOI, APP0 segment, SOF0 with 40x30.
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x1e, 0x00, 0x28, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xd9]);
  it('reads JPEG dimensions', () => {
    expect(jpegSize(jpeg)).toEqual({ width: 40, height: 30 });
    expect(jpegSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
  it('builds a PDF with one page per image and a valid xref', () => {
    const pdf = buildPdf([{ bytes: jpeg, width: 40, height: 30 }, { bytes: jpeg, width: 40, height: 30 }]);
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text.match(/\/Subtype \/Image/g)).toHaveLength(2);
    const xrefAt = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const firstObj = Number(text.match(/xref\n0 \d+\n0000000000 65535 f \n(\d{10})/)![1]);
    expect(text.slice(firstObj, firstObj + 7)).toBe('1 0 obj');
  });
});
