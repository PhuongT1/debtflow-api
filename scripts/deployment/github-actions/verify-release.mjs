import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Check the release against the policy selected by the calling workflow.
export async function verifyRelease(policy, env = process.env, request = fetch) {
  const environment = env.RELEASE_ENVIRONMENT;
  if (!Object.hasOwn(policy.environments, environment))
    throw new Error(`Unknown release environment: ${environment ?? '(unset)'}.`);

  const { branch, stagingEvidence } = policy.environments[environment];
  const stagingBranch = stagingEvidence && policy.environments[stagingEvidence.environment]?.branch;
  if (
    !branch ||
    !policy.qualityWorkflow ||
    (stagingEvidence && (!stagingBranch || !stagingEvidence.workflow))
  )
    throw new Error(`Incomplete release policy for ${environment}.`);

  const sha = env.RELEASE_SHA ?? env.GITHUB_SHA;
  if (env.GITHUB_REF !== `refs/heads/${branch}`)
    throw new Error(`Select ${branch} for ${environment}.`);
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
  const head = await get(`commits/${encodeURIComponent(branch)}`);
  if (head.sha !== sha)
    throw new Error('Release SHA must match the current branch head; stale releases are blocked.');
  const ciQuery = new URLSearchParams({ head_sha: sha, branch, event: 'push', per_page: '100' });
  const { workflow_runs: runs } = await get(
    `actions/workflows/${encodeURIComponent(policy.qualityWorkflow)}/runs?${ciQuery}`,
  );
  const latest = (runs ?? [])
    .filter((run) => run.head_sha === sha && run.head_branch === branch && run.event === 'push')
    .sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
  if (!latest || latest.status !== 'completed' || latest.conclusion !== 'success')
    throw new Error(
      `The latest ${policy.qualityWorkflow} push run for this exact SHA must finish successfully.`,
    );
  let stagingUrl;
  if (stagingEvidence) {
    const stagingWorkflow = encodeURIComponent(stagingEvidence.workflow);
    const stagingQuery = new URLSearchParams({
      branch: stagingBranch,
      event: 'workflow_dispatch',
      status: 'success',
      per_page: '100',
    });
    const workflow = await get(`actions/workflows/${stagingWorkflow}`);
    const { workflow_runs: stagingRuns } = await get(
      `actions/workflows/${stagingWorkflow}/runs?${stagingQuery}`,
    );
    const staging = (stagingRuns ?? [])
      .filter((run) => run.status === 'completed' && run.conclusion === 'success')
      .sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
    if (!staging)
      throw new Error(`${stagingEvidence.workflow} must succeed before deploying ${environment}.`);
    if (
      staging.workflow_id !== workflow.id ||
      staging.head_branch !== stagingBranch ||
      staging.event !== 'workflow_dispatch' ||
      staging.status !== 'completed' ||
      staging.conclusion !== 'success' ||
      staging.head_repository?.full_name !== env.GITHUB_REPOSITORY
    )
      throw new Error(
        `Staging evidence must be a successful ${stagingEvidence.workflow} run on ${stagingBranch} in this repository.`,
      );
    const tested = await get(`commits/${staging.head_sha}`);
    if (!head.commit?.tree?.sha || head.commit.tree.sha !== tested.commit?.tree?.sha)
      throw new Error(
        'The release source tree differs from the deployed staging source. Deploy this source to staging first.',
      );
    stagingUrl = staging.html_url;
  }
  return { branch, sha, ciUrl: latest.html_url, stagingUrl };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const policyPath = process.argv[2];
    if (!policyPath) throw new Error('Usage: node verify-release.mjs <release-policy.json>');
    const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
    const release = await verifyRelease(policy);
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
