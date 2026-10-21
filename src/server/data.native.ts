// The apps never read files at build time; they fetch the JSON API instead.
// This stand-in keeps Node-only code (node:fs) out of the iOS/Android bundles.
const notOnNative = () => {
  throw new Error('src/server/data is build-time only (web static rendering).');
};
export const publishedJobs = notOnNative;
export const getJob = notOnNative;
export const apiFiles = notOnNative;
export const pageTitleFor = notOnNative;
export const payloads = {
  latest: notOnNative,
  job: notOnNative,
  state: notOnNative,
  category: notOnNative,
  qualification: notOnNative,
  updates: notOnNative,
};
