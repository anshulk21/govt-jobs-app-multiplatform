// End-to-end: runs the real monitor against a fake government site on localhost.
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Job } from '../src/core/types';
import { loadMonitorConfig } from '../scripts/lib/config';
import { runMonitor } from '../scripts/monitor/run';

/** A tiny but valid PDF containing the given lines of text. */
function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = `BT /F1 10 Tf 40 800 Td 14 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const PDF = makePdf([
  'Recruitment of Constable 2026',
  'Total No. of Posts: 1,250',
  'Last date for online application: 30.11.2026',
  'Age Limit: 18 to 25 years',
]);

let pageHtml = '';
let server: http.Server;
let base = '';
let dataDir = '';

const writeJson = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/robots.txt') return res.end('User-agent: *\nDisallow: /private/');
    if (req.url === '/notices') return res.end(pageHtml);
    if (req.url === '/files/constable-2026.pdf') {
      res.writeHead(200, { 'content-type': 'application/pdf' });
      return res.end(PDF);
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-'));
  const source = (id: string, url: string) => ({
    id, name: `Test ${id}`, url, level: 'state', state: 'UP', category: 'Police',
    linkFilter: ['recruitment', 'notice', '.pdf'], priority: 'high', enabled: true, verified: true,
  });
  writeJson(path.join(dataDir, 'sources/central.json'), { level: 'central', state: null, name: 'Central', sources: [] });
  writeJson(path.join(dataDir, 'sources/states/up.json'), {
    level: 'state', state: 'UP', name: 'Uttar Pradesh',
    sources: [source('up-test', `${base}/notices`), source('up-down', `${base}/missing`), source('up-private', `${base}/private/x`)],
  });
});

afterAll(() => {
  server.close();
});

describe('monitor end-to-end', () => {
  const config = { ...loadMonitorConfig(), hostGapMs: { min: 0, max: 0 }, retries: 0, attentionAfterFailures: 3 };
  const notified: string[][] = [];
  const ctx = () => ({ dataDir, config, log: () => {}, notify: async (c: string[]) => void notified.push(c) });
  const drafts = () => fs.readdirSync(path.join(dataDir, 'jobs/drafts'));

  it('first run is a baseline: records links, no drafts, no alert', async () => {
    pageHtml = '<a href="/old-notice.pdf">Old recruitment notice</a><a href="/tender.pdf">Tender notice</a>';
    const r = await runMonitor({ runner: 'github' }, ctx());
    expect(r.outcomes.find((o) => o.source.id === 'up-test')!.kind).toBe('baseline');
    expect(r.newLinks).toBe(0);
    expect(fs.existsSync(path.join(dataDir, 'jobs/drafts'))).toBe(false);
    expect(notified).toHaveLength(0);
    const seen = JSON.parse(fs.readFileSync(path.join(dataDir, 'seen-links/up-test.json'), 'utf8'));
    expect(Object.keys(seen.links)).toEqual([`127.0.0.1:${new URL(base).port}/old-notice.pdf`]); // tender excluded
    expect(r.commitMessage).toBe('monitor: no new links (1/3 sources ok, 1 baselined)');
  });

  it('a new PDF becomes a draft with details read from the PDF, and is alerted', async () => {
    pageHtml += '<table><tr><td>UP Police Constable Recruitment 2026</td><td><a href="/files/constable-2026.pdf">Download</a></td></tr></table>';
    const r = await runMonitor({ runner: 'github' }, ctx());
    expect(r.newLinks).toBe(1);
    expect(r.commitMessage).toBe('monitor: 1 new link — UP-TEST');

    const files = drafts();
    expect(files).toHaveLength(1);
    const job = JSON.parse(fs.readFileSync(path.join(dataDir, 'jobs/drafts', files[0]!), 'utf8')) as Job;
    expect(job.status).toBe('draft');
    expect(job.title).toBe('UP Police Constable Recruitment 2026 Download');
    expect(job.slug).toMatch(/^up-test-up-police-constable-recruitment-2026-download-[0-9a-f]{6}$/);
    expect(job.state).toBe('UP');
    expect(job.links.notification).toBe(`${base}/files/constable-2026.pdf`);
    expect(job.links.official).toBe(`${base}/notices`);
    expect(job.vacancies).toBe(1250);
    expect(job.dates.lastDate).toBe('2026-11-30');
    expect(job.ageLimit).toBe('18–25 years');
    expect(job.extraction.method).toBe('pdf-regex');
    expect(job.fee).toBeNull(); // not in the PDF, so not invented

    expect(notified).toHaveLength(1);
    expect(notified[0]!.join()).toContain('📍 Uttar Pradesh');
    expect(notified[0]!.join()).toContain('(last date 2026-11-30)');
  });

  it('does not alert the same link twice', async () => {
    const r = await runMonitor({ runner: 'github' }, ctx());
    expect(r.newLinks).toBe(0);
    expect(drafts()).toHaveLength(1);
  });

  it('flags a source after 3 failed runs, honours robots.txt', async () => {
    const state = JSON.parse(fs.readFileSync(path.join(dataDir, 'monitor/github.json'), 'utf8'));
    expect(state.runCount).toBe(3);
    expect(state.sources['up-down'].consecutiveFailures).toBe(3);
    expect(state.sources['up-private'].lastError).toBe('robots.txt disallows this page');
    // The 3rd failure triggered an alert even though there were no new links.
    expect(notified).toHaveLength(2);
    expect(notified[1]!.join()).toContain('Sources needing attention');
    expect(notified[1]!.join()).toContain('<code>up-down</code>');
  });

  it('dry run changes nothing', async () => {
    pageHtml += '<a href="/brand-new.pdf">Another recruitment</a>';
    const before = fs.readFileSync(path.join(dataDir, 'monitor/github.json'), 'utf8');
    const r = await runMonitor({ runner: 'github', dryRun: true }, ctx());
    expect(r.newLinks).toBe(1);
    expect(drafts()).toHaveLength(1);
    expect(fs.readFileSync(path.join(dataDir, 'monitor/github.json'), 'utf8')).toBe(before);
  });

  it('local runs with --only-failing pick sources failing on GitHub and keep their own state', async () => {
    const r = await runMonitor({ runner: 'local', onlyFailing: true }, ctx());
    expect(r.outcomes.map((o) => o.source.id).sort()).toEqual(['up-down', 'up-private']);
    expect(fs.existsSync(path.join(dataDir, 'monitor/local.json'))).toBe(true);
  });
});
