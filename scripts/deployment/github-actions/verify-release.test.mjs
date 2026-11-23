import { test } from 'node:test';
import assert from 'node:assert/strict';
import vercelPolicy from '../vercel/release-policy.json' with { type: 'json' };
import { verifyRelease } from './verify-release.mjs';

const sha = 'a'.repeat(40);
const env = {
  RELEASE_ENVIRONMENT: 'staging',
  RELEASE_SHA: sha,
  GITHUB_SHA: sha,
  GITHUB_REF: 'refs/heads/develop',
  GITHUB_REPOSITORY: 'team/api',
  GH_TOKEN: 'fixture-only',
};
const run = {
  head_sha: sha,
  head_branch: 'develop',
  event: 'workflow_dispatch',
  run_number: 2,
  run_attempt: 1,
  status: 'completed',
  conclusion: 'success',
  html_url: 'https://github.com/team/api/actions/runs/2',
};
const api =
  (runs = [run], head = sha) =>
  async (url) => ({
    ok: true,
    json: async () =>
      url.endsWith('/pulls')
        ? []
        : url.includes('/commits/')
          ? { sha: head }
          : { workflow_runs: runs },
  });

test('accepts exact branch head with successful manual CI', async () => {
  assert.equal((await verifyRelease(vercelPolicy, env, api())).sha, sha);
});
test('production accepts only main', async () => {
  await assert.rejects(
    verifyRelease(vercelPolicy, { ...env, RELEASE_ENVIRONMENT: 'production' }, api()),
    /Select main for production/,
  );
});
test('rejects partial SHA and stale branch head', async () => {
  await assert.rejects(
    verifyRelease(vercelPolicy, { ...env, RELEASE_SHA: 'aaaa' }, api()),
    /40-character/,
  );
  await assert.rejects(verifyRelease(vercelPolicy, env, api([run], 'b'.repeat(40))), /stale/);
});
test('failed or pending rerun cannot be bypassed by an older success', async () => {
  for (const state of [
    { status: 'in_progress', conclusion: null },
    { status: 'completed', conclusion: 'failure' },
  ]) {
    await assert.rejects(
      verifyRelease(vercelPolicy, env, api([run, { ...run, run_attempt: 2, ...state }])),
      /successful quality\.yml/,
    );
  }
});
test('rejects missing or wrong-event CI and GitHub API failure', async () => {
  for (const runs of [
    [],
    [{ ...run, event: 'pull_request' }],
    [{ ...run, head_sha: 'b'.repeat(40) }],
  ])
    await assert.rejects(verifyRelease(vercelPolicy, env, api(runs)), /successful quality\.yml/);
  await assert.rejects(
    verifyRelease(vercelPolicy, env, async () => ({ ok: false, status: 403 })),
    /HTTP 403/,
  );
});

const prHead = 'b'.repeat(40);
const testedMerge = 'd'.repeat(40);
const pull = {
  number: 27,
  merged_at: '2026-11-23T00:00:00Z',
  merge_commit_sha: sha,
  base: { ref: 'develop', repo: { full_name: 'team/api' } },
  head: { sha: prHead },
};
const prRun = {
  ...run,
  head_sha: prHead,
  event: 'pull_request',
  display_title: `API quality PR #27 at ${testedMerge}`,
};
const pullRequestApi =
  ({
    pulls = [pull],
    runs = [prRun],
    testedTree = 'release-tree',
    testedStatus = 200,
    testedParent = prHead,
  } = {}) =>
  async (url) => {
    const responses = new Map([
      ['/commits/develop', { sha, commit: { tree: { sha: 'release-tree' } } }],
      [`/commits/${sha}/pulls`, pulls],
      [
        `/actions/workflows/quality.yml/runs?head_sha=${sha}&branch=develop&event=workflow_dispatch`,
        { workflow_runs: [] },
      ],
      [
        `/actions/workflows/quality.yml/runs?head_sha=${prHead}&event=pull_request&per_page=100`,
        { workflow_runs: runs },
      ],
      [
        `/commits/${testedMerge}`,
        { parents: [{ sha }, { sha: testedParent }], commit: { tree: { sha: testedTree } } },
      ],
    ]);
    const route = url.split('/repos/team/api')[1];
    assert.ok(responses.has(route), `Unexpected GitHub API request: ${route}`);
    const status = route === `/commits/${testedMerge}` ? testedStatus : 200;
    return { ok: status === 200, status, json: async () => responses.get(route) };
  };

test('accepts CI from the merged PR when its tested source tree matches the release', async () => {
  assert.equal((await verifyRelease(vercelPolicy, env, pullRequestApi())).ciUrl, prRun.html_url);
});

