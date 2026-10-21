import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findNewLinks, loadSeen, markSeen, saveSeen } from '../scripts/monitor/seen';

const a = { url: 'https://ssc.gov.in/a.pdf', text: 'A' };
const b = { url: 'https://ssc.gov.in/b.pdf', text: 'B' };

describe('new-link comparison', () => {
  it('treats every link as new when there is no seen file', () => {
    expect(findNewLinks([a, b], null)).toEqual([a, b]);
  });

  it('returns only links not seen before', () => {
    const seen = markSeen(null, 'ssc', [a], '2026-10-01T00:00:00Z');
    expect(findNewLinks([a, b], seen)).toEqual([b]);
  });

  it('ignores http/https and www differences', () => {
    const seen = markSeen(null, 'ssc', [a], '2026-10-01T00:00:00Z');
    expect(findNewLinks([{ url: 'http://www.ssc.gov.in/a.pdf', text: 'A' }], seen)).toEqual([]);
  });

  it('counts a link repeated on the page once', () => {
    expect(findNewLinks([b, { ...b, text: 'B again' }], null)).toHaveLength(1);
  });

  it('keeps the first-seen time and baseline date when marking again', () => {
    const first = markSeen(null, 'ssc', [a], '2026-10-01T00:00:00Z');
    const second = markSeen(first, 'ssc', [a, b], '2026-10-02T00:00:00Z');
    expect(second.baselinedAt).toBe('2026-10-01T00:00:00Z');
    expect(second.links['ssc.gov.in/a.pdf']).toBe('2026-10-01T00:00:00Z');
    expect(second.links['ssc.gov.in/b.pdf']).toBe('2026-10-02T00:00:00Z');
    expect(first.links['ssc.gov.in/b.pdf']).toBeUndefined(); // not mutated
  });

  it('round-trips through the seen-links file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seen-'));
    expect(loadSeen(dir, 'ssc')).toBeNull();
    saveSeen(dir, markSeen(null, 'ssc', [b, a], '2026-10-01T00:00:00Z'));
    const loaded = loadSeen(dir, 'ssc')!;
    expect(Object.keys(loaded.links)).toEqual(['ssc.gov.in/a.pdf', 'ssc.gov.in/b.pdf']);
  });
});
