import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Check the deployed Swagger page, its local assets and the expected OpenAPI routes.
export async function smokeDeployment(url, bypass, request = fetch, account) {
  const base = new URL(url);
  if (base.protocol !== 'https:') throw new Error('Deployment URL must use HTTPS.');
  const headers = bypass ? { 'x-vercel-protection-bypass': bypass } : {};
  const get = async (path, options = {}, expectedStatus) => {
    const target = new URL(path, base);
    if (target.origin !== base.origin)
      throw new Error('Smoke checks must stay on the deployment origin.');
    const response = await request(target, {
      ...options,
      headers: { ...headers, ...options.headers },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (expectedStatus ? response.status !== expectedStatus : !response.ok)
      throw new Error(`Smoke check ${target.pathname}: HTTP ${response.status}.`);
    if (response.url && new URL(response.url).origin !== base.origin)
      throw new Error('Smoke check redirected away from the deployment.');
    return response;
  };
  const html = await (await get('/docs')).text();
  const assets = [
    ...html.matchAll(/(?:src|href)=["']([^"']*swagger[^"']*\.(?:js|css)(?:\?[^"']*)?)["']/g),
  ]
    .map((match) => new URL(match[1], new URL('/docs/', base)))
    .filter((asset) => asset.origin === base.origin)
    .map((asset) => asset.href);
  if (!assets.length)
    throw new Error('Swagger assets were not found; check routing or deployment protection.');
  for (const asset of new Set(assets)) await get(asset);
  const schema = await (await get('/docs-json')).json();
  if (
    !schema.openapi ||
    !schema.paths?.['/api/auth/login']?.post ||
    !schema.paths?.['/api/parties']?.get
  )
    throw new Error('OpenAPI is missing expected auth/parties routes.');
  if (account) {
    const { email, password, organizationId } = account;
    if (!email || !password || !organizationId)
      throw new Error('Smoke account email, password and organization ID are required.');
    const session = await (
      await get('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, organizationId }),
      })
    ).json();
    if (
      session.success !== true ||
      !session.data?.accessToken ||
      !session.data?.user?.id ||
      session.data.activeOrganization?.id !== organizationId
    )
      throw new Error('Login did not return a session for the expected organization.');
    const auth = { headers: { Authorization: `Bearer ${session.data.accessToken}` } };
    const me = await (await get('/api/auth/me', auth)).json();
    if (me.success !== true || me.data?.id !== session.data.user.id)
      throw new Error('Authenticated user does not match the smoke account.');
    await get('/api/parties?page=1&pageSize=1', {}, 401);
    const parties = await (await get('/api/parties?page=1&pageSize=1', auth)).json();
    const page = parties.meta?.pagination;
    if (
      parties.success !== true ||
      !Array.isArray(parties.data) ||
      parties.data.length > 1 ||
      !parties.data.every((item) => item.organizationId === organizationId) ||
      page?.page !== 1 ||
      page?.pageSize !== 1 ||
      !Number.isInteger(page?.total) ||
      page.total < parties.data.length
    )
      throw new Error('Party list tenant or pagination contract failed.');
  }
  return account
    ? 'Swagger, login, identity, protected access and Party DB read passed.'
    : 'Swagger and OpenAPI passed; authenticated smoke was not requested.';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(
      await smokeDeployment(
        process.env.DEPLOYMENT_URL,
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        fetch,
        {
          email: process.env.SMOKE_TEST_EMAIL,
          password: process.env.SMOKE_TEST_PASSWORD,
          organizationId: process.env.SMOKE_TEST_ORGANIZATION_ID,
        },
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