test('rejects stale or unrelated PR evidence and requires a manual check', async () => {
  for (const options of [
    { pulls: [{ ...pull, merge_commit_sha: prHead }] },
    { pulls: [{ ...pull, merged_at: null }] },
    { runs: [{ ...prRun, display_title: `API quality PR #28 at ${testedMerge}` }] },
    { runs: [prRun, { ...prRun, run_attempt: 2, conclusion: 'failure' }] },
    { testedTree: 'different-tree' },
    { testedParent: sha },
    { testedStatus: 404 },
  ]) {
    await assert.rejects(
      verifyRelease(vercelPolicy, env, pullRequestApi(options)),
      /Run API quality manually on develop/,
    );
  }
});

const production = {
  ...env,
  RELEASE_ENVIRONMENT: 'production',
  GITHUB_REF: 'refs/heads/main',
};
const staging = {
  ...run,
  workflow_id: 7,
  event: 'workflow_dispatch',
  head_repository: { full_name: 'team/api' },
};
const productionApi =
  (evidence = staging, tree = 'tree-a') =>
  async (url) => ({
    ok: true,
    json: async () =>
      url.includes('/actions/workflows/deploy-staging.yml/runs?')
        ? { workflow_runs: evidence ? [evidence] : [] }
        : url.endsWith('/actions/workflows/deploy-staging.yml')
          ? { id: 7 }
          : url.endsWith('/commits/main')
            ? { sha, commit: { tree: { sha: 'tree-a' } } }
            : url.includes('/commits/')
              ? { commit: { tree: { sha: tree } } }
              : { workflow_runs: [{ ...run, head_branch: 'main' }] },
  });
test('production requires successful staging of the same tree even with a different commit SHA', async () => {
  const evidence = { ...staging, head_sha: 'c'.repeat(40) };
  assert.equal((await verifyRelease(vercelPolicy, production, productionApi(evidence))).sha, sha);
  await assert.rejects(
    verifyRelease(vercelPolicy, production, productionApi(null)),
    /deploy-staging\.yml must succeed/,
  );
  await assert.rejects(
    verifyRelease(vercelPolicy, production, productionApi(evidence, 'different-tree')),
    /source tree differs/,
  );
});
test('rejects failed, running, foreign, wrong branch or wrong workflow staging evidence', async () => {
  for (const override of [
    { conclusion: 'failure' },
    { status: 'in_progress' },
    { head_branch: 'main' },
    { workflow_id: 8 },
    { event: 'push' },
    { head_repository: { full_name: 'other/api' } },
  ])
    await assert.rejects(
      verifyRelease(vercelPolicy, production, productionApi({ ...staging, ...override })),
      /Staging evidence|deploy-staging\.yml must succeed/,
    );
});
test('workflow context must match the selected commit', async () => {
  await assert.rejects(
    verifyRelease(vercelPolicy, { ...env, GITHUB_SHA: 'd'.repeat(40) }, api()),
    /Workflow commit/,
  );
});
test('uses the workflow commit without a manually entered SHA', async () => {
  const { RELEASE_SHA, ...automatic } = env;
  assert.equal((await verifyRelease(vercelPolicy, automatic, api())).sha, sha);
});

test('uses the CI and staging workflow configured for the selected deployment target', async () => {
  const policy = {
    qualityWorkflow: 'container-quality.yml',
    environments: {
      'container-staging': { branch: 'release/candidate' },
      'container-production': {
        branch: 'main',
        stagingEvidence: { environment: 'container-staging', workflow: 'deploy-ecs-staging.yml' },
      },
    },
  };
  const evidence = { ...staging, head_sha: 'c'.repeat(40), head_branch: 'release/candidate' };
  const context = { ...production, RELEASE_ENVIRONMENT: 'container-production' };
  const tree = { commit: { tree: { sha: 'same-tree' } } };
  const responses = new Map([
    ['/commits/main', { sha, ...tree }],
    [
      `/actions/workflows/container-quality.yml/runs?head_sha=${sha}&branch=main&event=workflow_dispatch`,
      { workflow_runs: [{ ...run, head_branch: 'main' }] },
    ],
    ['/actions/workflows/deploy-ecs-staging.yml', { id: 7 }],
    [
      '/actions/workflows/deploy-ecs-staging.yml/runs?branch=release%2Fcandidate&event=workflow_dispatch&status=success&per_page=100',
      { workflow_runs: [evidence] },
    ],
    [`/commits/${evidence.head_sha}`, tree],
  ]);
  const request = async (url) => {
    const route = url.split('/repos/team/api')[1];
    assert.ok(responses.has(route), `Unexpected GitHub API request: ${route}`);
    return { ok: true, json: async () => responses.get(route) };
  };

  assert.equal((await verifyRelease(policy, context, request)).stagingUrl, evidence.html_url);
});

test('rejects an unknown release environment before contacting GitHub', async () => {
  await assert.rejects(
    verifyRelease(vercelPolicy, { ...env, RELEASE_ENVIRONMENT: 'toString' }, () => {
      assert.fail('Unknown environments must be rejected before any GitHub API call');
    }),
    /Unknown release environment/,
  );
});
