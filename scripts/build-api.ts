// Usage: npm run build:api        (SAMPLE_JOBS=1 to include sample jobs)
// Writes the static JSON API to public/api/, which is published with the website
// and read by the Android/iOS apps.
import fs from 'node:fs';
import path from 'node:path';
import { apiFiles, publishedJobs } from '../src/server/data';
import { ROOT } from './lib/paths';

const outDir = path.join(ROOT, 'public', 'api');
fs.rmSync(outDir, { recursive: true, force: true });
const files = apiFiles();
for (const [apiPath, data] of files) {
  const file = path.join(ROOT, 'public', apiPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}
console.log(`✓ JSON API: ${files.length} files for ${publishedJobs().length} published jobs → public/api/` + (process.env.SAMPLE_JOBS === '1' ? ' (including sample jobs)' : ''));
