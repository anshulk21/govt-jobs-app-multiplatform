import { fetch } from 'undici';
import type { Source } from '../../src/core/types';
import { groupName, groupOrder, type AttentionItem } from './state';

export const TELEGRAM_LIMIT = 4096;
const MAX_LINKS_PER_SOURCE = 10;

export interface FoundLink {
  title: string;
  url: string;
  /** Last date read from the notification, if any. */
  lastDate?: string | null;
}

export interface SummaryInput {
  header: string;
  /** Extra lines shown under the header. */
  notes?: string[];
  found: { source: Source; links: FoundLink[] }[];
  /** Sources whose page changed so much they were re-baselined instead of alerted. */
  rebaselined: { source: Source; count: number }[];
  attention: AttentionItem[];
}

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Builds the HTML message: new links grouped Central first, then by state; then sources needing attention. */
export function buildSummary({ header, notes = [], found, rebaselined, attention }: SummaryInput): string {
  const lines: string[] = [`<b>${escapeHtml(header)}</b>`, ...notes.map(escapeHtml)];
  const sorted = [...found].filter((f) => f.links.length).sort((a, b) => groupOrder(a.source).localeCompare(groupOrder(b.source)));

  let group = '';
  for (const { source, links } of sorted) {
    const g = groupName(source);
    if (g !== group) {
      lines.push('', `<b>📍 ${escapeHtml(g)}</b>`);
      group = g;
    }
    lines.push(`<b>${escapeHtml(source.name)}</b>`);
    for (const l of links.slice(0, MAX_LINKS_PER_SOURCE)) {
      const last = l.lastDate ? ` <i>(last date ${l.lastDate})</i>` : '';
      lines.push(`• <a href="${escapeHtml(l.url)}">${escapeHtml(clip(l.title, 150))}</a>${last}`);
    }
    if (links.length > MAX_LINKS_PER_SOURCE) lines.push(`  …and ${links.length - MAX_LINKS_PER_SOURCE} more (see drafts)`);
  }

  if (rebaselined.length) {
    lines.push('', '<b>🔄 Re-baselined (too many new links at once — site probably redesigned, check manually)</b>');
    for (const r of rebaselined) lines.push(`• ${escapeHtml(r.source.name)} (${escapeHtml(groupName(r.source))}): ${r.count} links`);
  }

  if (attention.length) {
    lines.push('', '<b>⚠️ Sources needing attention</b>');
    for (const a of attention) {
      lines.push(`• <code>${escapeHtml(a.source.id)}</code> ${escapeHtml(a.source.name)} — ${escapeHtml(clip(a.reason, 120))} (${a.runs} runs)`);
    }
  }
  return lines.join('\n');
}

/** Splits at line breaks so no message exceeds Telegram's limit. */
export function splitMessage(text: string, limit = TELEGRAM_LIMIT): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    const pieces = line.length > limit ? (line.match(new RegExp(`[\\s\\S]{1,${limit}}`, 'g')) ?? []) : [line];
    for (const piece of pieces) {
      const candidate = current ? `${current}\n${piece}` : piece;
      if (candidate.length > limit) {
        chunks.push(current);
        current = piece;
      } else {
        current = candidate;
      }
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

/** Sends each chunk in order. Waits and retries once if Telegram asks us to slow down. */
export async function sendTelegram(token: string, chatId: string, chunks: string[]): Promise<void> {
  for (const text of chunks) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
      });
      if (res.ok) break;
      const body = (await res.json().catch(() => ({}))) as { description?: string; parameters?: { retry_after?: number } };
      if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, ((body.parameters?.retry_after ?? 5) + 1) * 1000));
        continue;
      }
      throw new Error(`Telegram error ${res.status}: ${body.description ?? 'unknown'}`);
    }
  }
}
