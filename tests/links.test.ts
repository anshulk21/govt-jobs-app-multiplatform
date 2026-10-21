import { describe, expect, it } from 'vitest';
import { extractLinks, filterJobLinks, isExcluded, isJobLink, matchesAtWordStart, normalizeUrl } from '../scripts/monitor/links';

const PAGE = 'https://uppsc.up.nic.in/notices/index.aspx';
const GENERIC = ['click here', 'download', 'view'];

describe('normalizeUrl', () => {
  it('makes relative links absolute', () => {
    expect(normalizeUrl('advt-05-2026.pdf', PAGE)).toBe('https://uppsc.up.nic.in/notices/advt-05-2026.pdf');
    expect(normalizeUrl('/a/b.pdf', PAGE)).toBe('https://uppsc.up.nic.in/a/b.pdf');
    expect(normalizeUrl('//cdn.uppsc.up.nic.in/x.pdf', PAGE)).toBe('https://cdn.uppsc.up.nic.in/x.pdf');
  });

  it('drops fragments and session ids', () => {
    expect(normalizeUrl('/n.pdf#page=2', PAGE)).toBe('https://uppsc.up.nic.in/n.pdf');
    expect(normalizeUrl('/view.jsp;jsessionid=ABC123?id=5', PAGE)).toBe('https://uppsc.up.nic.in/view.jsp?id=5');
    expect(normalizeUrl('/view.php?id=5&PHPSESSID=xyz', PAGE)).toBe('https://uppsc.up.nic.in/view.php?id=5');
  });

  it('ignores non-web links', () => {
    for (const href of ['javascript:void(0)', 'mailto:a@b.in', 'tel:123', '#top', '', 'ftp://x.gov.in/a']) {
      expect(normalizeUrl(href, PAGE)).toBeNull();
    }
  });
});

describe('extractLinks', () => {
  it('extracts absolute links, de-duplicates and skips images', () => {
    const html = `
      <a href="/a.pdf">Advt</a>
      <a href="/a.pdf">Advertisement No. 05/2026 Assistant Professor</a>
      <a href="/logo.png">Logo</a>
      <a href="mailto:x@y.in">Mail</a>`;
    expect(extractLinks(html, PAGE)).toEqual([{ url: 'https://uppsc.up.nic.in/a.pdf', text: 'Advertisement No. 05/2026 Assistant Professor' }]);
  });

  it('uses the surrounding row when link text is vague', () => {
    const html = `<table><tr><td>Recruitment of 120 Lecturers, Advt 07/2026</td><td><a href="/l.pdf">Click here</a></td></tr></table>`;
    const [link] = extractLinks(html, PAGE, GENERIC);
    expect(link!.text).toBe('Recruitment of 120 Lecturers, Advt 07/2026 Click here');
  });

  it('respects <base href>', () => {
    const html = `<base href="https://ssc.gov.in/docs/"><a href="cgl.pdf">CGL notice</a>`;
    expect(extractLinks(html, 'https://ssc.gov.in/')[0]!.url).toBe('https://ssc.gov.in/docs/cgl.pdf');
  });
});

describe('job link detection', () => {
  const rules = { include: ['recruitment', 'notification', 'advt', 'vacancy'], exclude: ['tender', 'rti', 'holiday', 'circular', 'right to information'] };
  const link = (text: string, url = 'https://ssc.gov.in/page') => ({ text, url });

  it('keeps links matching linkFilter in text or URL path', () => {
    expect(isJobLink(link('Recruitment of Constables 2026'), rules)).toBe(true);
    expect(isJobLink(link('Click', 'https://ssc.gov.in/advt/2026/05'), rules)).toBe(true);
  });

  it('keeps every PDF', () => {
    expect(isJobLink(link('Important', 'https://ssc.gov.in/files/a.PDF'), rules)).toBe(true);
    expect(isJobLink(link('Important', 'https://ssc.gov.in/files/a.pdf?v=2'), rules)).toBe(true);
  });

  it('drops links with no job keyword', () => {
    expect(isJobLink(link('About us'), rules)).toBe(false);
  });

  it('ignores the host name when matching', () => {
    expect(isJobLink(link('Home', 'https://recruitment.gov.in/'), rules)).toBe(false);
  });

  it('drops excluded links (tenders, RTI, holidays, circulars)', () => {
    expect(isJobLink(link('Notification for Tender of Computers', 'https://ssc.gov.in/t.pdf'), rules)).toBe(false);
    expect(isJobLink(link('RTI Notification'), rules)).toBe(false);
    expect(isJobLink(link('List of Holidays 2027', 'https://ssc.gov.in/h.pdf'), rules)).toBe(false);
    expect(isJobLink(link('Circular regarding vacancy'), rules)).toBe(false);
    expect(isJobLink(link('x', 'https://ssc.gov.in/right-to-information/notice.pdf'), rules)).toBe(false);
  });

  it('matches exclude words only at a word start', () => {
    expect(matchesAtWordStart('call for tenders', 'tender')).toBe(true);
    expect(matchesAtWordStart('attender recruitment', 'tender')).toBe(false);
    expect(matchesAtWordStart('particulars of posts', 'rti')).toBe(false);
    expect(isExcluded(link('Recruitment of Attender posts'), rules.exclude)).toBe(false);
  });

  it('filters a whole page', () => {
    const html = `
      <a href="/n/cgl-2026.pdf">Combined Graduate Level Exam 2026 Notification</a>
      <a href="/tenders/t1.pdf">Tender for housekeeping</a>
      <a href="/about">About SSC</a>
      <a href="/rti">RTI</a>`;
    const out = filterJobLinks(extractLinks(html, 'https://ssc.gov.in/'), rules);
    expect(out.map((l) => l.url)).toEqual(['https://ssc.gov.in/n/cgl-2026.pdf']);
  });
});

describe('link titles', () => {
  it('ignores template placeholders and falls back to the file name', () => {
    const [link] = extractLinks(`<a href="/docs/advt_05-2026.pdf">{{'Advt_HM' | translate }}</a>`, PAGE);
    expect(link!.text).toBe('advt 05 2026.pdf');
  });
});

describe('pickSeedLinks', () => {
  it('prefers PDFs and dated notices, in page order', async () => {
    const { pickSeedLinks } = await import('../scripts/monitor/links');
    const links = [
      { url: 'https://x.gov.in/notices', text: 'Notices' },
      { url: 'https://x.gov.in/a.pdf', text: 'Advt A' },
      { url: 'https://x.gov.in/b', text: 'Recruitment of Clerks 2026' },
      { url: 'https://x.gov.in/c', text: 'Notice dated 12.10.2026' },
      { url: 'https://x.gov.in/d.pdf', text: 'Advt D' },
    ];
    expect(pickSeedLinks(links, 3).map((l) => l.url)).toEqual(['https://x.gov.in/a.pdf', 'https://x.gov.in/b', 'https://x.gov.in/c']);
    expect(pickSeedLinks(links, 0)).toEqual([]);
  });
});
