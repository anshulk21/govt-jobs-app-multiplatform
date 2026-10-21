import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findEvents, hasCommit } from '../scripts/push/notify-published';

const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/jobs/published/sample-ssc-gd-constable-2026.json'), 'utf8'));

describe('finding what to announce after a push', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'push-'));
  const git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
  const write = (rel: string, data: unknown) => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), JSON.stringify(data));
  };
  const commit = (msg: string) => {
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', msg);
    return git('rev-parse', 'HEAD');
  };
  const job = { ...sample, sample: false, slug: 'ssc-gd-2026', id: 'id1' };

  git('init', '-q');
  write('data/jobs/drafts/ssc-gd-2026.json', { ...job, status: 'draft' });
  write('data/jobs/published/sample.json', sample);
  const c0 = commit('draft');

  // Publish: draft moves to published/.
  fs.rmSync(path.join(repo, 'data/jobs/drafts/ssc-gd-2026.json'));
  write('data/jobs/published/ssc-gd-2026.json', job);
  const c1 = commit('publish');

  // Admit card added.
  write('data/jobs/published/ssc-gd-2026.json', { ...job, timeline: [...job.timeline, { stage: 'admit-card', date: '2027-02-01', url: null }] });
  const c2 = commit('admit card');

  // A typo fix: no new stage.
  write('data/jobs/published/ssc-gd-2026.json', { ...job, title: `${job.title} (fixed)`, timeline: [...job.timeline, { stage: 'admit-card', date: '2027-02-01', url: null }] });
  const c3 = commit('typo');

  it('knows when the previous commit is gone (history rewritten)', () => {
    expect(hasCommit(c1, repo)).toBe(true);
    expect(hasCommit('ce008e530926d2df918ba6679f61711dae262892', repo)).toBe(false);
  });

  it('announces a newly published job', () => {
    const events = findEvents(c0, c1, repo);
    expect(events.map((e) => [e.kind, e.job.slug])).toEqual([['new', 'ssc-gd-2026']]);
  });

  it('announces a new stage to followers of the job', () => {
    const events = findEvents(c1, c2, repo);
    expect(events.map((e) => [e.kind, e.stages])).toEqual([['update', ['admit-card']]]);
  });

  it('stays quiet for edits without a new stage, and for sample jobs', () => {
    expect(findEvents(c2, c3, repo)).toEqual([]);
    write('data/jobs/published/another-sample.json', { ...sample, slug: 'another-sample' });
    const c4 = commit('sample');
    expect(findEvents(c3, c4, repo)).toEqual([]);
  });
});
