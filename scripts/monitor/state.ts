import fs from 'node:fs';
import path from 'node:path';
import { STATE_BY_CODE } from '../../src/core/constants';
import type { Source } from '../../src/core/types';

export type Runner = 'github' | 'local';

export interface SourceStatus {
  consecutiveFailures: number;
  /** Successful runs in a row where no job links at all were found. */
  emptyRuns: number;
  lastCheckedAt: string;
  lastOkAt?: string;
  lastError?: string;
  lastLinkCount?: number;
}

/** data/monitor/<runner>.json. GitHub and your PC each keep their own file, so they never conflict. */
export interface RunnerState {
  runCount: number;
  lastRunAt?: string;
  sources: Record<string, SourceStatus>;
}

export function statePath(dir: string, runner: Runner): string {
  return path.join(dir, `${runner}.json`);
}

export function loadState(dir: string, runner: Runner): RunnerState {
  const file = statePath(dir, runner);
  if (!fs.existsSync(file)) return { runCount: 0, sources: {} };
  return JSON.parse(fs.readFileSync(file, 'utf8')) as RunnerState;
}

export function saveState(dir: string, runner: Runner, state: RunnerState): void {
  fs.mkdirSync(dir, { recursive: true });
  const sources = Object.fromEntries(Object.entries(state.sources).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(statePath(dir, runner), JSON.stringify({ ...state, sources }, null, 2) + '\n');
}

export function recordResult(
  state: RunnerState,
  sourceId: string,
  now: string,
  result: { ok: true; linkCount: number } | { ok: false; error: string },
): SourceStatus {
  const prev = state.sources[sourceId] ?? { consecutiveFailures: 0, emptyRuns: 0, lastCheckedAt: now };
  const next: SourceStatus = result.ok
    ? { ...prev, consecutiveFailures: 0, emptyRuns: result.linkCount === 0 ? prev.emptyRuns + 1 : 0, lastCheckedAt: now, lastOkAt: now, lastLinkCount: result.linkCount, lastError: undefined }
    : { ...prev, consecutiveFailures: prev.consecutiveFailures + 1, lastCheckedAt: now, lastError: result.error };
  state.sources[sourceId] = next;
  return next;
}

export interface AttentionItem {
  source: Source;
  reason: string;
  runs: number;
}

/** A local success this recent means the source works from your PC, so GitHub failures aren't alarming. */
const LOCAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export function sourcesNeedingAttention(
  sources: Source[],
  state: RunnerState,
  other: RunnerState | null,
  threshold: number,
  now: Date,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const source of sources) {
    const st = state.sources[source.id];
    if (!st) continue;
    if (st.consecutiveFailures >= threshold) {
      const otherOk = other?.sources[source.id]?.lastOkAt;
      if (otherOk && now.getTime() - Date.parse(otherOk) < LOCAL_GRACE_MS) continue;
      items.push({ source, reason: st.lastError ?? 'failed', runs: st.consecutiveFailures });
    } else if (st.emptyRuns >= threshold) {
      items.push({ source, reason: 'page loads but has no job links — it may need JavaScript, or its layout changed. Point url at a plain notices page.', runs: st.emptyRuns });
    }
  }
  return items.sort((a, b) => groupOrder(a.source).localeCompare(groupOrder(b.source)));
}

/** Sort key: central first, then states/UTs by name, then source name. */
export function groupOrder(s: Source): string {
  return `${s.level === 'central' ? '0' : '1'}|${groupName(s)}|${s.name}`;
}

export function groupName(s: Source): string {
  return s.state ? (STATE_BY_CODE.get(s.state)?.name ?? s.state) : 'Central';
}
