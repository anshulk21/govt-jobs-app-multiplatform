import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHostThrottle, fetchWithRetry, mapLimit, USER_AGENT } from '../scripts/lib/http';

let server: http.Server;
let baseUrl: string;
let flakyHits = 0;
let lastUserAgent: string | undefined;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    lastUserAgent = req.headers['user-agent'];
    if (req.url === '/ok') return res.end('<a href="/x">Recruitment notice</a>');
    if (req.url === '/redirect') {
      res.writeHead(301, { location: '/ok' });
      return res.end();
    }
    if (req.url === '/flaky') {
      flakyHits++;
      res.writeHead(flakyHits < 3 ? 503 : 200);
      return res.end('ok');
    }
    if (req.url === '/slow') return setTimeout(() => res.end('late'), 500);
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('fetchWithRetry', () => {
  it('returns text and sends our User-Agent', async () => {
    const r = await fetchWithRetry(`${baseUrl}/ok`, { read: 'text' });
    expect(r.ok).toBe(true);
    expect(r.text).toContain('Recruitment');
    expect(lastUserAgent).toBe(USER_AGENT);
  });

  it('follows redirects and records the final URL', async () => {
    const r = await fetchWithRetry(`${baseUrl}/redirect`);
    expect(r.ok).toBe(true);
    expect(r.finalUrl).toBe(`${baseUrl}/ok`);
  });

  it('retries 5xx responses with backoff', async () => {
    flakyHits = 0;
    const r = await fetchWithRetry(`${baseUrl}/flaky`, { retries: 2, backoffMs: 10 });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(3);
  });

  it('does not retry a 404', async () => {
    const r = await fetchWithRetry(`${baseUrl}/missing`, { retries: 2, backoffMs: 10 });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
    expect(r.error).toBe('HTTP 404');
    expect(r.attempts).toBe(1);
  });

  it('times out slow servers', async () => {
    const r = await fetchWithRetry(`${baseUrl}/slow`, { timeoutMs: 100, retries: 0 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('timeout');
  });

  it('reports network errors without throwing', async () => {
    const closed = http.createServer();
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', r));
    const port = (closed.address() as AddressInfo).port;
    await new Promise((r) => closed.close(r));
    const r = await fetchWithRetry(`http://127.0.0.1:${port}/`, { retries: 0 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ECONNREFUSED/);
  });
});

describe('mapLimit', () => {
  it('keeps order and respects the concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });
});

describe('createHostThrottle', () => {
  it('spaces out requests to the same host but not different hosts', async () => {
    const wait = createHostThrottle(50, 50);
    const t0 = Date.now();
    await wait('https://a.gov.in/1');
    await wait('https://b.gov.in/1');
    expect(Date.now() - t0).toBeLessThan(40);
    await wait('https://a.gov.in/2');
    expect(Date.now() - t0).toBeGreaterThanOrEqual(45);
  });
});
