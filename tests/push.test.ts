import { describe, expect, it } from 'vitest';
import { CATEGORIES, QUALIFICATIONS, type Category, type QualificationId } from '../src/core/constants';
import { matchesPreferences, type Preferences } from '../src/core/jobs';
import {
  conditionsForJob, evaluateCondition, lastDaysPush, newJobPush, newStages, stageUpdatePush, topicCount, topicsForPreferences,
} from '../src/core/push';
import type { Job, JobSummary } from '../src/core/types';

const prefs = (p: Partial<Preferences> = {}): Preferences => ({ states: [], central: false, categories: [], qualifications: [], ...p });
const summary = (j: Partial<JobSummary> = {}): JobSummary => ({
  slug: 's', title: 'T', organization: 'O', level: 'state', state: 'UP', category: 'Police', qualifications: ['12th'],
  vacancies: null, lastDate: null, applyStart: null, examDate: null, age: { min: null, max: null, asOn: null }, stage: 'notification', publishedAt: '', updatedAt: '', ...j,
});
const receives = (job: JobSummary, p: Preferences) => {
  const topics = new Set(topicsForPreferences(p));
  return conditionsForJob(job).some((c) => evaluateCondition(c, topics));
};

describe('push topic subscriptions', () => {
  it('maps preferences to topics', () => {
    expect(topicsForPreferences(prefs({ central: true, states: ['UP', 'BR'], categories: ['Police', 'High Court'], qualifications: ['12th'] }), ['abc'], true)).toEqual(
      ['all', 'cat_high-court', 'cat_police', 'central', 'job_abc', 'pro', 'qual_12th', 'state_BR', 'state_UP'],
    );
  });

  it('subscribes to every category/qualification when none is chosen', () => {
    const t = topicsForPreferences(prefs({ states: ['TN'] }));
    expect(t.filter((x) => x.startsWith('cat_'))).toHaveLength(CATEGORIES.length);
    expect(t.filter((x) => x.startsWith('qual_'))).toHaveLength(QUALIFICATIONS.length);
    expect(t).not.toContain('pro');
  });

  it('produces valid FCM topic names', () => {
    const all = topicsForPreferences(prefs({ central: true, states: ['UP'], categories: [...CATEGORIES], qualifications: QUALIFICATIONS.map((q) => q.id) }), ['0a1b2c3d4e']);
    for (const t of all) expect(t).toMatch(/^[a-zA-Z0-9-_.~%]+$/);
  });
});

describe('push topic matching', () => {
  it('reaches a matching user', () => {
    expect(receives(summary(), prefs({ states: ['UP'], qualifications: ['12th'] }))).toBe(true);
    expect(receives(summary({ level: 'central', state: null }), prefs({ central: true }))).toBe(true);
  });

  it('does not reach users from other states, categories or qualifications', () => {
    expect(receives(summary(), prefs({ states: ['BR'] }))).toBe(false);
    expect(receives(summary(), prefs({ states: ['UP'], categories: ['Teaching'] }))).toBe(false);
    expect(receives(summary(), prefs({ states: ['UP'], qualifications: ['graduate'] }))).toBe(false);
    expect(receives(summary({ level: 'central', state: null }), prefs({ states: ['UP'] }))).toBe(false);
  });

  it('reaches everyone in the place when the job lists no qualification', () => {
    expect(receives(summary({ qualifications: [] }), prefs({ states: ['UP'], qualifications: ['graduate'] }))).toBe(true);
  });

  it('never exceeds FCM’s 5-topic limit per condition', () => {
    const job = summary({ qualifications: QUALIFICATIONS.map((q) => q.id) });
    for (const audience of ['everyone', 'pro', 'free'] as const) {
      const conditions = conditionsForJob(job, audience);
      expect(conditions).toHaveLength(QUALIFICATIONS.length);
      for (const c of conditions) expect(topicCount(c)).toBeLessThanOrEqual(5);
    }
  });

  it('splits Pro (instant) and free (delayed) audiences without overlap', () => {
    const job = summary();
    const p = prefs({ states: ['UP'] });
    const reach = (audience: 'pro' | 'free', isPro: boolean) =>
      conditionsForJob(job, audience).some((c) => evaluateCondition(c, new Set(topicsForPreferences(p, [], isPro))));
    expect(reach('pro', true)).toBe(true);
    expect(reach('free', true)).toBe(false);
    expect(reach('pro', false)).toBe(false);
    expect(reach('free', false)).toBe(true);
  });

  it('agrees with the in-app "For you" rule for every combination tried', () => {
    // Deterministic pseudo-random combinations of users and jobs.
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = <T,>(xs: readonly T[], n: number) => [...xs].sort(() => rnd() - 0.5).slice(0, n);
    const states = ['UP', 'BR', 'TN', 'DL'];
    for (let n = 0; n < 2000; n++) {
      const p = prefs({
        central: rnd() < 0.5,
        states: pick(states, Math.floor(rnd() * 3)),
        categories: pick(CATEGORIES, Math.floor(rnd() * 3)) as Category[],
        qualifications: pick(QUALIFICATIONS.map((q) => q.id), Math.floor(rnd() * 3)) as QualificationId[],
      });
      const central = rnd() < 0.3;
      const job = summary({
        level: central ? 'central' : 'state',
        state: central ? null : pick(states, 1)[0]!,
        category: pick(CATEGORIES, 1)[0]!,
        qualifications: pick(QUALIFICATIONS.map((q) => q.id), Math.floor(rnd() * 3)) as QualificationId[],
      });
      expect(receives(job, p), JSON.stringify({ p, job })).toBe(matchesPreferences(job, p));
    }
  });
});

