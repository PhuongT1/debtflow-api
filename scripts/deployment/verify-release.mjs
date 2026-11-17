import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Verify the selected branch head and its latest push CI before exposing release credentials.
export async function verifyRelease(env = process.env, request = fetch) {
  const branch = { staging: 'develop', production: 'main' }[env.RELEASE_ENVIRONMENT];
  const sha = env.RELEASE_SHA;
  if (!branch || env.GITHUB_REF !== `refs/heads/${branch}`)
    throw new Error('Select develop for staging or main for production.');
  if (!/^[a-f0-9]{40}$/.test(sha ?? ''))
    throw new Error('A full 40-character commit SHA is required.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? '') || !env.GH_TOKEN)
    throw new Error('GitHub repository and read token are required.');
  const get = async (path) => {
    const response = await request(
      `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${env.GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) throw new Error(`GitHub verification failed: HTTP ${response.status}.`);
    return response.json();
  };
  if (env.GITHUB_SHA !== sha)
    throw new Error(
      'Workflow commit differs from release SHA. Start a new run on the current branch head.',
    );
  const head = await get(`commits/${branch}`);
  if (head.sha !== sha)
    throw new Error('Release SHA must match the current branch head; stale releases are blocked.');
  const { workflow_runs: runs } = await get(
    `actions/workflows/quality.yml/runs?head_sha=${sha}&branch=${branch}&event=push&per_page=100`,
  );
  const latest = (runs ?? [])
    .filter((run) => run.head_sha === sha && run.head_branch === branch && run.event === 'push')
    .sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
  if (!latest || latest.status !== 'completed' || latest.conclusion !== 'success')
    throw new Error('The latest API quality push run for this exact SHA must finish successfully.');
  let stagingUrl;
  if (branch === 'main') {
    if (!/^[1-9]\d*$/.test(env.STAGING_RUN_ID ?? ''))
      throw new Error('Production requires the successful staging Deploy API run ID.');
    const staging = await get(`actions/runs/${env.STAGING_RUN_ID}`);
    const workflow = await get('actions/workflows/deploy.yml');
    if (
      staging.workflow_id !== workflow.id ||
      staging.head_branch !== 'develop' ||
      staging.event !== 'workflow_dispatch' ||
      staging.status !== 'completed' ||
      staging.conclusion !== 'success' ||
      staging.head_repository?.full_name !== env.GITHUB_REPOSITORY
    )
      throw new Error(
        'Staging evidence must be a successful Deploy API run on develop in this repository.',
      );
    const tested = await get(`commits/${staging.head_sha}`);
    if (!head.commit?.tree?.sha || head.commit.tree.sha !== tested.commit?.tree?.sha)
      throw new Error(
        'Production source tree differs from the tested staging release. Deploy this source to staging first.',
      );
    stagingUrl = staging.html_url;
  }
  return { branch, sha, ciUrl: latest.html_url, stagingUrl };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const release = await verifyRelease();
    console.log(`Verified ${release.branch} at ${release.sha}; CI: ${release.ciUrl}`);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `\nRelease: ${release.branch} @ ${release.sha}\n\nCI: ${release.ciUrl}\n\nStaging: ${release.stagingUrl ?? 'this run'}\n`,
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
