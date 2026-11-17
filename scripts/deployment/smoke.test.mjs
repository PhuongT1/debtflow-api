import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smokeDeployment } from './smoke.mjs';
const schema = {
  openapi: '3.0.0',
  paths: { '/api/auth/login': { post: {} }, '/api/parties': { get: {} } },
};
const api =
  (html = '<script src="./swagger-ui.js"></script>', document = schema) =>
  async () => ({
    ok: true,
    text: async () => html,
    json: async () => document,
  });
test('checks Swagger assets and contract with protection bypass header', async () => {
  const paths = [];
  await smokeDeployment('https://example.vercel.app', 'fixture-only', async (url, options) => {
    paths.push(url.pathname);
    assert.equal(options.headers['x-vercel-protection-bypass'], 'fixture-only');
    return api()(url);
  });
  assert.deepEqual(paths, ['/docs', '/docs/swagger-ui.js', '/docs-json']);
});
test('fails on HTTP errors, protection pages or missing API routes', async () => {
  await assert.rejects(
    smokeDeployment('https://example.vercel.app', '', async () => ({ ok: false, status: 500 })),
    /HTTP 500/,
  );
  await assert.rejects(
    smokeDeployment('https://example.vercel.app', '', api('<h1>Log in</h1>')),
    /assets/,
  );
  await assert.rejects(
    smokeDeployment(
      'https://example.vercel.app',
      '',
      api(undefined, { openapi: '3.0.0', paths: {} }),
    ),
    /routes/,
  );
});
test('skips CDN assets and never sends bypass credentials to their origin', async () => {
  const html =
    '<script src="https://unpkg.com/swagger-ui.js"></script><script src="/docs/swagger-auth.js"></script>';
  await smokeDeployment('https://example.vercel.app', 'fixture-only', async (url) => {
    assert.equal(url.origin, 'https://example.vercel.app');
    return api(html)(url);
  });
});
