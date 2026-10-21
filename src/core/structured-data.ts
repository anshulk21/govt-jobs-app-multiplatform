// schema.org structured data (JSON-LD) for search engines. Pure functions, tested.
import { QUALIFICATIONS, STATE_BY_CODE, type QualificationId } from './constants';
import { formatDate, isExpired, placeName, todayIST } from './jobs';
import type { Job } from './types';

type JsonLd = Record<string, unknown>;

// Google's accepted credentialCategory values.
const CREDENTIAL: Partial<Record<QualificationId, string>> = {
  '10th': 'high school',
  '12th': 'high school',
  iti: 'professional certificate',
  diploma: 'professional certificate',
  graduate: 'bachelor degree',
  engineering: 'bachelor degree',
  medical: 'bachelor degree',
  nursing: 'bachelor degree',
  law: 'bachelor degree',
  bed: 'bachelor degree',
  postgraduate: 'postgraduate degree',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain HTML description written from the job's fields (our own words, no copied text). */
export function jobDescriptionHtml(job: Job): string {
  const quals = job.qualifications.map((q) => QUALIFICATIONS.find((x) => x.id === q)?.label ?? q);
  const items = [
    job.postName ? `Post: ${job.postName}` : null,
    job.vacancies ? `Vacancies: ${job.vacancies.toLocaleString('en-IN')}` : null,
    quals.length ? `Qualification: ${quals.join(', ')}` : null,
    job.ageLimit ? `Age limit: ${job.ageLimit}` : null,
    job.fee ? `Application fee: ${job.fee}` : null,
    job.dates.applyStart ? `Apply from: ${formatDate(job.dates.applyStart)}` : null,
    job.dates.lastDate ? `Last date: ${formatDate(job.dates.lastDate)}` : null,
  ].filter(Boolean) as string[];
  return [
    `<p>${esc(job.organization)} has announced ${esc(job.title)} (${esc(placeName(job))}).</p>`,
    items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '',
    job.howToApply ? `<p>${esc(job.howToApply)}</p>` : '',
    '<p>Read the official notification before applying.</p>',
  ].join('');
}

/**
 * Google JobPosting. Returns null once the last date has passed (Google asks for
 * expired postings to drop the markup; the page itself stays online).
 * `asOf` is the build time, so the static HTML and the browser render agree.
 */
export function jobPostingJsonLd(job: Job, siteUrl: string, asOf: string): JsonLd | null {
  if (isExpired({ lastDate: job.dates.lastDate }, todayIST(new Date(asOf)))) return null;
  const officialOrigin = (() => {
    try {
      return new URL(job.links.official).origin;
    } catch {
      return undefined;
    }
  })();
  const credentials = [...new Set(job.qualifications.map((q) => CREDENTIAL[q]).filter(Boolean))];
  const state = job.state ? STATE_BY_CODE.get(job.state) : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.postName ?? job.title,
    description: jobDescriptionHtml(job),
    datePosted: (job.publishedAt ?? job.foundAt).slice(0, 10),
    ...(job.dates.lastDate ? { validThrough: `${job.dates.lastDate}T23:59:59+05:30` } : {}),
    hiringOrganization: { '@type': 'Organization', name: job.organization, ...(officialOrigin ? { sameAs: officialOrigin } : {}) },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressCountry: 'IN', ...(state ? { addressRegion: state.name } : {}) },
    },
    ...(job.vacancies ? { totalJobOpenings: job.vacancies } : {}),
    ...(credentials.length
      ? { educationRequirements: credentials.map((c) => ({ '@type': 'EducationalOccupationalCredential', credentialCategory: c })) }
      : {}),
    identifier: { '@type': 'PropertyValue', name: job.organization, value: job.id },
    directApply: false,
    url: `${siteUrl}/jobs/${job.slug}`,
  };
}

export function breadcrumbJsonLd(siteUrl: string, items: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${siteUrl}${it.path}` })),
  };
}

export function websiteJsonLd(siteUrl: string, name: string, description: string): JsonLd[] {
  return [
    { '@context': 'https://schema.org', '@type': 'WebSite', name, url: `${siteUrl}/`, description },
    { '@context': 'https://schema.org', '@type': 'Organization', name, url: `${siteUrl}/` },
  ];
}
