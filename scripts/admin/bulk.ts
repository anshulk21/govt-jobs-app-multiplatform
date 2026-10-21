// Usage (normally via the "Bulk update drafts" GitHub workflow):
//   npm run admin:bulk -- --action=publish|reject [--sources=ssc,bpsc] [--states=UP,BR]
//                          [--title-has=recruitment,advt] [--title-not=calendar,annexure]
//                          [--limit=20] [--dry-run]
// Sets the Status of matching drafts; `npm run admin:apply` then checks and moves them
// exactly like publishing one job in the admin panel. Sample drafts are never touched.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/paths';
import { planJob } from './jobs';

export interface BulkFilters {
  sources?: string[];
  states?: string[];
  titleHas?: string[];
  titleNot?: string[];
  limit?: number;
}

interface DraftLike {
  slug: string;
  title: string;
  sourceId: string;
  state: string | null;
  level: string;
  sample?: boolean;
}

const lower = (xs?: string[]) => (xs ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean);

/** Drafts matching every given filter (empty filter = no restriction), oldest file name order. */
export function selectDrafts<T extends DraftLike>(drafts: T[], f: BulkFilters): T[] {
  const sources = lower(f.sources);
  const states = lower(f.states);
  const has = lower(f.titleHas);
  const not = lower(f.titleNot);
  const picked = drafts.filter((d) => {
    if (d.sample) return false;
    const title = d.title.toLowerCase();
    if (sources.length && !sources.includes(d.sourceId.toLowerCase())) return false;
    if (states.length && !states.includes((d.state ?? (d.level === 'central' ? 'central' : '')).toLowerCase())) return false;
    if (has.length && !has.some((w) => title.includes(w))) return false;
    if (not.some((w) => title.includes(w))) return false;
    return true;
  });
  return f.limit && f.limit > 0 ? picked.slice(0, f.limit) : picked;
}

function arg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
}
const list = (name: string) => (arg(name) ?? '').split(',').map((s) => s.trim()).filter(Boolean);

function main() {
  const action = arg('action');
  if (action !== 'publish' && action !== 'reject') {
    console.error('Use --action=publish or --action=reject');
    process.exit(2);
  }
  const dryRun = process.argv.includes('--dry-run');
  const filters: BulkFilters = {
    sources: list('sources'),
    states: list('states'),
    titleHas: list('title-has'),
    titleNot: list('title-not'),
    limit: Number(arg('limit')) || undefined,
  };

  const dir = path.join(ROOT, 'data/jobs/drafts');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const drafts = files.map((f) => ({ file: path.join(dir, f), ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
  const selected = selectDrafts(drafts, filters);
  const now = new Date().toISOString();
  const status = action === 'publish' ? 'published' : 'rejected';

  const rows = selected.map((d) => {
    const { file, ...raw } = d;
    const plan = planJob({ ...raw, status }, 'drafts', true, now);
    if (!dryRun) fs.writeFileSync(file, JSON.stringify({ ...raw, status }, null, 2) + '\n');
    const result = plan.event === 'held' ? `stays in Drafts: ${plan.problems.join('; ')}` : action === 'publish' ? 'will go live' : 'rejected';
    return { slug: d.slug, title: d.title, source: d.sourceId, result };
  });

  const heading = `${dryRun ? 'DRY RUN — nothing changed. ' : ''}${action === 'publish' ? 'Publish' : 'Reject'}: ${rows.length} of ${drafts.filter((d) => !d.sample).length} drafts matched`;
  console.log(heading);
  for (const r of rows) console.log(`  ${r.result.padEnd(14).slice(0, 14)} ${r.source.padEnd(14)} ${r.title.slice(0, 80)}`);

  // Nice table on the GitHub run page.
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const esc = (s: string) => s.replace(/\|/g, '\\|');
    fs.appendFileSync(
      summary,
      [`### ${heading}`, '', '| Result | Source | Title |', '|---|---|---|', ...rows.map((r) => `| ${esc(r.result)} | ${r.source} | ${esc(r.title.slice(0, 120))} |`), ''].join('\n'),
    );
  }
}

if (require.main === module) main();
