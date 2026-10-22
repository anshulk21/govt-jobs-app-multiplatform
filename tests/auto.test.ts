import { describe, expect, it } from 'vitest';
import { cleanTitle, decide, duplicateKey, jobTitle, type AutoConfig } from '../scripts/admin/auto';

describe('cleanTitle', () => {
  it('turns ALL-CAPS into normal case but keeps acronyms and codes', () => {
    expect(cleanTitle('FINAL RESULT NOTIFICATION OF ASSISTANT PROFESSOR EXAMINATION-2026 FOR THE POST OF ASSISTANT PROFESSOR')).toBe(
      'Final Result Notification of Assistant Professor Examination-2026 for the Post of Assistant Professor',
    );
    expect(cleanTitle('CLICK HERE FOR DOWNLOAD INTERVIEW LETTER FOR ADVT. NO. A-1/E-1/2025, COMBINED STATE')).toBe(
      'Interview Letter for Advt. No. A-1/E-1/2025, Combined State',
    );
    expect(cleanTitle('UPPSC PCS AND AIIMS NURSING OFFICER RECRUITMENT')).toBe('UPPSC PCS and AIIMS Nursing Officer Recruitment');
  });

  it('removes file sizes, "download", URL encoding and trailing dates', () => {
    expect(cleanTitle('Accessible Version : View (369 KB)')).toBe('Accessible Version: View');
    expect(cleanTitle('FORM%20OF%20MEDICAL%20CERTIFICATE')).toBe('Form of Medical Certificate');
    expect(cleanTitle('PDF Lakshadweep Times 15.10.2026 Download Document Opens downloadable PDF document')).toBe('Lakshadweep Times 15.10.2026');
    expect(cleanTitle('Final Answer Key For The Post Of Primary Teacher (PRT) | 2026-09-10')).toBe('Final Answer Key For The Post Of Primary Teacher (PRT)');
  });

  it('removes list numbers, leading dates, "Read more" and "Updated on" stamps', () => {
    expect(cleanTitle('4. Advertisement For the Post of Legal Assistant')).toBe('Advertisement For the Post of Legal Assistant');
    expect(cleanTitle('1 Notification for Engagement of Interns Read more')).toBe('Notification for Engagement of Interns');
    expect(cleanTitle('16 October 2026: Advertisement for the posts of Associate Consultants')).toBe('Advertisement for the posts of Associate Consultants');
    expect(cleanTitle('07-10-2026 Important information Regarding Engagement of Apprentices')).toBe('Important information Regarding Engagement of Apprentices');
    expect(cleanTitle('Engagement of Graduate Apprentices [NEW]')).toBe('Engagement of Graduate Apprentices');
    expect(cleanTitle('Updated On 21-10-2026')).toBe('');
    // A number that is part of the title stays.
    expect(cleanTitle('12 Posts of Junior Engineer')).toBe('12 Posts of Junior Engineer');
    expect(cleanTitle('72nd CCE Corrigendum')).toBe('72nd CCE Corrigendum');
  });

  it('leaves normal and Hindi titles alone', () => {
    expect(cleanTitle('Advertisement for Combined Secondary Level Examination- 2026')).toBe('Advertisement for Combined Secondary Level Examination- 2026');
    expect(cleanTitle('उत्तर प्रदेश पुलिस में आरक्षी भर्ती-2025')).toBe('उत्तर प्रदेश पुलिस में आरक्षी भर्ती-2025');
  });
});

