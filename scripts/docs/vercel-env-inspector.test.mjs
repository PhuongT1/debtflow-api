import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import {
  buildVercelEnvUrl,
  createInspectorMiddleware,
  inspectorPath,
} from './vercel-env-inspector.mjs';

const input = {
  project: 'debtflow-api',
  team: 'team_fixture',
  target: 'preview',
  branch: 'feature/test',
  token: 'fixture-only',
};
test('only builds fixed Vercel GET endpoints with encoded preview branch and team', () => {
  const url = buildVercelEnvUrl({ ...input, action: 'pull' });
  assert.equal(url.origin, 'https://api.vercel.com');
  assert.equal(url.pathname, '/v3/env/pull/debtflow-api/preview/feature%2Ftest');
  assert.equal(url.searchParams.get('teamId'), 'team_fixture');
  assert.equal(
    buildVercelEnvUrl({ ...input, action: 'list', team: 'tran-phuongs-projects' }).searchParams.get(
      'slug',
    ),
    'tran-phuongs-projects',
  );
  assert.equal(
    buildVercelEnvUrl({ ...input, target: 'production', action: 'pull' }).pathname,
    '/v3/env/pull/debtflow-api/production',
  );
  assert.equal(
    buildVercelEnvUrl({ ...input, action: 'read', id: 'env_fixture' }).pathname,
    '/v1/projects/debtflow-api/env/env_fixture',
  );
  for (const override of [
    { project: '../x' },
    { action: 'delete' },
    { target: 'evil' },
    { action: 'read', id: '../x' },
  ])
    assert.throws(() => buildVercelEnvUrl({ ...input, action: 'list', ...override }));
});

test('local middleware preserves response, rejects foreign origin and hides upstream errors', async () => {
  const calls = [];
  const middleware = createInspectorMiddleware(async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 3) throw new Error('fixture-secret-should-not-leak');
    return {
      ok: true,
      status: 200,
      json: async () =>
        url.pathname.startsWith('/v10/')
          ? {
              envs: [
                { key: 'DATABASE_URL', target: ['preview'], gitBranch: null },
                { key: 'test', target: ['preview'], gitBranch: input.branch },
                { key: 'other', target: ['preview'], gitBranch: 'other' },
              ],
            }
          : { env: { DATABASE_URL: '', JWT_SECRET: '[SENSITIVE]' } },
    };
  });
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 404;
      res.end();
    }),
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const send = (headers = {}, body = { ...input, action: 'pull' }) =>
    fetch(origin + inspectorPath, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await send({ Origin: 'https://foreign.example' })).status, 403);
    assert.equal(calls.length, 0);
    assert.equal(
      (await send({}, { ...input, project: 'https://evil.example', action: 'list' })).status,
      400,
    );
    const response = await send();
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const { data } = await response.json();
    assert.equal(data.env.JWT_SECRET, '[SENSITIVE]');
    assert.deepEqual(data.configuredKeys, ['DATABASE_URL', 'test']);
    assert.equal(calls[1].url.searchParams.has('gitBranch'), false);
    assert.equal(calls[0].options.method, 'GET');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer fixture-only');
    const failure = await send();
    assert.equal(failure.status, 502);
    assert.ok(!(await failure.text()).includes('fixture-secret-should-not-leak'));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
