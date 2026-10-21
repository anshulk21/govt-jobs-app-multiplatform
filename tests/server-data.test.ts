import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** A temporary project folder holding only the given published job files, used as the working directory. */
function useJobs(files: Record<string, unknown>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jobs-'));
  const dir = path.join(root, 'data/jobs/published');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, job] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), JSON.stringify(job));
  vi.spyOn(process, 'cwd').mockReturnValue(root);
}

const REPO_PUBLISHED = path.join(__dirname, '../data/jobs/published');
const samples = Object.fromEntries(
  fs.readdirSync(REPO_PUBLISHED).filter((f) => f.startsWith('sample-')).map((f) => [f, JSON.parse(fs.readFileSync(path.join(REPO_PUBLISHED, f), 'utf8'))]),
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete process.env.SAMPLE_JOBS;
});

describe('src/server/data', () => {
  // The website's browser bundle includes this module, where Node APIs don't exist.
  it('does not use Node APIs at import time', async () => {
    vi.spyOn(process, 'cwd').mockImplementation(() => {
      throw new Error('process.cwd called at import time');
    });
    await expect(import('../src/server/data')).resolves.toBeDefined();
  });

  it('hides sample jobs unless SAMPLE_JOBS=1', async () => {
    useJobs(samples);
    const { publishedJobs } = await import('../src/server/data');
    expect(publishedJobs()).toEqual([]);
  });

  it('hides sample jobs once a real job is published, even with SAMPLE_JOBS=1', async () => {
    const real = { ...samples['sample-ssc-gd-constable-2026.json'], sample: undefined, slug: 'real-job', id: 'r1' };
    useJobs({ ...samples, 'real-job.json': real });
    process.env.SAMPLE_JOBS = '1';
    const { publishedJobs } = await import('../src/server/data');
    expect(publishedJobs().map((j) => j.slug)).toEqual(['real-job']);
  });

  it('makes page titles unique when published jobs share a title', async () => {
    const base = { ...samples['sample-ssc-gd-constable-2026.json'], sample: undefined, title: 'Important Notice' };
    const a = { ...base, slug: 'a', id: 'aaaaaa1111', dates: { ...base.dates, notification: '2026-10-01' } };
    const b = { ...base, slug: 'b', id: 'bbbbbb2222', dates: { ...base.dates, notification: '2026-10-05' } };
    const c = { ...base, slug: 'c', id: 'cccccc3333', dates: { ...base.dates, notification: '2026-10-05' } };
    useJobs({ 'a.json': a, 'b.json': b, 'c.json': c });
    const { pageTitleFor, getJob } = await import('../src/server/data');
    expect(pageTitleFor(getJob('a')!)).toBe('Important Notice (1 Oct 2026)');
    expect(pageTitleFor(getJob('b')!)).toBe('Important Notice (ref. bbbbbb)');
    expect(pageTitleFor(getJob('c')!)).toBe('Important Notice (ref. cccccc)');
  });

  it('builds API payloads from the sample jobs', async () => {
    useJobs(samples);
    process.env.SAMPLE_JOBS = '1';
    const { apiFiles, payloads } = await import('../src/server/data');
    expect(payloads.latest().jobs).toHaveLength(5);
    expect(payloads.state('UP').jobs.map((j) => j.slug)).toEqual(['sample-up-police-constable-2026']);
    expect(payloads.updates('result').jobs.map((j) => j.slug)).toEqual(['sample-tnpsc-group-4-2026']);
    expect(payloads.job('nope')).toBeNull();
    const paths = apiFiles().map(([p]) => p);
    expect(paths).toContain('/api/jobs/latest.json');
    expect(paths).toContain('/api/jobs/state/UP.json');
    expect(paths).toContain('/api/jobs/sample-ssc-gd-constable-2026.json');
  });
});
