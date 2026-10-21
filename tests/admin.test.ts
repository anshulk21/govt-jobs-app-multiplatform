import { describe, expect, it } from 'vitest';
import { selectDrafts } from '../scripts/admin/bulk';
import { commitMessageFor, normalizeJob, planJob, publishProblems } from '../scripts/admin/jobs';
import { reviewNotes } from '../scripts/monitor/drafts';

const NOW = '2026-10-21T06:00:00.000Z';

// Roughly what Decap CMS saves: empty strings for blank fields, strings for numbers.
const fromCms = (over: Record<string, unknown> = {}) => ({
  id: 'abc123def0', slug: 'up-police-constable-2026', status: 'draft', title: '  UP Police Constable 2026 ', organization: 'UPPRPB',
  sourceId: 'uppbpb', level: 'state', state: 'UP', category: 'Police', postName: '', vacancies: '12,000', qualifications: ['12th', 'bogus'],
  ageLimit: '', fee: '₹400', dates: { notification: '', applyStart: '2026-10-25T00:00:00.000Z', lastDate: '2026-11-15', exam: '' },
  howToApply: '', links: { notification: 'https://uppbpb.gov.in/a.pdf', official: 'https://uppbpb.gov.in/', apply: '' },
  timeline: [{ stage: 'admit-card', date: '', url: '', note: '' }, { stage: 'nonsense' }],
  foundAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z',
  extraction: { method: 'pdf-regex', fields: ['vacancies'], evidence: { vacancies: 'Total No. of Posts: 12,000' } },
  ...over,
});

describe('normalizeJob', () => {
  const job = normalizeJob(fromCms(), NOW);

  it('turns blank CMS fields into null and fixes types', () => {
    expect(job.title).toBe('UP Police Constable 2026');
    expect(job.postName).toBeNull();
    expect(job.ageLimit).toBeNull();
    expect(job.vacancies).toBe(12000);
    expect(job.dates).toEqual({ notification: null, applyStart: '2026-10-25', lastDate: '2026-11-15', exam: null });
    expect(job.links.apply).toBeNull();
    expect(job.qualifications).toEqual(['12th']);
    expect(job.timeline).toEqual([{ stage: 'admit-card', date: null, url: null }]);
  });

  it('fills bookkeeping for jobs created by hand in the CMS', () => {
    const manual = normalizeJob({ title: 'Bihar Police SI 2026', level: 'state', state: 'BR', category: 'Police', status: 'draft' }, NOW);
    expect(manual.slug).toBe('bihar-police-si-2026');
    expect(manual.id).toMatch(/^[0-9a-f]{10}$/);
    expect(manual.sourceId).toBe('manual');
    expect(manual.foundAt).toBe(NOW);
    expect(manual.extraction.method).toBe('link-only');
  });

  it('clears the state for central jobs and cleans the slug', () => {
    const c = normalizeJob(fromCms({ level: 'central', state: 'UP', slug: 'SSC GD  2026!!' }), NOW);
    expect(c.state).toBeNull();
    expect(c.slug).toBe('ssc-gd-2026');
  });
});

