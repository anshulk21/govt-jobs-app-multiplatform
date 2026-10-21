// Usage: npm run push:published -- --before <sha> --after <sha> [--dry-run] [--no-wait]
//
// Run by .github/workflows/push-on-publish.yml when data/jobs/published/ changes.
//   - a job newly added to published/  → "New: …" to users whose choices match it
//   - a published job that gained an admit card / answer key / result
//                                       → update to users who saved it (topic job_<id>)
// Waits until the website serves the new data first, so tapping the notification works.
import { execFileSync } from 'node:child_process';
import { APP } from '../../src/config/app';
import { daysLeft, todayIST } from '../../src/core/jobs';
import { conditionsForJob, jobTopic, newJobPush, newStages, stageUpdatePush } from '../../src/core/push';
import type { Job } from '../../src/core/types';
import { ROOT } from '../lib/paths';
import { createSender, sendAll } from './fcm';

const DIR = 'data/jobs/published/';

function arg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (a) return a.split('=')[1];
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const gitIn = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' });

function jobAt(root: string, sha: string, file: string): Job | null {
  try {
    return JSON.parse(gitIn(root, 'show', `${sha}:${file}`)) as Job;
  } catch {
    return null;
  }
}

export interface PublishEvent {
  kind: 'new' | 'update';
  job: Job;
  stages: string[];
}

/** Works out what to announce from the git changes between two commits. */
export function findEvents(before: string, after: string, root = ROOT): PublishEvent[] {
  const lines = gitIn(root, 'diff', '--name-status', '--no-renames', before, after, '--', DIR).trim().split('\n').filter(Boolean);
  const events: PublishEvent[] = [];
  for (const line of lines) {
    const [status, file] = line.split('\t') as [string, string];
    if (!file.endsWith('.json') || status === 'D') continue;
    const now = JSON.parse(gitIn(root, 'show', `${after}:${file}`)) as Job;
    if (now.status !== 'published' || now.sample) continue;
    const old = status === 'A' ? null : jobAt(root, before, file);
    if (!old || old.status !== 'published') events.push({ kind: 'new', job: now, stages: [] });
    else {
      const stages = newStages(old, now);
      if (stages.length) events.push({ kind: 'update', job: now, stages });
    }
  }
  return events;
}

/** Polls the website until it serves this version of the job (Cloudflare usually takes 2–5 minutes). */
async function waitForSite(job: Job, timeoutMs = 20 * 60_000): Promise<boolean> {
  const url = `${APP.siteUrl}/api/jobs/${job.slug}.json`;
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
      if (res.ok && ((await res.json()) as { job?: Job }).job?.updatedAt === job.updatedAt) return true;
    } catch {
      /* not deployed yet */
    }
    await new Promise((r) => setTimeout(r, 20_000));
  }
  return false;
}

async function main() {
  const before = arg('before');
  const after = arg('after') ?? 'HEAD';
  if (!before || /^0+$/.test(before)) {
    console.log('No previous commit to compare with — nothing to announce.');
    return;
  }
  const events = findEvents(before, after);
  if (!events.length) {
    console.log('No new or updated published jobs.');
    return;
  }
  const sender = createSender({ dryRun: flag('dry-run') });
  const today = todayIST();
  let failures = 0;

  for (const e of events) {
    if (sender.live && !flag('no-wait')) {
      console.log(`Waiting for ${APP.siteUrl} to serve ${e.job.slug}…`);
      if (!(await waitForSite(e.job))) console.warn('⚠ Website not updated after 20 minutes — sending anyway.');
    }
    if (e.kind === 'new') {
      const left = daysLeft(e.job.dates.lastDate, today);
      if (left !== null && left < 0) {
        console.log(`Skipping ${e.job.slug}: last date already passed.`);
        continue;
      }
      failures += await sendAll(sender, conditionsForJob(e.job), newJobPush(e.job));
    } else {
      for (const stage of e.stages) {
        failures += await sendAll(sender, [`'${jobTopic(e.job.id)}' in topics`], stageUpdatePush(e.job, stage as never));
      }
    }
  }
  console.log(`Done: ${events.length} job(s), ${failures} failed send(s).`);
  if (failures) process.exit(1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
