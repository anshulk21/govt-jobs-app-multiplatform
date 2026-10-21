import path from 'node:path';
import type { Source } from '../../src/core/types';
import type { MonitorConfig } from '../lib/config';
import { createHostThrottle, fetchWithRetry, mapLimit, USER_AGENT } from '../lib/http';
import { allSources, loadSourceFiles, validateSourceFiles } from '../lib/sources';
import { makeDraft, writeDraft } from './drafts';
import { extractDetails, type Extracted } from './extract';
import { extractLinks, filterJobLinks, isPdfUrl, pickSeedLinks, type PageLink } from './links';
import { pdfToText } from './pdf';
import { RobotsCache } from './robots';
import { findNewLinks, loadSeen, markSeen, saveSeen } from './seen';
import { selectSources } from './select';
import { loadState, recordResult, saveState, sourcesNeedingAttention, type Runner } from './state';
import { buildSummary, splitMessage, type FoundLink, type SummaryInput } from './telegram';

export interface MonitorOptions {
  runner: Runner;
  all?: boolean;
  only?: Set<string>;
  state?: string;
  /** Only run sources that are failing on GitHub (for running on your own PC). */
  onlyFailing?: boolean;
  dryRun?: boolean;
  pdf?: boolean;
  /** On a source's first run, also turn its newest N notices into drafts (instead of only recording them). */
  seed?: number;
}

export interface MonitorContext {
  dataDir: string;
  config: MonitorConfig;
  now?: () => Date;
  log?: (msg: string) => void;
  /** Called with the Telegram message chunks; omitted = don't send. */
  notify?: (chunks: string[]) => Promise<void>;
}

type Outcome =
  | { kind: 'ok'; source: Source; linkCount: number; found: FoundLink[]; drafts: number }
  | { kind: 'baseline'; source: Source; linkCount: number; seeded: number }
  | { kind: 'rebaseline'; source: Source; linkCount: number; count: number }
  | { kind: 'failed'; source: Source; error: string }
  | { kind: 'skipped'; source: Source; reason: string };

export interface MonitorResult {
  runNumber: number;
  outcomes: Outcome[];
  newLinks: number;
  draftsCreated: number;
  messages: string[];
  commitMessage: string;
}

