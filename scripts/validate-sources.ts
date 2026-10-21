// Usage: npm run validate-sources
// Checks data/sources/**/*.json for typos and schema mistakes. Run after editing sources.
import { allSources, loadSourceFiles, validateSourceFiles } from './lib/sources';

const files = loadSourceFiles();
const errors = validateSourceFiles(files);
const sources = allSources(files);

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in source files:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const enabled = sources.filter((s) => s.enabled).length;
console.log(`✓ ${files.length} files, ${sources.length} sources (${enabled} enabled, ${sources.length - enabled} TODO/disabled). All valid.`);
