// On-time starts for GitHub Actions workflows. GitHub's own `schedule:` is best-effort and can
// run hours late (or not at all) on new repos, so Cloudflare Cron Triggers (wrangler.jsonc →
// triggers.crons) ask GitHub to start the workflow instead. The workflows keep their own schedule
// as a fallback; both are safe to run twice (the monitor skips links it has already seen).
//
// Needs the Worker secret GITHUB_ACTIONS_TOKEN: a fine-grained GitHub token for this repository
// only, with "Actions: Read and write" (README → "Monitor runs on time").

/** Cron expression (must match wrangler.jsonc exactly) → workflow file to start. */
export const SCHEDULED_WORKFLOWS: Record<string, string> = {
  '17 */3 * * *': 'monitor.yml', // every 3 hours
  '30 0 * * *': 'daily-rebuild.yml', // 06:00 IST: refresh "days left" on every page
};

export interface ScheduleEnv {
  GITHUB_ACTIONS_TOKEN?: string;
}

export async function startScheduledWorkflow(cron: string, env: ScheduleEnv, repo: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const workflow = SCHEDULED_WORKFLOWS[cron];
  if (!workflow) return `No workflow for cron "${cron}"`;
  if (!env.GITHUB_ACTIONS_TOKEN) return `GITHUB_ACTIONS_TOKEN is not set; ${workflow} will only run on GitHub's own schedule`;
  const res = await fetchFn(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_ACTIONS_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'govt-jobs-finder-worker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: 'main' }),
  });
  // 204 = started. Anything else is logged (Workers → Logs) and retried at the next trigger.
  if (res.status !== 204) throw new Error(`Starting ${workflow} failed: ${res.status} ${await res.text()}`);
  return `Started ${workflow}`;
}
