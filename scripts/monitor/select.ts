import type { Source } from '../../src/core/types';
import type { RunnerState } from './state';

export interface SelectOptions {
  runNumber: number;
  /** Ignore priority and run every enabled source. */
  all?: boolean;
  only?: Set<string>;
  state?: string;
  /** Only sources currently failing in this state (e.g. the GitHub runner's). */
  failingIn?: RunnerState;
}

/** high-priority sources run every time; normal ones on even-numbered runs. */
export function selectSources(sources: Source[], opts: SelectOptions): Source[] {
  return sources.filter((s) => {
    if (!s.enabled || !s.url) return false;
    if (opts.only && !opts.only.has(s.id)) return false;
    if (opts.state && (s.state ?? 'CENTRAL') !== opts.state) return false;
    if (opts.failingIn) return (opts.failingIn.sources[s.id]?.consecutiveFailures ?? 0) > 0;
    if (opts.all || opts.only) return true;
    return s.priority === 'high' || opts.runNumber % 2 === 0;
  });
}
