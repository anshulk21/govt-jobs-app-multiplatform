// Usage: npm run push:reminders [-- --dry-run]
// Run daily at 09:00 IST by .github/workflows/push-reminders.yml:
// "Last 3 days to apply" to users whose choices match each job closing in 3 days.
import { daysLeft, todayIST } from '../../src/core/jobs';
import { conditionsForJob, lastDaysPush } from '../../src/core/push';
import { publishedJobs } from '../../src/server/data';
import { createSender, sendAll } from './fcm';

const DAYS_BEFORE = 3;

async function main() {
  const today = todayIST();
  const due = publishedJobs().filter((j) => daysLeft(j.dates.lastDate, today) === DAYS_BEFORE);
  if (!due.length) {
    console.log(`No jobs closing in ${DAYS_BEFORE} days (${today}).`);
    return;
  }
  const sender = createSender({ dryRun: process.argv.includes('--dry-run') });
  let failures = 0;
  for (const job of due) failures += await sendAll(sender, conditionsForJob(job), lastDaysPush(job, DAYS_BEFORE));
  console.log(`Done: ${due.length} job(s), ${failures} failed send(s).`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
