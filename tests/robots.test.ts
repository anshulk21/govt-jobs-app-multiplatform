import { describe, expect, it } from 'vitest';
import { isAllowedByRules, parseRobots } from '../scripts/monitor/robots';

const TXT = `
User-agent: *
Disallow: /admin/
Disallow: /*.php$
Allow: /admin/public/

User-agent: BadBot
Disallow: /
`;

describe('robots.txt', () => {
  const rules = parseRobots(TXT, 'GovtJobsFinder');

  it('uses the * group when we are not named', () => {
    expect(isAllowedByRules(rules, '/notices/a.pdf')).toBe(true);
    expect(isAllowedByRules(rules, '/admin/secret')).toBe(false);
  });

  it('lets the most specific rule win', () => {
    expect(isAllowedByRules(rules, '/admin/public/notice.pdf')).toBe(true);
  });

  it('supports * and $ wildcards', () => {
    expect(isAllowedByRules(rules, '/index.php')).toBe(false);
    expect(isAllowedByRules(rules, '/index.php?id=1')).toBe(true);
  });

  it('uses our own group when named', () => {
    const own = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: GovtJobsFinder\nDisallow: /private/', 'GovtJobsFinder');
    expect(isAllowedByRules(own, '/notices')).toBe(true);
    expect(isAllowedByRules(own, '/private/x')).toBe(false);
  });

  it('allows everything when robots.txt is empty', () => {
    expect(isAllowedByRules(parseRobots('', 'GovtJobsFinder'), '/anything')).toBe(true);
  });
});
