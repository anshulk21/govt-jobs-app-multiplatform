import { afterEach, describe, expect, it, vi } from 'vitest';

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
    const { publishedJobs } = await import('../src/server/data');
    expect(publishedJobs().some((j) => j.sample)).toBe(false);
  });

  it('builds API payloads from the sample jobs', async () => {
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
