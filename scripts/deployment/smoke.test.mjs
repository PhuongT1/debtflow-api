import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smokeDeployment } from './smoke.mjs';
const schema = {
  openapi: '3.0.0',
  paths: { '/api/auth/login': { post: {} }, '/api/parties': { get: {} } },
};
const url = 'https://example.vercel.app';

test('checks the deployed OpenAPI route with the protection bypass header', async () => {
  await smokeDeployment(url, 'fixture-only', async (target, options) => {
    assert.equal(target.href, url + '/docs-json');
    assert.equal(options.headers['x-vercel-protection-bypass'], 'fixture-only');
    assert.equal(options.redirect, 'manual');
    return Response.json(schema);
  });
});

test('blocks promotion on redirect, HTTP error or invalid API contract', async () => {
  for (const status of [302, 401, 500]) {
    await assert.rejects(
      smokeDeployment(url, '', async () => new Response(null, { status })),
      new RegExp(`HTTP ${status}`),
    );
  }
  await assert.rejects(
    smokeDeployment(url, '', async () => new Response('<h1>Login</h1>')),
    /expected JSON/,
  );
  await assert.rejects(
    smokeDeployment(url, '', async () => Response.json({ paths: {} })),
    /routes/,
  );
});

test('reports a failed request with its path and omits the underlying error details', async () => {
  await assert.rejects(
    smokeDeployment(url, '', async () => {
      throw new Error('private request details');
    }),
    /\/docs-json: request failed before an HTTP response/,
  );
});
