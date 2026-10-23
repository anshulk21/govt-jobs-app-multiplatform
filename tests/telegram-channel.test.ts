import { describe, expect, it } from 'vitest';
import { channelPost, postableEvents } from '../scripts/push/telegram-channel';
import type { Job } from '../src/core/types';

const job = (over: Partial<Job> = {}): Job =>
  ({
    id: 'a1',
    slug: 'up-police-constable-a1',
    status: 'published',
    title: 'UP Police Constable <2026>',
    organization: 'UPPRPB',
    sourceId: 'uppbpb',
    level: 'state',
    state: 'UP',
    category: 'Police',
    postName: null,
    vacancies: 12000,
    qualifications: ['12th'],
    ageLimit: '18–25 years',
    fee: null,
    dates: { notification: null, applyStart: null, lastDate: '2026-11-15', exam: null },
    howToApply: null,
    links: { notification: 'https://x.in/n.pdf', official: 'https://x.in', apply: null },
    timeline: [],
    foundAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
    extraction: { method: 'pdf-regex', fields: [], evidence: {} },
    review: '',
    ...over,
  }) as Job;

describe('Telegram channel posts', () => {
  it('shows the key facts and links to the job page, with text escaped', () => {
    const post = channelPost({ kind: 'new', job: job(), stages: [] });
    expect(post).toContain('<b>UP Police Constable &lt;2026&gt;</b>');
    expect(post).toContain('📍 Uttar Pradesh');
    expect(post).toContain('👥 Posts: 12,000');
    expect(post).toContain('⏳ Last date: <b>15 Nov 2026</b>');
    expect(post).toContain('/jobs/up-police-constable-a1"');
  });

  it('leaves out facts it does not have', () => {
    const post = channelPost({ kind: 'new', job: job({ vacancies: null, ageLimit: null, qualifications: [], dates: { notification: null, applyStart: null, lastDate: null, exam: null } }), stages: [] });
    expect(post).not.toMatch(/Posts|Age|Qualification|Last date/);
  });

  it('announces admit cards and results', () => {
    expect(channelPost({ kind: 'update', job: job(), stages: ['admit-card'] })).toMatch(/^<b>🎫 Admit card released<\/b>/);
  });

  it('skips quiet and expired jobs but keeps updates', () => {
    const events = [
      { kind: 'new' as const, job: job({ quiet: true }), stages: [] },
      { kind: 'new' as const, job: job({ dates: { notification: null, applyStart: null, lastDate: '2026-10-01', exam: null } }), stages: [] },
      { kind: 'new' as const, job: job(), stages: [] },
      { kind: 'update' as const, job: job({ dates: { notification: null, applyStart: null, lastDate: '2026-10-01', exam: null } }), stages: ['result'] },
    ];
    expect(postableEvents(events, '2026-10-23').map((e) => e.kind)).toEqual(['new', 'update']);
  });
});