describe('publishing', () => {
  it('moves a valid job to published and stamps it', () => {
    const plan = planJob(fromCms({ status: 'published' }), 'drafts', true, NOW);
    expect(plan.event).toBe('published');
    expect(plan.target).toBe('data/jobs/published/up-police-constable-2026.json');
    expect(plan.job.publishedAt).toBe(NOW);
    expect(plan.job.updatedAt).toBe(NOW);
    expect(plan.job.timeline[0]).toEqual({ stage: 'notification', date: null, url: 'https://uppbpb.gov.in/a.pdf' });
  });

  it('holds back a job with missing essentials and says why', () => {
    const plan = planJob(fromCms({ status: 'published', organization: '', links: { notification: 'see website', official: '' } }), 'drafts', true, NOW);
    expect(plan.event).toBe('held');
    expect(plan.target).toBe('data/jobs/drafts/up-police-constable-2026.json');
    expect(plan.job.status).toBe('draft');
    expect(plan.job.notes).toContain('organisation is missing');
    expect(plan.job.notes).toContain('official notification link');
  });

  it('marks edits to published jobs as updates, and leaves untouched ones alone', () => {
    const published = { ...fromCms({ status: 'published', publishedAt: '2026-10-20T00:00:00.000Z' }) };
    const edited = planJob(published, 'published', true, NOW);
    expect(edited.event).toBe('updated');
    expect(edited.job.updatedAt).toBe(NOW);
    expect(edited.job.publishedAt).toBe('2026-10-20T00:00:00.000Z');
    expect(planJob(published, 'published', false, NOW).event).toBe('unchanged');
  });

  it('rejects and unpublishes', () => {
    expect(planJob(fromCms({ status: 'rejected' }), 'drafts', true, NOW)).toMatchObject({ event: 'rejected', target: 'data/jobs/rejected/up-police-constable-2026.json' });
    expect(planJob(fromCms({ status: 'draft' }), 'published', true, NOW)).toMatchObject({ event: 'unpublished', target: 'data/jobs/drafts/up-police-constable-2026.json' });
  });

  it('requires a state for state jobs', () => {
    expect(publishProblems(normalizeJob(fromCms({ state: '' }), NOW))).toContain('state is required for state/UT jobs');
  });
});

describe('commit messages', () => {
  const p = (status: string, folder: 'drafts' | 'published' | 'rejected') => planJob(fromCms({ status }), folder, true, NOW);
  it('rebuilds the site when something goes live, skips it otherwise', () => {
    expect(commitMessageFor([p('published', 'drafts'), p('rejected', 'drafts')])).toBe('admin: published 1, rejected 1');
    expect(commitMessageFor([p('rejected', 'drafts')])).toBe('[CF-Pages-Skip] admin: rejected 1');
    expect(commitMessageFor([p('draft', 'drafts')])).toBeNull();
  });
});

describe('review notes', () => {
  it('lists each automatic value with its source sentence', () => {
    expect(reviewNotes({ extraction: { method: 'pdf-regex', fields: ['vacancies'], evidence: { vacancies: 'Total No. of Posts: 12,000', 'dates.lastDate': 'Last date: 15.11.2026' } } })).toBe(
      'Read from the PDF automatically. Check each value against the notification:\n• Vacancies: from “Total No. of Posts: 12,000”\n• Last date: from “Last date: 15.11.2026”',
    );
    expect(reviewNotes({ extraction: { method: 'link-only', fields: [], evidence: {} } })).toContain('Only the link was read');
  });
});

describe('bulk selection', () => {
  const d = (slug: string, title: string, sourceId: string, state: string | null, extra = {}) => ({ slug, title, sourceId, state, level: state ? 'state' : 'central', ...extra });
  const drafts = [
    d('a', 'Advertisement for CSLE 2026', 'ar-apssb', 'AR'),
    d('b', 'Annual Exam Calendar', 'ar-apssb', 'AR'),
    d('c', 'IBPS PO Notification', 'ibps', null),
    d('d', 'List of CPIOs', 'ch-admin', 'CH'),
    d('e', 'Sample job', 'ssc', null, { sample: true }),
  ];
  const slugs = (f: Parameters<typeof selectDrafts>[1]) => selectDrafts(drafts, f).map((x) => x.slug);

  it('selects by source, state, title words and limit, never samples', () => {
    expect(slugs({})).toEqual(['a', 'b', 'c', 'd']);
    expect(slugs({ sources: ['AR-APSSB'] })).toEqual(['a', 'b']);
    expect(slugs({ states: ['central'] })).toEqual(['c']);
    expect(slugs({ titleHas: ['advertisement', 'notification'] })).toEqual(['a', 'c']);
    expect(slugs({ titleNot: ['calendar', 'cpio'] })).toEqual(['a', 'c']);
    expect(slugs({ limit: 2 })).toEqual(['a', 'b']);
  });
});
