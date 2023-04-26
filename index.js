const core = require('@actions/core');

const BASE_URL = 'http://localhost:3000/api';

async function main() {
  const fullRepo = core.getInput('repo');
  const [owner, repo] = fullRepo.split('/');

  if (!owner || !repo) {
    throw new Error(`Could not resolve owner and repo name from ${fullRepo}`);
  }

  const apiKey = core.getInput('stainless-api-key');
  if (!apiKey) {
    // TODO: check if redundant
    throw new Error('Missing stainless-api-key input');
  }

  console.log(`Running Release Please with`, { owner, repo });

  const res = await fetch(`${BASE_URL}/trigger-release-please`, {
    method: 'POST',
    body: {
      owner,
      repo,
    },
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const text = await res.text();

  const data = safeJson(text);
  if (data instanceof Error) {
    throw new Error(`Could not process API response. ${text}`);
  }

  if (data?.error) {
    throw new Error(`API Error ${res.status} - ${data.error}`);
  }

  if (data?.releases?.length) {
    core.setOutput('releases_created', true);
  }
}

/**
 * Returns an `Error` object if parsing the given JSON string fails instead of throwing
 */
function safeJson(input) {
  try {
    return JSON.parse(input);
  } catch (err) {
    console.log('NICE');
    return new Error(err);
  }
}

main().catch((err) => {
  core.setFailed(`trigger-release-please failed: ${err.message}`);
});
