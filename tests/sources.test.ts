import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Source } from '../src/core/types';
import { SOURCES_DIR, STATE_SOURCES_DIR } from '../scripts/lib/paths';
import { isGovDomain, loadSourceFiles, validateSourceFiles, type LoadedSourceFile } from '../scripts/lib/sources';

const base: Source = {
  id: 'uppsc',
  name: 'UPPSC',
  url: 'https://uppsc.up.nic.in/',
  level: 'state',
  state: 'UP',
  category: 'PSC',
  linkFilter: ['notice'],
  priority: 'high',
  enabled: true,
  verified: false,
};

const upFile = (...sources: Partial<Source>[]): LoadedSourceFile => ({
  file: path.join(STATE_SOURCES_DIR, 'up.json'),
  data: { level: 'state', state: 'UP', name: 'Uttar Pradesh', sources: sources.map((s) => ({ ...base, ...s })) },
});

describe('repository source files', () => {
  it('are all valid', () => {
    expect(validateSourceFiles(loadSourceFiles())).toEqual([]);
  });

  it('cover central plus all 36 states and UTs', () => {
    expect(loadSourceFiles()).toHaveLength(37);
  });
});

describe('validateSourceFiles', () => {
  it('accepts a correct source', () => {
    expect(validateSourceFiles([upFile({})])).toEqual([]);
  });

  it('rejects duplicate ids across files', () => {
    const central: LoadedSourceFile = {
      file: path.join(SOURCES_DIR, 'central.json'),
      data: { level: 'central', state: null, name: 'Central', sources: [{ ...base, level: 'central', state: null }] },
    };
    expect(validateSourceFiles([central, upFile({})]).join()).toMatch(/duplicate id/);
  });

  it('requires enabled sources to have a URL', () => {
    expect(validateSourceFiles([upFile({ url: '' })]).join()).toMatch(/"enabled" must be false/);
    expect(validateSourceFiles([upFile({ url: '', enabled: false })])).toEqual([]);
  });

  it('rejects unknown categories, bad ids and wrong state', () => {
    const errors = validateSourceFiles([upFile({ id: 'Bad ID', category: 'Sports' as never, state: 'MH' })]).join('\n');
    expect(errors).toMatch(/"id"/);
    expect(errors).toMatch(/"category"/);
    expect(errors).toMatch(/"state" should be "UP"/);
  });

  it('rejects invalid URLs and empty linkFilter', () => {
    const errors = validateSourceFiles([upFile({ url: 'uppsc.up.nic.in', linkFilter: [] })]).join('\n');
    expect(errors).toMatch(/not a valid URL/);
    expect(errors).toMatch(/linkFilter/);
  });
});

describe('isGovDomain', () => {
  it('recognises .gov.in and .nic.in hosts only', () => {
    expect(isGovDomain('https://ssc.gov.in/')).toBe(true);
    expect(isGovDomain('https://kpsc.kar.nic.in/x')).toBe(true);
    expect(isGovDomain('https://www.ibps.in/')).toBe(false);
    expect(isGovDomain('https://gov.in.example.com/')).toBe(false);
    expect(isGovDomain('')).toBe(false);
  });
});
