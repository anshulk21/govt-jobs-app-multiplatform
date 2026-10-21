// Builds the Decap CMS configuration (public/admin/config.yml) from the app's own lists,
// so states, categories, qualifications and stages always match the app.
import { CATEGORIES, QUALIFICATIONS, STAGES, STATES } from '../../src/core/constants';

const opt = (label: string, value: string) => ({ label, value });
const STATE_OPTIONS = STATES.map((s) => opt(s.name, s.code));
const CATEGORY_OPTIONS = [...CATEGORIES];
const date = (name: string, label: string) => ({
  name,
  label,
  widget: 'datetime',
  format: 'YYYY-MM-DD',
  date_format: 'DD MMM YYYY',
  time_format: false,
  picker_utc: true,
  required: false,
});
const hidden = (name: string) => ({ name, label: name, widget: 'hidden', required: false });

/** Every job field must be listed: Decap drops unknown fields when saving. */
export const JOB_FIELDS = [
  {
    name: 'status',
    label: 'Status',
    widget: 'select',
    options: [opt('Draft (not public)', 'draft'), opt('Published (goes live)', 'published'), opt('Rejected (never shown)', 'rejected')],
    default: 'draft',
    hint: 'Set to Published and save: within a few minutes the job is moved, the site rebuilds and matching users get a notification. Rejected jobs are never alerted again.',
  },
  {
    name: 'review',
    label: 'Automatic checks — read before publishing',
    widget: 'text',
    required: false,
    hint: 'Shows which values were filled in automatically and the exact text they came from.',
  },
  { name: 'notes', label: 'Admin notes (never shown to users)', widget: 'text', required: false },
  { name: 'title', label: 'Title', widget: 'string', hint: 'In your own words, e.g. "UP Police Constable Recruitment 2026".' },
  {
    name: 'slug',
    label: 'URL slug',
    widget: 'string',
    hint: 'The page address: /jobs/<slug>. Lowercase words and dashes. Changing it on a published job changes its URL.',
  },
  { name: 'organization', label: 'Organisation', widget: 'string' },
  { name: 'level', label: 'Level', widget: 'select', options: [opt('Central', 'central'), opt('State', 'state'), opt('Union Territory', 'ut')] },
  { name: 'state', label: 'State / UT', widget: 'select', options: STATE_OPTIONS, required: false, hint: 'Leave empty for central jobs.' },
  { name: 'category', label: 'Category', widget: 'select', options: CATEGORY_OPTIONS },
  { name: 'postName', label: 'Post name', widget: 'string', required: false },
  { name: 'vacancies', label: 'Vacancies', widget: 'number', value_type: 'int', min: 0, required: false },
  {
    name: 'qualifications',
    label: 'Qualification',
    widget: 'select',
    multiple: true,
    options: QUALIFICATIONS.map((q) => opt(q.label, q.id)),
    required: false,
    hint: 'Leave empty if not clear yet — the job is then shown to everyone in that state.',
  },
  { name: 'ageLimit', label: 'Age limit', widget: 'string', required: false, hint: 'e.g. "18–25 years (relaxation as per rules)"' },
  { name: 'fee', label: 'Application fee', widget: 'string', required: false },
  {
    name: 'dates',
    label: 'Important dates',
    widget: 'object',
    fields: [date('notification', 'Notification date'), date('applyStart', 'Apply from'), date('lastDate', 'Last date'), date('exam', 'Exam date')],
  },
  { name: 'howToApply', label: 'How to apply (your own words)', widget: 'text', required: false },
  {
    name: 'links',
    label: 'Official links',
    widget: 'object',
    fields: [
      { name: 'notification', label: 'Official notification (PDF or page)', widget: 'string' },
      { name: 'official', label: 'Official website', widget: 'string' },
      { name: 'apply', label: 'Apply online link', widget: 'string', required: false },
    ],
  },
  {
    name: 'timeline',
    label: 'Status timeline (admit card, answer key, result…)',
    widget: 'list',
    required: false,
    summary: '{{fields.stage}} {{fields.date}}',
    hint: 'Add an Admit Card / Answer Key / Result entry when it is released: people who saved the job get a notification.',
    fields: [
      { name: 'stage', label: 'Stage', widget: 'select', options: STAGES.map((s) => opt(s.label, s.id)) },
      { ...date('date', 'Date') },
      { name: 'url', label: 'Official link', widget: 'string', required: false },
      { name: 'note', label: 'Note', widget: 'string', required: false },
    ],
  },
  hidden('id'),
  hidden('sourceId'),
  hidden('foundAt'),
  hidden('updatedAt'),
  hidden('publishedAt'),
  hidden('extraction'),
  hidden('sample'),
];

