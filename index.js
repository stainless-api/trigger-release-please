const core = require('@actions/core');
const fetch = require('node-fetch').default;

const BASE_URL = 'https://api.stainlessapi.com/api';

async function main() {
  const fullRepo = core.getInput('repo');
  const [owner, repo] = fullRepo.split('/');

  if (!owner || !repo) {
    throw new Error(`Could not resolve owner and repo name from ${fullRepo}`);
  }

  const apiKey = core.getInput('stainless-api-key');
  if (!apiKey) {
    throw new Error('Missing stainless-api-key input');
  }

  const branchWithChanges = core.getInput('branch-with-changes');

  console.log(`Running Release Please with`, { owner, repo, branchWithChanges });

  const res = await fetch(`${BASE_URL}/trigger-release-please`, {
    method: 'POST',
    body: JSON.stringify({
      owner,
      repo,
      ...(branchWithChanges ? { branchWithChanges } : {}),
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();

  const data = safeJson(text);
  if (data instanceof Error) {
    throw new Error(`Could not process API response. text=${text} data=${data} status=${res.status}`);
  }

  console.log('API Response', data);

  if (data?.error) {
    throw new Error(`API Error ${res.status} - ${data.error}`);
  }

  if (!res.ok) {
    throw new Error(`API Error ${res.status} - ${data}`);
  }

  if (data?.releases?.length) {
    core.setOutput('releases_created', true);
    outputReleases(data.releases);
  }
}

/**
 * Returns an `Error` object if parsing the given JSON string fails instead of throwing
 */
function safeJson(input) {
  try {
    return JSON.parse(input);
  } catch (err) {
    return new Error(err);
  }
}

/**
 * @param {string} path
 * @param {string} key
 * @param {(string | boolean)} value
 */
function setPathOutput(path, key, value) {
  if (path === '.') {
    core.setOutput(key, value);
  } else {
    core.setOutput(`${path}--${key}`, value);
  }
}

/**
 * Add specific outputs for each release.
 *
 * Most notable is the `paths_released` output which
 * makes it easy to build automations around monorepo setups.
 */
function outputReleases(releases) {
  releases = releases.filter(Boolean);

  const pathsReleased = [];

  for (const release of releases) {
    if (!release.path) {
      console.warn('Release has no path', release);
    }

    const path = release.path || '.';
    pathsReleased.push(path);

    for (const [rawKey, value] of Object.entries(release)) {
      let key = rawKey;
      if (key === 'tagName') key = 'tag_name';
      if (key === 'uploadUrl') key = 'upload_url';
      if (key === 'notes') key = 'body';
      if (key === 'url') key = 'html_url';
      setPathOutput(path, key, value);
    }
  }

  // Paths of all releases that were created, so that they can be passed
  // to the next step:
  core.setOutput('paths_released', JSON.stringify(pathsReleased));
}

main().catch((err) => {
  core.setFailed(`trigger-release-please failed: ${err.message}`);
});
