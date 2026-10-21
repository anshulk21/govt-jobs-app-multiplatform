import fs from 'node:fs';
import path from 'node:path';
import { seenKey, type PageLink } from './links';

/** data/seen-links/<source-id>.json */
export interface SeenFile {
  sourceId: string;
  /** When this source was first baselined. */
  baselinedAt: string;
  /** seenKey(url) → ISO time first seen. */
  links: Record<string, string>;
}

export function seenPath(dir: string, sourceId: string): string {
  return path.join(dir, `${sourceId}.json`);
}

/** Returns null when the source has never run (so this run is the baseline). */
export function loadSeen(dir: string, sourceId: string): SeenFile | null {
  const file = seenPath(dir, sourceId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as SeenFile;
}

export function saveSeen(dir: string, seen: SeenFile): void {
  fs.mkdirSync(dir, { recursive: true });
  const sorted = Object.fromEntries(Object.entries(seen.links).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(seenPath(dir, seen.sourceId), JSON.stringify({ ...seen, links: sorted }, null, 2) + '\n');
}

/** Links whose URL isn't in the seen file yet. A link repeated on the page counts once. */
export function findNewLinks(links: PageLink[], seen: SeenFile | null): PageLink[] {
  const known = new Set(Object.keys(seen?.links ?? {}));
  const out: PageLink[] = [];
  for (const link of links) {
    const key = seenKey(link.url);
    if (known.has(key)) continue;
    known.add(key);
    out.push(link);
  }
  return out;
}

/** Records links as seen (keeps the original first-seen time for known ones). */
export function markSeen(seen: SeenFile | null, sourceId: string, links: PageLink[], now: string): SeenFile {
  const next: SeenFile = seen ? { ...seen, links: { ...seen.links } } : { sourceId, baselinedAt: now, links: {} };
  for (const link of links) {
    const key = seenKey(link.url);
    next.links[key] ??= now;
  }
  return next;
}
