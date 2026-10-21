// Usage: npm run monitor [-- options]
//
// Checks the official source pages, saves new links as draft jobs in
// data/jobs/drafts/, and sends one Telegram summary.
//
// Options:
//   --all            run every enabled source (ignore priority)
//   --only=ssc,upsc  run only these source ids
//   --state=UP       run only one state/UT (or --state=central)
//   --only-failing   run only sources that are failing on GitHub (for your own PC)
//   --dry-run        don't write files or send Telegram; just print
//   --no-pdf         don't download/read PDFs
//   --seed=3         first run on a source: also save its 3 newest notices as drafts
//   --runner=local   record results as a local run (default: github on GitHub Actions, local elsewhere)
//   --push           after the run, git commit + pull --rebase + push (for local runs)
//
// Environment: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (optional; without them the summary is printed).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadMonitorConfig } from '../lib/config';
import { DATA_DIR, ROOT } from '../lib/paths';
import { runMonitor, type MonitorOptions } from './run';
import { sendTelegram } from './telegram';
import type { Runner } from './state';

const COMMIT_MSG_FILE = path.join(ROOT, '.monitor-commit-msg');

function parseArgs(argv: string[]): MonitorOptions & { push: boolean } {
  const opts: MonitorOptions & { push: boolean } = {
    runner: process.env.GITHUB_ACTIONS === 'true' ? 'github' : 'local',
    push: false,
  };
  for (const a of argv) {
    const [key, value = ''] = a.replace(/^--/, '').split('=');
    if (key === 'all') opts.all = true;
    else if (key === 'only') opts.only = new Set(value.split(',').map((s) => s.trim()).filter(Boolean));
    else if (key === 'state') opts.state = value.toUpperCase();
    else if (key === 'only-failing') opts.onlyFailing = true;
    else if (key === 'dry-run') opts.dryRun = true;
    else if (key === 'no-pdf') opts.pdf = false;
    else if (key === 'seed') opts.seed = Math.max(1, Number(value) || 3);
    else if (key === 'push') opts.push = true;
    else if (key === 'runner' && (value === 'github' || value === 'local')) opts.runner = value as Runner;
    else {
      console.error(`Unknown option: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function commitAndPush(): void {
  git('add', 'data');
  if (!git('diff', '--cached', '--name-only').trim()) {
    console.log('Nothing to commit.');
    return;
  }
  git('commit', '-F', COMMIT_MSG_FILE);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      git('pull', '--rebase');
      git('push');
      console.log('Pushed.');
      return;
    } catch (err) {
      if (attempt === 3) throw err;
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const result = await runMonitor(opts, {
    dataDir: DATA_DIR,
    config: loadMonitorConfig(),
    notify: token && chatId ? (chunks) => sendTelegram(token, chatId, chunks) : undefined,
  });

  if (result.messages.length && (!token || !chatId || opts.dryRun)) {
    console.log('\n--- Telegram summary (not sent: ' + (opts.dryRun ? 'dry run' : 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set') + ') ---');
    for (const m of result.messages) console.log(m + '\n');
  } else if (result.messages.length) {
    console.log(`Sent ${result.messages.length} Telegram message(s).`);
  }

  if (opts.dryRun) return;
  // Monitor commits only touch drafts and bookkeeping, never the public site, so the
  // [CF-Pages-Skip] prefix tells Cloudflare Pages not to rebuild (saves free build quota).
  fs.writeFileSync(COMMIT_MSG_FILE, `[CF-Pages-Skip] ${result.commitMessage}\n`);
  console.log(`Commit message: ${result.commitMessage}`);
  if (opts.push) commitAndPush();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