describe('jobTitle', () => {
  it('adds the organisation to vague titles', () => {
    expect(jobTitle('Detailed result', 'RRC East Coast Railway (Bhubaneswar)')).toBe('Detailed result — RRC East Coast Railway (Bhubaneswar)');
    expect(jobTitle('Recruitment Results', 'State Bank of India — Careers')).toBe('Recruitment Results — State Bank of India');
    expect(jobTitle('Annexures-II', 'India Post — GDS Online Engagement')).toBe('Annexures-II — India Post GDS Online Engagement');
    expect(jobTitle('Exam Schedule', 'Kerala Public Service Commission (also police & teacher posts)')).toBe('Exam Schedule — Kerala Public Service Commission');
  });

  it('turns a bare date stamp into a dated notice, and leaves clear titles alone', () => {
    expect(jobTitle('Updated On 21-10-2026', 'Airports Authority of India — Recruitment')).toBe('Notice dated 21 Oct 2026 — Airports Authority of India');
    expect(jobTitle('Recruitment of Business Development Officers on Contract', 'Exim Bank — Careers')).toBe('Recruitment of Business Development Officers on Contract');
    expect(jobTitle('Notice dated 12.10.2026 regarding Publication of Revised List', 'WBSSC')).toBe('Notice dated 12.10.2026 regarding Publication of Revised List');
    expect(jobTitle('Notification for SSC CGL', 'Staff Selection Commission')).toBe('Notification for SSC CGL — Staff Selection Commission');
  });

  it('is stable when run again on its own output', () => {
    for (const [raw, org] of [['Detailed result', 'RRC East Coast Railway (Bhubaneswar)'], ['Updated On 21-10-2026', 'Airports Authority of India — Recruitment']] as const) {
      const once = decide({ title: raw, organization: org, sourceId: 'x', category: 'Railway', links: { notification: '', official: '', apply: null }, foundAt: '2026-10-20T00:00:00Z' }, { mode: 'smart', staleDraftDays: 21, lowSignalSources: [] }, new Date('2026-10-21T00:00:00Z'));
      const twice = decide({ title: once.title, organization: org, sourceId: 'x', category: 'Railway', links: { notification: '', official: '', apply: null }, foundAt: '2026-10-20T00:00:00Z' }, { mode: 'smart', staleDraftDays: 21, lowSignalSources: [] }, new Date('2026-10-21T00:00:00Z'));
      expect(twice).toEqual(once);
    }
  });

  it('treats a notice with a new query-string token as the same notice', () => {
    const at = (url: string) => duplicateKey({ sourceId: 'hc-chhattisgarh', links: { notification: url, official: '', apply: null } }, 'Advertisement for Legal Assistant');
    expect(at('https://highcourt.cg.gov.in/noti/view_file_noti.php?token=MzgxMjl8MTc5Mj.b2f2')).toBe(at('https://highcourt.cg.gov.in/noti/view_file_noti.php?token=MzgxMjl8MTc5Mk.0f3c'));
    expect(at('https://x.gov.in/a.pdf')).not.toBe(at('https://x.gov.in/b.pdf'));
  });
});

