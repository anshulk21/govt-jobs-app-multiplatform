import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES, LEVELS, PRIORITIES, STATE_BY_CODE } from '../../src/core/constants';
import type { Source, SourceFile } from '../../src/core/types';
import { SOURCES_DIR, STATE_SOURCES_DIR } from './paths';

export interface LoadedSourceFile {
  /** Absolute path of the JSON file. */
  file: string;
  data: SourceFile;
}

export function sourceFilePaths(sourcesDir = SOURCES_DIR): string[] {
  const statesDir = sourcesDir === SOURCES_DIR ? STATE_SOURCES_DIR : path.join(sourcesDir, 'states');
  const stateFiles = fs
    .readdirSync(statesDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(statesDir, f));
  return [path.join(sourcesDir, 'central.json'), ...stateFiles];
}

export function loadSourceFiles(sourcesDir = SOURCES_DIR): LoadedSourceFile[] {
  return sourceFilePaths(sourcesDir).map((file) => {
    try {
      return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) as SourceFile };
    } catch (err) {
      throw new Error(`Could not parse ${file}: ${(err as Error).message}`);
    }
  });
}

export function allSources(files: LoadedSourceFile[]): Source[] {
  return files.flatMap((f) => f.data.sources);
}

export function saveSourceFile(f: LoadedSourceFile): void {
  fs.writeFileSync(f.file, JSON.stringify(f.data, null, 2) + '\n');
}

const GOV_HOST = /(\.gov\.in|\.nic\.in)$/i;

export function isGovDomain(url: string): boolean {
  try {
    return GOV_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Checks every source file for mistakes a hand edit could introduce.
 * Returns human-readable error messages; an empty array means all good.
 */
export function validateSourceFiles(files: LoadedSourceFile[]): string[] {
  const errors: string[] = [];
  const seenIds = new Map<string, string>();

  for (const { file, data } of files) {
    const name = path.join(path.basename(path.dirname(file)), path.basename(file));
    const err = (msg: string) => errors.push(`${name}: ${msg}`);
    const expectedState = path.basename(file) === 'central.json' ? null : path.basename(file, '.json').toUpperCase();

    if (!data || !Array.isArray(data.sources)) {
      err('must be an object with a "sources" array');
      continue;
    }
    if (data.state !== expectedState) err(`"state" should be ${JSON.stringify(expectedState)}`);
    if (expectedState && !STATE_BY_CODE.has(expectedState)) err(`unknown state/UT code ${expectedState}`);
    const expectedLevel = expectedState ? STATE_BY_CODE.get(expectedState)?.level : 'central';

    data.sources.forEach((s, i) => {
      const where = `source #${i + 1} (${s?.id ?? 'no id'})`;
      const e = (msg: string) => err(`${where}: ${msg}`);

      if (typeof s.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) {
        e('"id" must be lowercase letters, digits and single dashes');
      } else if (seenIds.has(s.id)) {
        e(`duplicate id, also used in ${seenIds.get(s.id)}`);
      } else {
        seenIds.set(s.id, name);
      }
      if (typeof s.name !== 'string' || !s.name.trim()) e('"name" is required');
      if (!LEVELS.includes(s.level)) e(`"level" must be one of ${LEVELS.join(', ')}`);
      else if (s.level !== expectedLevel) e(`"level" should be "${expectedLevel}" in this file`);
      if (s.state !== expectedState) e(`"state" should be ${JSON.stringify(expectedState)} in this file`);
      if (!CATEGORIES.includes(s.category)) e(`"category" must be one of: ${CATEGORIES.join(', ')}`);
      if (!PRIORITIES.includes(s.priority)) e(`"priority" must be one of ${PRIORITIES.join(', ')}`);
      if (typeof s.enabled !== 'boolean') e('"enabled" must be true or false');
      if (typeof s.verified !== 'boolean') e('"verified" must be true or false');
      if (!Array.isArray(s.linkFilter) || s.linkFilter.length === 0 || s.linkFilter.some((k) => typeof k !== 'string' || !k)) {
        e('"linkFilter" must be a non-empty list of words');
      }

      if (typeof s.url !== 'string') {
        e('"url" must be a string (use "" if unknown)');
      } else if (s.url === '') {
        if (s.enabled) e('"enabled" must be false while "url" is empty');
      } else {
        try {
          const u = new URL(s.url);
          if (u.protocol !== 'https:' && u.protocol !== 'http:') e('"url" must start with https:// or http://');
        } catch {
          e(`"url" is not a valid URL: ${s.url}`);
        }
      }
    });
  }
  return errors;
}
