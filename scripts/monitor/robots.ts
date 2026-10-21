import { fetchWithRetry } from '../lib/http';

interface Rule {
  allow: boolean;
  pattern: string;
}

/** The rules from robots.txt that apply to us: our own User-agent group if present, else "*". */
export function parseRobots(txt: string, agentToken: string): Rule[] {
  const token = agentToken.toLowerCase();
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (key === 'disallow' && value) current.rules.push({ allow: false, pattern: value });
      else if (key === 'allow' && value) current.rules.push({ allow: true, pattern: value });
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** Standard longest-match: the most specific matching rule wins, Allow wins ties. */
export function isAllowedByRules(rules: Rule[], pathAndQuery: string): boolean {
  let best: Rule | null = null;
  for (const rule of rules) {
    if (!patternToRegex(rule.pattern).test(pathAndQuery)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

/** Fetches each site's robots.txt once per run. A missing or unreachable robots.txt allows everything. */
export class RobotsCache {
  private byOrigin = new Map<string, Promise<Rule[]>>();

  constructor(
    private agentToken: string,
    private timeoutMs = 15_000,
  ) {}

  async isAllowed(url: string): Promise<boolean> {
    const u = new URL(url);
    let rules = this.byOrigin.get(u.origin);
    if (!rules) {
      rules = fetchWithRetry(`${u.origin}/robots.txt`, { read: 'text', retries: 0, timeoutMs: this.timeoutMs }).then((r) =>
        r.ok && r.text && !/^\s*</.test(r.text) ? parseRobots(r.text, this.agentToken) : [],
      );
      this.byOrigin.set(u.origin, rules);
    }
    return isAllowedByRules(await rules, u.pathname + u.search);
  }
}
