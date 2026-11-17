import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Check the deployed Swagger page, its local assets and the expected OpenAPI routes.
export async function smokeDeployment(url, bypass, request = fetch) {
  const base = new URL(url);
  if (base.protocol !== 'https:') throw new Error('Deployment URL must use HTTPS.');
  const headers = bypass ? { 'x-vercel-protection-bypass': bypass } : {};
  const get = async (path) => {
    const target = new URL(path, base);
    if (target.origin !== base.origin)
      throw new Error('Smoke checks must stay on the deployment origin.');
    const response = await request(target, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
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
  return 'Swagger and OpenAPI passed; login and business API checks are manual.';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(
      await smokeDeployment(
        process.env.DEPLOYMENT_URL,
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