const jobCollection = (name: string, label: string, folder: string, extra: Record<string, unknown> = {}) => ({
  name,
  label,
  label_singular: label.replace(/s$/, ''),
  folder,
  extension: 'json',
  format: 'json',
  identifier_field: 'title',
  slug: '{{slug}}',
  summary: '{{state}} · {{category}} · {{title}}',
  sortable_fields: ['foundAt', 'state', 'category', 'title'],
  view_groups: [
    { label: 'State', field: 'state' },
    { label: 'Category', field: 'category' },
  ],
  view_filters: [
    { label: 'Central jobs', field: 'level', pattern: 'central' },
    { label: 'Has last date', field: 'dates.lastDate', pattern: '\\d' },
  ],
  fields: JOB_FIELDS,
  ...extra,
});

const SOURCE_FIELDS = [
  { name: 'id', label: 'ID', widget: 'string', pattern: ['^[a-z0-9]+(-[a-z0-9]+)*$', 'lowercase letters, digits and single dashes'], hint: 'Never change after the monitor has run.' },
  { name: 'name', label: 'Name', widget: 'string' },
  { name: 'url', label: 'Page to watch', widget: 'string', required: false, hint: 'Official .gov.in / .nic.in page. Empty = not known yet (then Enabled must be off).' },
  { name: 'level', label: 'Level', widget: 'select', options: ['central', 'state', 'ut'] },
  { name: 'state', label: 'State / UT', widget: 'select', options: STATE_OPTIONS, required: false, hint: 'Must match this file. Empty for central.' },
  { name: 'category', label: 'Category', widget: 'select', options: CATEGORY_OPTIONS },
  { name: 'linkFilter', label: 'Job link words', widget: 'list', hint: 'Comma separated, e.g. recruitment, notification, advt, .pdf' },
  { name: 'priority', label: 'Priority', widget: 'select', options: [opt('High (every run)', 'high'), opt('Normal (every second run)', 'normal')] },
  { name: 'enabled', label: 'Enabled', widget: 'boolean', default: true },
  { name: 'verified', label: 'Verified (set automatically by verify-sources)', widget: 'boolean', default: false },
  { name: 'notes', label: 'Notes', widget: 'text', required: false },
  hidden('finalUrl'),
  hidden('lastVerifiedAt'),
];

const sourceFileFields = [
  hidden('level'),
  hidden('state'),
  hidden('name'),
  { name: 'sources', label: 'Sources', widget: 'list', summary: '{{fields.name}} — {{fields.url}}', fields: SOURCE_FIELDS },
];

