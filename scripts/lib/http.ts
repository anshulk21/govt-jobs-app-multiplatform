import { constants } from 'node:crypto';
import { Agent, fetch } from 'undici';
import { loadMonitorConfig } from './config';

/** Set in config/monitor.json; the MONITOR_USER_AGENT environment variable overrides it. */
export const USER_AGENT = process.env.MONITOR_USER_AGENT || loadMonitorConfig().userAgent;

// Many Indian government sites serve incomplete or expired certificate chains,
// or use old TLS servers needing legacy renegotiation, which browsers tolerate
// but Node rejects. We only ever read public pages, so on such an error we
// retry once with a lenient connection and flag it.
const agents = new Map<string, Agent>();
function agentFor(timeoutMs: number, lenient: boolean): Agent {
  const key = `${timeoutMs}:${lenient}`;
  let agent = agents.get(key);
  if (!agent) {
    agent = new Agent({
      connect: lenient
        ? { timeout: timeoutMs, rejectUnauthorized: false, secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT }
        : { timeout: timeoutMs },
    });
    agents.set(key, agent);
  }
  return agent;
}

const TLS_ERROR_CODES = new Set([
  'ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_NOT_YET_VALID',
]);

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  /** Base backoff between retries; doubles each attempt. */
  backoffMs?: number;
  /** Read and return the body (as text or bytes). Default: discard it. */
  read?: 'text' | 'bytes' | 'none';
  /** Bodies bigger than this are not read (bytes). */
  maxBytes?: number;
}

export interface FetchResult {
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  contentType: string | null;
  text?: string;
  bytes?: Uint8Array;
  error?: string;
  /** True if the page only loaded after ignoring a certificate error. */
  tlsWarning: boolean;
  attempts: number;
  ms: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errorCode(err: unknown): string | undefined {
  let e = err as { code?: string; cause?: unknown } | undefined;
  for (let depth = 0; e && depth < 5; depth++) {
    if (e.code) return e.code;
    e = e.cause as typeof e;
  }
  return undefined;
}

function describeError(err: unknown): string {
  const code = errorCode(err);
  if ((err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError') return 'timeout';
  const cause = (err as { cause?: Error })?.cause;
  const msg = cause?.message ?? (err as Error)?.message ?? String(err);
  return code && !msg.includes(code) ? `${code}: ${msg}` : msg;
}

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

/**
 * GET a URL with a timeout, retries with exponential backoff, and a clear
 * User-Agent. Never throws; failures are reported in the result.
 */
export async function fetchWithRetry(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const { timeoutMs = 30_000, retries = 2, backoffMs = 2_000, read = 'none', maxBytes = 10 * 1024 * 1024 } = opts;
  const started = Date.now();
  let insecure = false;
  let last: FetchResult = { ok: false, status: null, finalUrl: null, contentType: null, tlsWarning: false, attempts: 0, ms: 0 };

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8' },
        dispatcher: agentFor(timeoutMs, insecure),
      });
      const contentType = res.headers.get('content-type');
      last = { ok: res.ok, status: res.status, finalUrl: res.url || url, contentType, tlsWarning: insecure, attempts: attempt, ms: 0 };

      if (res.ok && read === 'text') {
        last.text = await res.text();
      } else if (res.ok && read === 'bytes') {
        const len = Number(res.headers.get('content-length') ?? 0);
        if (len > maxBytes) {
          await res.body?.cancel();
          last.error = `too large (${len} bytes)`;
        } else {
          const buf = new Uint8Array(await res.arrayBuffer());
          if (buf.byteLength > maxBytes) last.error = `too large (${buf.byteLength} bytes)`;
          else last.bytes = buf;
        }
      } else {
        await res.body?.cancel();
      }

      if (res.ok || !isRetryableStatus(res.status)) break;
      last.error = `HTTP ${res.status}`;
    } catch (err) {
      const code = errorCode(err);
      last = { ...last, ok: false, status: null, error: describeError(err), tlsWarning: insecure, attempts: attempt };
      if (!insecure && code && TLS_ERROR_CODES.has(code)) {
        insecure = true;
        attempt--; // the insecure retry doesn't use up a normal retry
        continue;
      }
    }
    if (attempt <= retries) await sleep(backoffMs * 2 ** (attempt - 1) + Math.random() * 500);
  }
  if (!last.ok && !last.error && last.status !== null) last.error = `HTTP ${last.status}`;
  last.ms = Date.now() - started;
  return last;
}

/** Runs async tasks with at most `limit` in flight at once. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Ensures requests to the same host are spaced out by a random 1–2 s gap
 * (configurable), so we never hammer a single government server.
 */
export function createHostThrottle(minGapMs = 1_000, maxGapMs = 2_000) {
  const nextFree = new Map<string, number>();
  return async function waitForHost(url: string): Promise<void> {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return;
    }
    const now = Date.now();
    const at = Math.max(now, nextFree.get(host) ?? 0);
    nextFree.set(host, at + minGapMs + Math.random() * (maxGapMs - minGapMs));
    if (at > now) await sleep(at - now);
  };
}
