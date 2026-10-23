// Usage: npm run telegram:channel -- --before <sha> [--after <sha>] [--dry-run]
//        npm run telegram:channel -- --latest=10 [--dry-run]   (post the 10 newest open jobs now)
//
// Posts newly published jobs, and admit card / answer key / result updates, to your public
// Telegram channel, each with a link to the job's page on the website. Same events as the app's
// push notifications (scripts/push/notify-published.ts), so quiet and expired jobs are skipped too.
//
// Needs TELEGRAM_BOT_TOKEN (the monitor's bot) and TELEGRAM_CHANNEL_ID ("@yourchannel"); does
// nothing without them. README → "Telegram channel".
import { APP } from '../../src/config/app';
import { QUALIFICATIONS, STAGES } from '../../src/core/constants';
import { daysLeft, formatDate, placeName, todayIST } from '../../src/core/jobs';
import type { Job } from '../../src/core/types';
import { publishedJobs } from '../../src/server/data';
import { escapeHtml, sendTelegram } from '../monitor/telegram';
import { findEvents, hasCommit, waitForSite, type PublishEvent } from './notify-published';

/** At most this many posts per run; the rest are summed up in one closing post. */
export const MAX_POSTS = 15;
/** Telegram allows about 20 messages a minute in a channel. */
const GAP_MS = 3_500;

const STAGE_HEADLINE: Record<string, string> = {
  'admit-card': '🎫 Admit card released',
  'answer-key': '🔑 Answer key released',
  result: '🏆 Result declared',
};

const jobUrl = (job: Job) => `${APP.siteUrl}/jobs/${job.slug}`;

/** The channel post for one event (Telegram HTML). */
export function channelPost(e: PublishEvent): string {
  const { job } = e;
  const title = `<b>${escapeHtml(job.title)}</b>`;
  const link = `👉 <a href="${escapeHtml(jobUrl(job))}">Details and how to apply</a>`;
  if (e.kind === 'update') {
    const headline = STAGE_HEADLINE[e.stages[0]!] ?? `📢 ${STAGES.find((s) => s.id === e.stages[0])?.label ?? 'Update'}`;
    return [`<b>${headline}</b>`, title, `🏛 ${escapeHtml(job.organization)}`, '', link.replace('Details and how to apply', 'Details')].join('\n');
  }
  const quals = job.qualifications.map((q) => QUALIFICATIONS.find((x) => x.id === q)?.label ?? q);
  const lines = [
    `🆕 ${title}`,
    '',
    `🏛 ${escapeHtml(job.organization)}`,
    `📍 ${escapeHtml(placeName(job))}`,
    job.vacancies ? `👥 Posts: ${job.vacancies.toLocaleString('en-IN')}` : null,
    quals.length ? `🎓 Qualification: ${escapeHtml(quals.join(', '))}` : null,
    job.ageLimit ? `🎂 Age: ${escapeHtml(job.ageLimit)}` : null,
    job.dates.lastDate ? `⏳ Last date: <b>${formatDate(job.dates.lastDate)}</b>` : null,
    '',
    link,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

/** Events worth a channel post: what the app would notify about, newest-published first. */
export function postableEvents(events: PublishEvent[], today: string): PublishEvent[] {
  return events.filter((e) => {
    if (e.kind === 'update') return true;
    if (e.job.quiet) return false;
    const left = daysLeft(e.job.dates.lastDate, today);
    return left === null || left >= 0;
  });
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : process.argv.find((x) => x.startsWith(`--${name}=`))?.split('=')[1];
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  const dryRun = process.argv.includes('--dry-run');
  if ((!token || !channel) && !dryRun) {
    console.log('TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID not set — not posting to a channel.');
    return;
  }
  const latest = Number(arg('latest') ?? 0);
  let events: PublishEvent[];
  if (latest > 0) {
    // By hand (Actions → "Post to Telegram channel"): the newest open jobs, oldest of them first so
    // the newest ends up at the bottom of the channel. They are live already, so no waiting.
    const newest = [...publishedJobs()].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')).map((job): PublishEvent => ({ kind: 'new', job, stages: [] }));
    events = postableEvents(newest, todayIST()).slice(0, Math.min(latest, MAX_POSTS)).reverse();
  } else {
    const before = arg('before');
    const after = arg('after') ?? 'HEAD';
    if (!before || /^0+$/.test(before) || !hasCommit(before)) {
      console.log('No previous commit to compare with — nothing to post.');
      return;
    }
    events = postableEvents(findEvents(before, after), todayIST());
  }
  if (!events.length) {
    console.log('Nothing new to post.');
    return;
  }

  const posts = events.slice(0, MAX_POSTS).map(channelPost);
  const rest = events.length - MAX_POSTS;
  if (rest > 0) posts.push(`➕ <b>${rest} more new update${rest === 1 ? '' : 's'}</b> on the website:\n👉 ${escapeHtml(APP.siteUrl)}`);

  if (dryRun) {
    console.log(posts.join('\n\n────────\n\n'));
    return;
  }
  // The links must work when people tap them.
  if (!latest && !(await waitForSite(events[0]!.job))) console.warn('⚠ Website not updated after 20 minutes — posting anyway.');
  for (const [i, text] of posts.entries()) {
    if (i) await new Promise((r) => setTimeout(r, GAP_MS));
    await sendTelegram(token!, channel!, [text]);
  }
  console.log(`Posted ${posts.length} message(s) to ${channel}.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