export function buildCmsConfig(siteUrl: string, repo: string) {
  return {
    backend: {
      name: 'github',
      repo,
      branch: 'main',
      base_url: siteUrl,
      auth_endpoint: 'oauth/auth',
      auth_scope: 'public_repo',
      commit_messages: {
        create: 'admin: add {{collection}} “{{slug}}”',
        update: 'admin: update {{collection}} “{{slug}}”',
        delete: 'admin: delete {{collection}} “{{slug}}”',
        uploadMedia: 'admin: upload “{{path}}”',
        deleteMedia: 'admin: delete “{{path}}”',
      },
    },
    // Lets you try the admin on your computer without GitHub login (npm run admin:local).
    local_backend: { url: 'http://localhost:8082/api/v1' },
    site_url: siteUrl,
    display_url: siteUrl,
    logo_url: '/favicon.ico',
    media_folder: 'public/uploads',
    public_folder: '/uploads',
    editor: { preview: false },
    collections: [
      jobCollection('drafts', 'Draft jobs', 'data/jobs/drafts', {
        description: 'New notices found by the monitor. Check each against the official notification, fix it, then set Status to Published or Rejected.',
        create: true,
        delete: true,
      }),
      jobCollection('published', 'Published jobs', 'data/jobs/published', {
        description: 'Live on the website and in the apps. Add admit card / answer key / result to the timeline when released.',
        create: false,
        delete: false,
      }),
      jobCollection('rejected', 'Rejected', 'data/jobs/rejected', {
        description: 'Not jobs, or duplicates. Kept so they are never alerted again. Set Status to Draft to bring one back.',
        create: false,
        delete: true,
      }),
      {
        name: 'central_sources',
        label: 'Sources — Central',
        files: [{ name: 'central', label: 'Central government sources', file: 'data/sources/central.json', fields: sourceFileFields }],
      },
      {
        name: 'state_sources',
        label: 'Sources — States & UTs',
        folder: 'data/sources/states',
        extension: 'json',
        format: 'json',
        identifier_field: 'name',
        create: false,
        delete: false,
        summary: '{{name}}',
        fields: sourceFileFields,
      },
      {
        name: 'monetization',
        label: 'Sponsored & books',
        files: [
          {
            name: 'sponsored',
            label: 'Sponsored cards',
            file: 'data/monetization/sponsored.json',
            fields: [
              {
                name: 'cards',
                label: 'Sponsored cards',
                widget: 'list',
                summary: '{{fields.title}} ({{fields.active}})',
                hint: 'Always shown with a "Sponsored" label.',
                fields: [
                  { name: 'id', label: 'ID', widget: 'string', pattern: ['^[a-z0-9-]+$', 'lowercase letters, digits and dashes'] },
                  { name: 'title', label: 'Title', widget: 'string' },
                  { name: 'text', label: 'Text', widget: 'text' },
                  { name: 'url', label: 'Link', widget: 'string' },
                  { name: 'cta', label: 'Button text', widget: 'string', default: 'Learn more' },
                  { name: 'image', label: 'Image', widget: 'image', required: false },
                  { name: 'categories', label: 'Show on categories', widget: 'select', multiple: true, options: CATEGORY_OPTIONS, required: false, hint: 'Empty = all.' },
                  { name: 'states', label: 'Show in states', widget: 'select', multiple: true, options: STATE_OPTIONS, required: false, hint: 'Empty = all.' },
                  { ...date('startDate', 'Start date') },
                  { ...date('endDate', 'End date') },
                  { name: 'active', label: 'Active', widget: 'boolean', default: true },
                ],
              },
            ],
          },
          {
            name: 'books',
            label: 'Recommended books',
            file: 'data/monetization/books.json',
            fields: [
              {
                name: 'books',
                label: 'Books (affiliate links)',
                widget: 'list',
                summary: '{{fields.title}} — {{fields.store}}',
                fields: [
                  { name: 'id', label: 'ID', widget: 'string', pattern: ['^[a-z0-9-]+$', 'lowercase letters, digits and dashes'] },
                  { name: 'title', label: 'Title', widget: 'string' },
                  { name: 'author', label: 'Author / publisher', widget: 'string', required: false },
                  { name: 'url', label: 'Affiliate link', widget: 'string' },
                  { name: 'store', label: 'Store', widget: 'select', options: ['Amazon', 'Flipkart', 'Other'] },
                  { name: 'image', label: 'Cover image', widget: 'image', required: false },
                  { name: 'categories', label: 'Show on categories', widget: 'select', multiple: true, options: CATEGORY_OPTIONS, required: false, hint: 'Empty = all.' },
                  { name: 'keywords', label: 'Show on jobs whose title contains', widget: 'list', required: false, hint: 'e.g. SSC GD, Group D' },
                  { name: 'active', label: 'Active', widget: 'boolean', default: true },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