describe('auto-publish decisions', () => {
  const cfg: AutoConfig = { mode: 'smart', staleDraftDays: 21, lowSignalSources: ['ld-admin', 'ch-admin'] };
  const now = new Date('2026-10-21T00:00:00Z');
  const job = (title: string, over: Partial<{ sourceId: string; category: string; foundAt: string; url: string }> = {}) =>
    decide(
      {
        title,
        sourceId: over.sourceId ?? 'hssc',
        category: (over.category ?? 'Subordinate Services') as never,
        links: { notification: over.url ?? 'https://x.gov.in/a.pdf', official: 'https://x.gov.in/', apply: null },
        foundAt: over.foundAt ?? '2026-10-20T00:00:00Z',
      },
      cfg,
      now,
    );

  it('publishes recruitments with a notification', () => {
    expect(job('Apply for Advt no. 06/2026')).toMatchObject({ action: 'publish', quiet: false });
    expect(job('Recruitment Notice – Doctor Consultants (Contractual), Meghalaya Police, 2026', { category: 'Police' })).toMatchObject({ action: 'publish', quiet: false });
    expect(job('उत्तराखंड लाइनमैन पदों की सीधी भर्ती के विज्ञापन')).toMatchObject({ action: 'publish', quiet: false });
    expect(job('Notice to all', { sourceId: 'ld-admin', url: 'https://x.gov.in/recruitment-2026.pdf' })).toMatchObject({ action: 'publish' });
  });

  it('publishes updates about an existing recruitment quietly (no "new job" push)', () => {
    expect(job('Important Notice-Ref.:Advt. No.-05/2025: Regarding Postponement of PET', { category: 'Police' })).toMatchObject({ action: 'publish', quiet: true });
    expect(job('Corrigendum: Integrated 72nd CCE – Reduction of 2 Vacancies', { category: 'PSC' })).toMatchObject({ action: 'publish', quiet: true });
    expect(job('उत्तर प्रदेश पुलिस में आरक्षी भर्ती-2025 के अन्तर्गत शारीरिक मानक परीक्षा', { category: 'Police' })).toMatchObject({ action: 'publish', quiet: true });
  });

  it('publishes admit cards, answer keys and results quietly, with their stage', () => {
    expect(job('Final Answer Key For The Post Of Primary Teacher (PRT)')).toMatchObject({ action: 'publish', quiet: true, stage: 'answer-key' });
    expect(job('Download Admit Card for Post prior to August 2025', { category: 'PSC' })).toMatchObject({ action: 'publish', stage: 'admit-card' });
    expect(job('Results: Final Selection List of Candidates for the Post of Constable', { category: 'Police' })).toMatchObject({ stage: 'result', quiet: true });
  });

  it('publishes exam notices from recruiting bodies quietly', () => {
    expect(job('Corrigendum: Integrated 72nd Combined (Preliminary) Competitive Examination', { category: 'PSC' })).toMatchObject({ action: 'publish', quiet: true });
  });

  it('rejects junk and general admin notices', () => {
    expect(job('CRIME IN MEGHALAYA - 2023', { category: 'Police' }).action).toBe('reject');
    expect(job('PDF Lakshadweep Times 15.10.2026', { sourceId: 'ld-admin', category: 'Other' }).action).toBe('reject');
    expect(job('List of CPIOs', { sourceId: 'ch-admin', category: 'Other' }).action).toBe('reject');
    expect(job('Bonafide Certificate').action).toBe('reject');
    expect(job('Working Guidelines for Disbursement of Grant', { sourceId: 'ch-admin', category: 'Other' }).action).toBe('reject');
  });

  it('keeps unclear drafts, then rejects them once stale', () => {
    expect(job('Notice').action).toBe('keep');
    expect(job('Notice', { foundAt: '2026-09-01T00:00:00Z' }).action).toBe('reject');
    expect(job('Some general circular update', { category: 'Other', sourceId: 'x' }).action).toBe('keep');
  });

  it('respects the mode switch', () => {
    expect(decide({ title: 'Some general update', sourceId: 'x', category: 'Other', links: { notification: '', official: '', apply: null }, foundAt: '2026-10-20T00:00:00Z' }, { ...cfg, mode: 'all' }, now).action).toBe('publish');
    expect(decide({ title: 'Apply for Advt no. 06/2026', sourceId: 'x', category: 'Other', links: { notification: '', official: '', apply: null }, foundAt: '2026-10-20T00:00:00Z' }, { ...cfg, mode: 'off' }, now).action).toBe('keep');
  });
});

describe('old notices', () => {
  const cfg: AutoConfig = { mode: 'smart', staleDraftDays: 21, lowSignalSources: [] };
  const now = new Date('2026-10-21T00:00:00Z');
  const job = (title: string, notification = '', dates = {}) =>
    decide({ title, sourceId: 'rrc-er', category: 'Railway', links: { notification, official: '', apply: null }, foundAt: '2026-10-21T00:00:00Z', dates }, cfg, now);

  it('rejects notices whose newest date is long gone', () => {
    expect(job('Urgent Notice for Re-medical of candidates of CEN-02/2018.')).toMatchObject({ action: 'reject', reason: 'old notice (newest date mentioned: 2018)' });
    expect(job('Documents Verification Schedule From 25/04/2019 to 14/05/2019')).toMatchObject({ action: 'reject', reason: 'old notice (newest date mentioned: 2019-05-14)' });
    expect(job('Notice and Schedule of DV & ME against CEN No.08/2024(Level1 posts)').action).toBe('reject');
    expect(job('Admit card', 'https://example.gov.in/uploads/2019/05/admit.pdf').action).toBe('reject');
  });

  it('keeps current notices, last year’s ongoing ones, and anything with a future date', () => {
    expect(job('Recruitment for Various Post 2026 (Live)').action).toBe('publish');
    expect(job('Important Notice-Ref.:Advt. No.-05/2025: Regarding Postponement of PET').action).toBe('publish');
    expect(job('Notification for Common Recruitment Process', '', { notification: '2013-04-26', lastDate: '2027-07-20' }).action).toBe('publish');
    expect(job('Recruitment of Specialists On Contract – 2026-27').action).toBe('publish');
  });

  it('uses exact dates when given: older than 180 days is old', () => {
    expect(job('Recruitment notice dated 02.03.2026').action).toBe('reject');
    expect(job('Recruitment notice dated 15.10.2026').action).toBe('publish');
  });
});
