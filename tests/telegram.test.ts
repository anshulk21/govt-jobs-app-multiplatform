import { describe, expect, it } from 'vitest';
import type { Source } from '../src/core/types';
import { buildSummary, splitMessage } from '../scripts/monitor/telegram';

const src = (id: string, state: string | null, name = id.toUpperCase()): Source => ({
  id, name, url: `https://${id}.gov.in/`, level: state ? 'state' : 'central', state, category: 'PSC',
  linkFilter: ['x'], priority: 'high', enabled: true, verified: true,
});

describe('buildSummary', () => {
  const text = buildSummary({
    header: '🆕 3 new links',
    found: [
      { source: src('tnpsc', 'TN'), links: [{ title: 'Group 4 <2026>', url: 'https://tnpsc.gov.in/a.pdf' }] },
      { source: src('uppsc', 'UP'), links: [{ title: 'PCS 2026', url: 'https://uppsc.gov.in/b.pdf', lastDate: '2026-11-15' }] },
      { source: src('ssc', null), links: [{ title: 'CGL 2026', url: 'https://ssc.gov.in/c.pdf' }] },
    ],
    rebaselined: [],
    attention: [{ source: src('kpsc', 'KA'), reason: 'timeout', runs: 4 }],
  });

  it('lists Central first, then states by name', () => {
    const order = ['Central', 'Tamil Nadu', 'Uttar Pradesh'].map((g) => text.indexOf(`📍 ${g}`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('escapes HTML and shows last dates and attention', () => {
    expect(text).toContain('Group 4 &lt;2026&gt;');
    expect(text).toContain('(last date 2026-11-15)');
    expect(text).toContain('Sources needing attention');
    expect(text).toContain('<code>kpsc</code> KPSC — timeout (4 runs)');
  });
});

describe('splitMessage', () => {
  it('keeps short messages whole', () => {
    expect(splitMessage('a\nb')).toEqual(['a\nb']);
  });

  it('splits at line breaks under the limit', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i} `.padEnd(50, '.'));
    const chunks = splitMessage(lines.join('\n'), 1000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 1000)).toBe(true);
    expect(chunks.join('\n')).toBe(lines.join('\n'));
  });

  it('hard-splits a single line longer than the limit', () => {
    const chunks = splitMessage('x'.repeat(2500), 1000);
    expect(chunks.map((c) => c.length)).toEqual([1000, 1000, 500]);
  });
});
