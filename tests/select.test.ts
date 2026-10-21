import { describe, expect, it } from 'vitest';
import type { Source } from '../src/core/types';
import { selectSources } from '../scripts/monitor/select';

const s = (id: string, priority: 'high' | 'normal', extra: Partial<Source> = {}): Source => ({
  id, name: id, url: `https://${id}.gov.in/`, level: 'central', state: null, category: 'SSC',
  linkFilter: ['x'], priority, enabled: true, verified: true, ...extra,
});
const sources = [s('hi', 'high'), s('lo', 'normal'), s('off', 'high', { enabled: false }), s('up', 'normal', { level: 'state', state: 'UP' })];
const ids = (list: Source[]) => list.map((x) => x.id);

describe('selectSources', () => {
  it('runs high priority every run and normal on even runs', () => {
    expect(ids(selectSources(sources, { runNumber: 1 }))).toEqual(['hi']);
    expect(ids(selectSources(sources, { runNumber: 2 }))).toEqual(['hi', 'lo', 'up']);
  });

  it('never runs disabled sources', () => {
    expect(ids(selectSources(sources, { runNumber: 1, all: true }))).not.toContain('off');
  });

  it('supports --only and --state', () => {
    expect(ids(selectSources(sources, { runNumber: 1, only: new Set(['lo']) }))).toEqual(['lo']);
    expect(ids(selectSources(sources, { runNumber: 2, state: 'UP' }))).toEqual(['up']);
    expect(ids(selectSources(sources, { runNumber: 2, state: 'CENTRAL' }))).toEqual(['hi', 'lo']);
  });

  it('can pick only sources failing on GitHub', () => {
    const failingIn = { runCount: 5, sources: { lo: { consecutiveFailures: 2, emptyRuns: 0, lastCheckedAt: '' }, hi: { consecutiveFailures: 0, emptyRuns: 0, lastCheckedAt: '' } } };
    expect(ids(selectSources(sources, { runNumber: 1, failingIn }))).toEqual(['lo']);
  });
});
