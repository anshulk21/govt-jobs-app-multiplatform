// Paths of the static JSON API published with the website. The apps read these.
import type { StageId } from './constants';

export const apiPaths = {
  latest: '/api/jobs/latest.json',
  job: (slug: string) => `/api/jobs/${slug}.json`,
  state: (code: string) => `/api/jobs/state/${code}.json`,
  category: (slug: string) => `/api/jobs/category/${slug}.json`,
  qualification: (id: string) => `/api/jobs/qualification/${id}.json`,
  updates: (stage: StageId) => `/api/jobs/updates/${stage}.json`,
};
