// Usage: npm run admin:apply [-- --before <sha>]
//
// Run by .github/workflows/publish.yml after you save jobs in the CMS (/admin):
//   - Status "Published" → checks the job, moves it to data/jobs/published/, sets publishedAt
//   - Status "Rejected"  → moves it to data/jobs/rejected/ (never alerted again)
//   - cleans empty fields and renames files to match their slug
// Writes the commit message to .admin-commit-msg (no file = nothing to commit).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/paths';
import { commitMessageFor, planJob, type Plan } from './jobs';

const FOLDERS = ['drafts', 'published', 'rejected'] as const;
const MSG_FILE = path.join(ROOT, '.admin-commit-msg');

function changedFiles(before: string | undefined): Set<string> | null {
  if (!before || /^0+$/.test(before)) return null; // unknown: treat every file as changed
  try {
    const out = execFileSync('git', ['diff', '--name-only', before, 'HEAD', '--', 'data/jobs'], { cwd: ROOT, encoding: 'utf8' });
    return new Set(out.split('\n').filter(Boolean));
  } catch {
    return null;
  }
}

function main() {
  const i = process.argv.indexOf('--before');
  const changed = changedFiles(i >= 0 ? process.argv[i + 1] : undefined);
  const now = new Date().toISOString();
  const plans: Plan[] = [];
  const taken = new Set<string>();
  let touched = 0;

  for (const folder of FOLDERS) {
    const dir = path.join(ROOT, 'data/jobs', folder);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const rel = `data/jobs/${folder}/${name}`;
      // Without a change list (manual run), published jobs are only touched if misplaced,
      // so their "updated" time isn't bumped for nothing.
      const isChanged = changed === null ? folder !== 'published' : changed.has(rel);
      // Only files edited in this push (or sitting in the wrong folder) are touched.
      const rawText = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(rawText);
      } catch {
        console.error(`✗ ${rel}: not valid JSON — skipped`);
        continue;
      }
      const wrongFolder = raw.status !== undefined && raw.status !== { drafts: 'draft', published: 'published', rejected: 'rejected' }[folder];
      if (!isChanged && !wrongFolder) continue;

      const plan = planJob(raw, folder, isChanged, now);
      // Keep file names unique if two jobs end up with the same slug.
      const baseSlug = plan.job.slug;
      let target = plan.target;
      for (let n = 2; taken.has(target) || (target !== rel && fs.existsSync(path.join(ROOT, target))); n++) {
        plan.job.slug = `${baseSlug}-${n}`;
        target = `data/jobs/${path.basename(path.dirname(plan.target))}/${plan.job.slug}.json`;
      }
      taken.add(target);
      plan.target = target;
      plans.push(plan);

      const out = JSON.stringify(plan.job, null, 2) + '\n';
      if (target !== rel || out !== rawText) {
        fs.mkdirSync(path.dirname(path.join(ROOT, target)), { recursive: true });
        fs.writeFileSync(path.join(ROOT, target), out);
        if (target !== rel) fs.rmSync(path.join(ROOT, rel));
        touched++;
      }
      if (plan.event !== 'unchanged') console.log(`${plan.event.padEnd(11)} ${target}${plan.problems.length ? ` — ${plan.problems.join('; ')}` : ''}`);
    }
  }

  const message = commitMessageFor(plans) ?? (touched ? '[CF-Pages-Skip] admin: tidy job files' : null);
  if (message) fs.writeFileSync(MSG_FILE, `${message}\n`);
  else if (fs.existsSync(MSG_FILE)) fs.rmSync(MSG_FILE);
  console.log(message ? `Commit: ${message}` : 'Nothing to change.');
}

main();