export async function runMonitor(opts: MonitorOptions, ctx: MonitorContext): Promise<MonitorResult> {
  const { config, dataDir } = ctx;
  const now = ctx.now ?? (() => new Date());
  const log = ctx.log ?? console.log;
  const started = now();
  const startedIso = started.toISOString();
  const deadline = started.getTime() + config.timeBudgetMinutes * 60_000;

  const dirs = {
    sources: path.join(dataDir, 'sources'),
    seen: path.join(dataDir, 'seen-links'),
    jobs: path.join(dataDir, 'jobs'),
    state: path.join(dataDir, 'monitor'),
  };

  const files = loadSourceFiles(dirs.sources);
  const errors = validateSourceFiles(files);
  if (errors.length) throw new Error(`Source files have problems (run npm run validate-sources):\n${errors.join('\n')}`);
  const sources = allSources(files);

  const state = loadState(dirs.state, opts.runner);
  const otherRunner: Runner = opts.runner === 'github' ? 'local' : 'github';
  const other = loadState(dirs.state, otherRunner);
  const runNumber = state.runCount + 1;

  const selected = selectSources(sources, {
    runNumber,
    all: opts.all,
    only: opts.only,
    state: opts.state,
    failingIn: opts.onlyFailing ? loadState(dirs.state, 'github') : undefined,
  });
  log(`Run #${runNumber} (${opts.runner}): checking ${selected.length} of ${sources.length} sources${opts.dryRun ? ' — DRY RUN' : ''}`);

  const robots = new RobotsCache(USER_AGENT.split('/')[0]!);
  const throttle = createHostThrottle(config.hostGapMs.min, config.hostGapMs.max);
  let pdfBudget = opts.pdf === false || !config.pdf.enabled ? 0 : config.pdf.maxPerRun;

  async function readPdf(url: string): Promise<{ extracted: Extracted | null; error?: string }> {
    if (pdfBudget <= 0) return { extracted: null, error: 'PDF not read (per-run PDF limit reached)' };
    if (!(await robots.isAllowed(url))) return { extracted: null, error: 'PDF not read (robots.txt disallows)' };
    pdfBudget--;
    await throttle(url);
    const r = await fetchWithRetry(url, { read: 'bytes', maxBytes: config.pdf.maxBytes, timeoutMs: config.timeoutMs, retries: 1 });
    if (!r.ok || !r.bytes) return { extracted: null, error: `PDF not read (${r.error ?? `HTTP ${r.status}`})` };
    try {
      const { text } = await pdfToText(r.bytes, config.pdf.maxPages);
      if (text.replace(/\s/g, '').length < 50) return { extracted: null, error: 'PDF has no text layer (probably scanned)' };
      return { extracted: extractDetails(text) };
    } catch (err) {
      return { extracted: null, error: `PDF could not be parsed (${(err as Error).message})` };
    }
  }

  async function draftFor(source: Source, link: PageLink, pageUrl: string): Promise<{ found: FoundLink; written: boolean }> {
    let extracted: Extracted | null = null;
    let method: 'link-only' | 'pdf-regex' = 'link-only';
    let error: string | undefined;
    if (isPdfUrl(link.url)) {
      ({ extracted, error } = await readPdf(link.url));
      if (extracted) method = 'pdf-regex';
    }
    if (!extracted) {
      // Dates written in the link text itself, e.g. "… last date 15.11.2026".
      const fromTitle = extractDetails(link.text);
      if (Object.keys(fromTitle.evidence).length) extracted = fromTitle;
    }
    const job = makeDraft({ source, link, pageUrl, now: startedIso, extracted, method, error });
    const written = opts.dryRun ? true : writeDraft(dirs.jobs, job);
    return { found: { title: job.title, url: link.url, lastDate: job.dates.lastDate }, written };
  }

  async function check(source: Source): Promise<Outcome> {
    if (now().getTime() > deadline) return { kind: 'skipped', source, reason: 'time limit reached' };
    if (!(await robots.isAllowed(source.url))) return { kind: 'failed', source, error: 'robots.txt disallows this page' };

    const failingBefore = state.sources[source.id]?.consecutiveFailures ?? 0;
    await throttle(source.url);
    // Sources that keep failing get one attempt, so they don't eat the time budget.
    const page = await fetchWithRetry(source.url, {
      read: 'text',
      timeoutMs: config.timeoutMs,
      retries: failingBefore >= config.attentionAfterFailures ? 0 : config.retries,
    });
    if (!page.ok || page.text === undefined) return { kind: 'failed', source, error: page.error ?? `HTTP ${page.status}` };

    const pageUrl = page.finalUrl ?? source.url;
    const links = filterJobLinks(extractLinks(page.text, pageUrl, config.genericLinkText), {
      include: source.linkFilter,
      exclude: config.exclude,
    });
    const seen = loadSeen(dirs.seen, source.id);
    const save = (all: PageLink[]) => !opts.dryRun && saveSeen(dirs.seen, markSeen(seen, source.id, all, startedIso));

    if (!seen) {
      let seeded = 0;
      for (const link of pickSeedLinks(links, opts.seed ?? 0)) {
        if ((await draftFor(source, link, pageUrl)).written) seeded++;
      }
      save(links);
      return { kind: 'baseline', source, linkCount: links.length, seeded };
    }
    const fresh = findNewLinks(links, seen);
    if (fresh.length > config.maxNewLinksPerSource) {
      save(links);
      return { kind: 'rebaseline', source, linkCount: links.length, count: fresh.length };
    }
    const found: FoundLink[] = [];
    let drafts = 0;
    for (const link of fresh) {
      const d = await draftFor(source, link, pageUrl);
      // Already a draft/published/rejected job (e.g. seen-links was reset): don't alert again.
      if (!d.written) continue;
      found.push(d.found);
      drafts++;
    }
    save(links);
    return { kind: 'ok', source, linkCount: links.length, found, drafts };
  }

  let done = 0;
  const outcomes = await mapLimit(selected, config.concurrency, async (source) => {
    let outcome: Outcome;
    try {
      outcome = await check(source);
    } catch (err) {
      outcome = { kind: 'failed', source, error: `internal error: ${(err as Error).message}` };
    }
    done++;
    const detail =
      outcome.kind === 'ok' ? `${outcome.found.length} new / ${outcome.linkCount} links`
      : outcome.kind === 'baseline'
        ? `baseline: ${outcome.linkCount} links recorded${outcome.seeded ? `, ${outcome.seeded} newest saved as drafts` : ', no alerts'}`
      : outcome.kind === 'rebaseline' ? `${outcome.count} new links at once — re-baselined`
      : outcome.kind === 'failed' ? `FAILED: ${outcome.error}`
      : `skipped: ${outcome.reason}`;
    log(`[${done}/${selected.length}] ${source.id.padEnd(24)} ${detail}`);
    return outcome;
  });

  // Update per-source health and work out which sources need attention.
  const finishedIso = now().toISOString();
  const newlyFlagged = new Set<string>();
  for (const o of outcomes) {
    if (o.kind === 'skipped') continue;
    const st = recordResult(state, o.source.id, finishedIso, o.kind === 'failed' ? { ok: false, error: o.error } : { ok: true, linkCount: o.linkCount });
    if (st.consecutiveFailures === config.attentionAfterFailures || st.emptyRuns === config.attentionAfterFailures) newlyFlagged.add(o.source.id);
  }
  state.runCount = runNumber;
  state.lastRunAt = finishedIso;
  const attention = sourcesNeedingAttention(sources, state, other, config.attentionAfterFailures, now());

  const found = outcomes.flatMap((o) => (o.kind === 'ok' && o.found.length ? [{ source: o.source, links: o.found }] : []));
  const rebaselined = outcomes.flatMap((o) => (o.kind === 'rebaseline' ? [{ source: o.source, count: o.count }] : []));
  const newLinks = found.reduce((n, f) => n + f.links.length, 0);
  const seeded = outcomes.reduce((n, o) => n + (o.kind === 'baseline' ? o.seeded : 0), 0);
  const draftsCreated = outcomes.reduce((n, o) => n + (o.kind === 'ok' ? o.drafts : 0), 0) + seeded;

  const ist = new Date(started.getTime() + 330 * 60_000).toISOString().slice(0, 16).replace('T', ' ');
  const summary: SummaryInput = {
    header: `${newLinks ? `🆕 ${newLinks} new link${newLinks === 1 ? '' : 's'}` : 'No new links'} — run #${runNumber} (${opts.runner}), ${ist} IST`,
    notes: seeded ? [`🌱 First run: saved the newest ${seeded} existing notices as drafts. Review them before publishing.`] : [],
    found,
    rebaselined,
    attention,
  };
  const shouldNotify = newLinks > 0 || seeded > 0 || rebaselined.length > 0 || attention.some((a) => newlyFlagged.has(a.source.id));
  const messages = shouldNotify ? splitMessage(buildSummary(summary)) : [];

  if (!opts.dryRun) saveState(dirs.state, opts.runner, state);
  if (messages.length && ctx.notify && !opts.dryRun) {
    // A Telegram outage must not lose the run's results, so just report it.
    await ctx.notify(messages).catch((err) => log(`⚠️ Telegram send failed: ${(err as Error).message}`));
  }

  const result: MonitorResult = { runNumber, outcomes, newLinks, draftsCreated, messages, commitMessage: commitMessage(outcomes, newLinks, seeded) };
  const count = (k: Outcome['kind']) => outcomes.filter((o) => o.kind === k).length;
  log(
    `\nDone: ${newLinks} new links, ${draftsCreated} drafts written, ${count('ok')} ok, ${count('baseline')} baselined, ` +
      `${count('rebaseline')} re-baselined, ${count('failed')} failed, ${count('skipped')} skipped. ${attention.length} need attention.`,
  );
  return result;
}

/** e.g. "monitor: 14 new links — SSC, UPPSC, TNPSC, +5 more" */
export function commitMessage(outcomes: Outcome[], newLinks: number, seeded = 0): string {
  const ok = outcomes.filter((o) => o.kind !== 'failed' && o.kind !== 'skipped').length;
  const checked = outcomes.filter((o) => o.kind !== 'skipped').length;
  if (!newLinks) {
    const baselined = outcomes.filter((o) => o.kind === 'baseline').length;
    return `monitor: no new links (${ok}/${checked} sources ok${baselined ? `, ${baselined} baselined` : ''}${seeded ? `, ${seeded} seeded drafts` : ''})`;
  }
  const names = outcomes
    .filter((o): o is Extract<Outcome, { kind: 'ok' }> => o.kind === 'ok' && o.found.length > 0)
    .sort((a, b) => b.found.length - a.found.length)
    .map((o) => o.source.id.toUpperCase());
  const shown = names.slice(0, 3).join(', ');
  const more = names.length > 3 ? `, +${names.length - 3} more` : '';
  return `monitor: ${newLinks} new link${newLinks === 1 ? '' : 's'} — ${shown}${more}`;
}
