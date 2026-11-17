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

const account = { email: 'smoke@example.test', password: 'fixture-only', organizationId: 'org-a' };
const authenticatedApi =
  (override = {}) =>
  async (url, options) => {
    let value;
    if (url.pathname === '/api/auth/login') {
      assert.deepEqual(JSON.parse(options.body), account);
      value = {
        success: true,
        data: {
          accessToken: 'fixture-token',
          user: { id: 'user-a' },
          activeOrganization: { id: 'org-a' },
        },
      };
    } else if (url.pathname === '/api/auth/me') {
      assert.equal(options.headers.Authorization, 'Bearer fixture-token');
      value = { success: true, data: { id: 'user-a' } };
    } else if (url.pathname === '/api/parties') {
      if (!options.headers.Authorization) return { ok: false, status: 401 };
      value = {
        success: true,
        data: [{ organizationId: 'org-a' }],
        meta: { pagination: { page: 1, pageSize: 1, total: 2 } },
      };
    } else return api()(url, options);
    return { ok: true, status: 200, json: async () => override[url.pathname] ?? value };
  };
test('authenticated smoke checks login, identity, missing-token rejection and tenant-scoped DB list', async () => {
  assert.match(
    await smokeDeployment('https://example.vercel.app', '', authenticatedApi(), account),
    /Party DB read passed/,
  );
});
test('rejects wrong login tenant, wrong identity and wrong Party tenant or pagination', async () => {
  for (const override of [
    {
      '/api/auth/login': {
        success: true,
        data: {
          accessToken: 'fixture-token',
          user: { id: 'user-a' },
          activeOrganization: { id: 'other' },
        },
      },
    },
    { '/api/auth/me': { success: true, data: { id: 'other' } } },
    {
      '/api/parties': {
        success: true,
        data: [{ organizationId: 'other' }],
        meta: { pagination: { page: 1, pageSize: 1, total: 2 } },
      },
    },
    {
      '/api/parties': {
        success: true,
        data: [],
        meta: { pagination: { page: 1, pageSize: 20, total: 0 } },
      },
    },
  ])
    await assert.rejects(
      smokeDeployment('https://example.vercel.app', '', authenticatedApi(override), account),
      /expected organization|does not match|contract failed/,
    );
});
test('rejects missing account config and an unprotected Party endpoint', async () => {
  await assert.rejects(
    smokeDeployment('https://example.vercel.app', '', api(), {}),
    /account.*required/,
  );
  const client = authenticatedApi();
  await assert.rejects(
    smokeDeployment(
      'https://example.vercel.app',
      '',
      (url, options) =>
        url.pathname === '/api/parties' && !options.headers.Authorization
          ? { ok: true, status: 200 }
          : client(url, options),
      account,
    ),
    /HTTP 200/,
  );
});
