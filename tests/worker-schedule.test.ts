import { describe, expect, it, vi } from 'vitest';
import { SCHEDULED_WORKFLOWS, startScheduledWorkflow } from '../worker/schedule';
import fs from 'node:fs';

describe('scheduled workflow starts', () => {
  it('every Cron Trigger in wrangler.jsonc maps to a workflow file that exists', () => {
    const crons = JSON.parse(/"crons":\s*(\[[^\]]*\])/.exec(fs.readFileSync('wrangler.jsonc', 'utf8'))![1]!) as string[];
    expect(crons.sort()).toEqual(Object.keys(SCHEDULED_WORKFLOWS).sort());
    for (const wf of Object.values(SCHEDULED_WORKFLOWS)) expect(fs.existsSync(`.github/workflows/${wf}`)).toBe(true);
  });

  it('starts the workflow on main with the token', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    const msg = await startScheduledWorkflow('17 */3 * * *', { GITHUB_ACTIONS_TOKEN: 't' }, 'o/r', fetchFn as never);
    expect(msg).toBe('Started monitor.yml');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/o/r/actions/workflows/monitor.yml/dispatches');
    expect(JSON.parse(String(init.body))).toEqual({ ref: 'main' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t');
  });

  it('does nothing without a token, and reports GitHub errors', async () => {
    const fetchFn = vi.fn();
    expect(await startScheduledWorkflow('17 */3 * * *', {}, 'o/r', fetchFn as never)).toMatch(/not set/);
    expect(fetchFn).not.toHaveBeenCalled();
    const bad = vi.fn(async () => new Response('Bad credentials', { status: 401 }));
    await expect(startScheduledWorkflow('17 */3 * * *', { GITHUB_ACTIONS_TOKEN: 'x' }, 'o/r', bad as never)).rejects.toThrow(/401/);
  });
});
