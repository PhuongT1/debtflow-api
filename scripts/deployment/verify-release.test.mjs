import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  event: 'push',
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
    json: async () => (url.includes('/commits/') ? { sha: head } : { workflow_runs: runs }),
  });

test('accepts exact branch head with successful push CI', async () => {
  assert.equal((await verifyRelease(env, api())).sha, sha);
});
test('production accepts only main', async () => {
  await assert.rejects(
    verifyRelease({ ...env, RELEASE_ENVIRONMENT: 'production' }, api()),
    /Select develop/,
  );
});
test('rejects partial SHA and stale branch head', async () => {
  await assert.rejects(verifyRelease({ ...env, RELEASE_SHA: 'aaaa' }, api()), /40-character/);
  await assert.rejects(verifyRelease(env, api([run], 'b'.repeat(40))), /stale/);
});
test('failed or pending rerun cannot be bypassed by an older success', async () => {
  for (const state of [
    { status: 'in_progress', conclusion: null },
    { status: 'completed', conclusion: 'failure' },
  ]) {
    await assert.rejects(
      verifyRelease(env, api([run, { ...run, run_attempt: 2, ...state }])),
      /latest API quality/,
    );
  }
});
test('rejects missing or wrong-event CI and GitHub API failure', async () => {
  for (const runs of [
    [],
    [{ ...run, event: 'pull_request' }],
    [{ ...run, head_sha: 'b'.repeat(40) }],
  ])
    await assert.rejects(verifyRelease(env, api(runs)), /latest API quality/);
  await assert.rejects(
    verifyRelease(env, async () => ({ ok: false, status: 403 })),
    /HTTP 403/,
  );
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
  assert.equal((await verifyRelease(production, productionApi(evidence))).sha, sha);
  await assert.rejects(
    verifyRelease(production, productionApi(null)),
    /Deploy staging must succeed/,
  );
  await assert.rejects(
    verifyRelease(production, productionApi(evidence, 'different-tree')),
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
      verifyRelease(production, productionApi({ ...staging, ...override })),
      /Staging evidence|Deploy staging must succeed/,
    );
});
test('workflow context must match the selected commit', async () => {
  await assert.rejects(
    verifyRelease({ ...env, GITHUB_SHA: 'd'.repeat(40) }, api()),
    /Workflow commit/,
  );
});
test('uses the workflow commit without a manually entered SHA', async () => {
  const { RELEASE_SHA, ...automatic } = env;
  assert.equal((await verifyRelease(automatic, api())).sha, sha);
});
