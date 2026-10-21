import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths';

export interface MonitorConfig {
  userAgent: string;
  concurrency: number;
  timeoutMs: number;
  retries: number;
  /** Random wait between two requests to the same website. */
  hostGapMs: { min: number; max: number };
  /** Stop starting new sources after this many minutes (the GitHub job is killed at 25). */
  timeBudgetMinutes: number;
  /** Consecutive failed runs before a source is listed under "needs attention". */
  attentionAfterFailures: number;
  /** More new links than this in one run = the site was probably redesigned; re-baseline instead of alerting. */
  maxNewLinksPerSource: number;
  pdf: { enabled: boolean; maxBytes: number; maxPerRun: number; maxPages: number };
  /** Links whose text or URL contains one of these words (at a word start) are never job links. */
  exclude: string[];
  /** Link texts too vague to use as a title; nearby text is used instead. */
  genericLinkText: string[];
}

let cached: MonitorConfig | undefined;

export function loadMonitorConfig(file = path.join(ROOT, 'config', 'monitor.json')): MonitorConfig {
  if (!cached) cached = JSON.parse(fs.readFileSync(file, 'utf8')) as MonitorConfig;
  return cached;
}
