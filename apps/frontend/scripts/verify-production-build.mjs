import { readdir, readFile } from 'node:fs/promises';

const browserOutput = new URL('../dist/frontend/browser/', import.meta.url);
const expectedApiUrl = 'https://api.jobthreader.com/api/v1';
const bundles = (await readdir(browserOutput)).filter((name) => name.endsWith('.js'));
let foundExpectedApiUrl = false;

for (const name of bundles) {
  const source = await readFile(new URL(name, browserOutput), 'utf8');
  if (/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/api\//i.test(source)) {
    throw new Error(`Production bundle ${name} contains a loopback API URL.`);
  }
  // Check the whole URL literal, not just a prefix of a different URL.
  foundExpectedApiUrl ||= ['"', "'", '`'].some((quote) =>
    source.includes(`${quote}${expectedApiUrl}${quote}`),
  );
}

if (!foundExpectedApiUrl) {
  throw new Error(`Production bundles must contain the API base URL ${expectedApiUrl}.`);
}

console.log(`Verified production API base URL: ${expectedApiUrl}`);
