// Usage: npm run admin:auto [-- --dry-run] [--include-published]
// Run after every monitor run (.github/workflows/monitor.yml): applies the auto-publish rules
// (scripts/admin/auto.ts) to drafts, then `npm run admin:apply` checks and moves them.
// Writes .auto-publish.json ({published, notified, rejected, kept}) for the workflow, and sends a
// short Telegram summary when TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are set.
// --include-published: one-time clean-up of already-published jobs (junk is unpublished, titles
// cleaned, stages added); uncertain ones stay published.
import fs from 'node:fs';
import path from 'node:path';
import type { Job } from '../../src/core/types';
import { loadMonitorConfig } from '../lib/config';
import { ROOT } from '../lib/paths';
import { sendTelegram } from '../monitor/telegram';
import { decide } from './auto';

const dryRun = process.argv.includes('--dry-run');
const includePublished = process.argv.includes('--include-published');
const cfg = loadMonitorConfig().autoPublish ?? { mode: 'off', staleDraftDays: 21, lowSignalSources: [] };
const now = new Date();
const counts = { published: 0, notified: 0, rejected: 0, kept: 0 };
const lines: string[] = [];

const folders = includePublished ? ['drafts', 'published'] : ['drafts'];
for (const folder of folders) {
  const dir = path.join(ROOT, 'data/jobs', folder);
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const file = path.join(dir, name);
    const job = JSON.parse(fs.readFileSync(file, 'utf8')) as Job;
    if (job.sample || (folder === 'drafts' && job.status !== 'draft')) continue;
    // A draft the admin already looked at and held back (notes say why) stays for the admin.
    if (folder === 'drafts' && job.notes?.startsWith('Not published yet:') && cfg.mode !== 'all') continue;
    const d = decide(job, cfg, now);
    const next: Job = { ...job, title: d.title };
    const withStage = () => {
      if (d.stage && !next.timeline.some((t) => t.stage === d.stage)) {
        next.timeline = [...next.timeline, { stage: d.stage, date: job.foundAt.slice(0, 10), url: job.links.notification }];
      }
    };
    if (folder === 'published') {
      // Clean-up of already-live jobs: never send pushes for them.
      if (d.action === 'reject') {
        Object.assign(next, { status: 'rejected', notes: `Unpublished automatically: ${d.reason}.` });
        counts.rejected++;
      } else {
        withStage();
        if (job.title !== d.title || next.timeline !== job.timeline) counts.published++;
      }
    } else if (d.action === 'publish') {
      Object.assign(next, { status: 'published', autoPublished: true, quiet: d.quiet });
      withStage();
      counts.published++;
      if (!d.quiet) counts.notified++;
    } else if (d.action === 'reject') {
      next.status = 'rejected';
      next.notes = `Rejected automatically: ${d.reason}.`;
      counts.rejected++;
    } else {
      counts.kept++;
    }
    lines.push(`${folder === 'published' ? 'live:' : ''}${d.action.padEnd(8)} ${d.quiet ? '      ' : 'notify'} ${job.sourceId.padEnd(16)} ${d.title.slice(0, 90)}  (${d.reason})`);
    if (!dryRun && JSON.stringify(next) !== JSON.stringify(job)) fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  }
}

console.log(`Auto-publish (${cfg.mode}${dryRun ? ', dry run' : ''}): ${counts.published} published (${counts.notified} with notification), ${counts.rejected} rejected, ${counts.kept} left as drafts`);
for (const l of lines) console.log(`  ${l}`);
if (!dryRun) fs.writeFileSync(path.join(ROOT, '.auto-publish.json'), JSON.stringify(counts) + '\n');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHAT_ID;
if (!dryRun && token && chat && (counts.published || counts.rejected)) {
  const text = `🤖 Auto-publish: ${counts.published} published (${counts.notified} with a notification), ${counts.rejected} rejected, ${counts.kept} left as drafts.`;
  void sendTelegram(token, chat, [text]).catch((e) => console.warn(`Telegram: ${(e as Error).message}`));
}
