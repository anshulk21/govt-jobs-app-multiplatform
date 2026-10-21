import { describe, expect, it } from 'vitest';
import { cleanTitle, decide, type AutoConfig } from '../scripts/admin/auto';

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

  it('leaves normal and Hindi titles alone', () => {
    expect(cleanTitle('Advertisement for Combined Secondary Level Examination- 2026')).toBe('Advertisement for Combined Secondary Level Examination- 2026');
    expect(cleanTitle('उत्तर प्रदेश पुलिस में आरक्षी भर्ती-2025')).toBe('उत्तर प्रदेश पुलिस में आरक्षी भर्ती-2025');
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