describe('evaluateCondition', () => {
  it('handles &&, ||, ! and parentheses', () => {
    const t = new Set(['a', 'c']);
    expect(evaluateCondition("'a' in topics && ('b' in topics || 'c' in topics)", t)).toBe(true);
    expect(evaluateCondition("'a' in topics && 'b' in topics", t)).toBe(false);
    expect(evaluateCondition("!('b' in topics) && 'a' in topics", t)).toBe(true);
  });
});

const job: Job = {
  id: 'abc123def0', slug: 'up-police-constable-2026', status: 'published', title: 'UP Police Constable 2026', organization: 'UPPRPB',
  sourceId: 'uppbpb', level: 'state', state: 'UP', category: 'Police', postName: null, vacancies: 12000, qualifications: ['12th'],
  ageLimit: null, fee: null, dates: { notification: null, applyStart: null, lastDate: '2026-11-15', exam: null }, howToApply: null,
  links: { notification: 'https://x.gov.in/a.pdf', official: 'https://x.gov.in/', apply: null },
  timeline: [{ stage: 'notification', date: '2026-10-01', url: null }], foundAt: '', updatedAt: '', extraction: { method: 'link-only', fields: [], evidence: {} },
};

describe('notification text', () => {
  it('announces new jobs like the spec', () => {
    expect(newJobPush(job)).toEqual({
      title: 'New: UP Police Constable 2026',
      body: '12,000 posts. Last date 15 Nov.',
      url: '/jobs/up-police-constable-2026',
      collapseKey: 'abc123def0',
    });
    expect(newJobPush({ ...job, vacancies: null, dates: { ...job.dates, lastDate: null } }).body).toBe('UPPRPB. Tap for details.');
  });

  it('reminds about the last days and stage updates', () => {
    expect(lastDaysPush(job, 3).title).toBe('Last 3 days to apply');
    expect(lastDaysPush(job, 3).body).toBe('UP Police Constable 2026 — last date 15 Nov.');
    expect(stageUpdatePush(job, 'admit-card').title).toBe('Admit card released');
    expect(stageUpdatePush(job, 'result').title).toBe('Result declared');
  });

  it('finds newly added stages worth announcing', () => {
    const after: Job = { ...job, timeline: [...job.timeline, { stage: 'apply', date: null, url: null }, { stage: 'admit-card', date: '2026-12-01', url: null }] };
    expect(newStages(job, after)).toEqual(['admit-card']);
    expect(newStages(after, after)).toEqual([]);
    expect(newStages(null, after)).toEqual(['admit-card']);
  });
});
