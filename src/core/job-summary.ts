// One-page job summary (a Pro tool), as HTML that is printed to PDF on the device. Pure, tested.
import { QUALIFICATIONS, STAGES } from './constants';
import { formatDate, placeName } from './jobs';
import type { Job } from './types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SEE = 'See official notification';

export function jobSummaryHtml(job: Job, siteUrl: string, appName: string): string {
  const row = (label: string, value: string | null) => `<tr><th>${esc(label)}</th><td>${esc(value ?? SEE)}</td></tr>`;
  const quals = job.qualifications.map((q) => QUALIFICATIONS.find((x) => x.id === q)?.label ?? q).join(', ');
  const timeline = job.timeline
    .map((t) => `<li>${esc(STAGES.find((s) => s.id === t.stage)?.label ?? t.stage)}${t.date ? ` — ${esc(formatDate(t.date)!)}` : ''}</li>`)
    .join('');
  const link = (label: string, url: string | null) => (url ? `<p>${esc(label)}: <a href="${esc(url)}">${esc(url)}</a></p>` : '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(job.title)}</title>
<style>
  body{font-family:-apple-system,Roboto,"Noto Sans","Noto Sans Devanagari",Arial,sans-serif;color:#0f172a;margin:32px;line-height:1.45}
  h1{font-size:22px;margin:0 0 4px} .org{color:#475569;margin:0 0 16px}
  table{border-collapse:collapse;width:100%;margin:12px 0} th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top;font-size:13px}
  th{width:32%;background:#f6f4ee} h2{font-size:15px;margin:18px 0 6px} a{color:#c2340e;word-break:break-all} .foot{margin-top:24px;font-size:11px;color:#64748b}
</style></head><body>
<h1>${esc(job.title)}</h1><p class="org">${esc(job.organization)} · ${esc(placeName(job))} · ${esc(job.category)}</p>
<table>
${row('Post', job.postName)}${row('Vacancies', job.vacancies ? job.vacancies.toLocaleString('en-IN') : null)}${row('Qualification', quals || null)}
${row('Age limit', job.ageLimit)}${row('Application fee', job.fee)}
${row('Notification date', formatDate(job.dates.notification))}${row('Apply from', formatDate(job.dates.applyStart))}
${row('Last date', formatDate(job.dates.lastDate))}${row('Exam date', formatDate(job.dates.exam))}
</table>
${job.howToApply ? `<h2>How to apply</h2><p>${esc(job.howToApply)}</p>` : ''}
${timeline ? `<h2>Status</h2><ul>${timeline}</ul>` : ''}
<h2>Official links</h2>
${link('Notification', job.links.notification)}${link('Apply online', job.links.apply)}${link('Official website', job.links.official)}
<p class="foot">From ${esc(appName)} — ${esc(`${siteUrl}/jobs/${job.slug}`)}. Not a government website. Always verify every detail in the official notification before applying.</p>
</body></html>`;
}
