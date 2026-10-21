import path from 'node:path';

export const ROOT = path.resolve(__dirname, '..', '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const SOURCES_DIR = path.join(DATA_DIR, 'sources');
export const STATE_SOURCES_DIR = path.join(SOURCES_DIR, 'states');
export const REPORTS_DIR = path.join(ROOT, 'reports');
