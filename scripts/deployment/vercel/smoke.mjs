import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Check the deployed API contract before moving the production domain.
export async function smokeDeployment(url, bypass, request = fetch) {
  const base = new URL(url);
  if (base.protocol !== 'https:' || base.username || base.password)
    throw new Error('Deployment URL must use HTTPS without credentials.');

  const target = new URL('/docs-json', base);
  let response;
  try {
    response = await request(target, {
      headers: bypass ? { 'x-vercel-protection-bypass': bypass } : {},
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(
      'Smoke check /docs-json: request failed before an HTTP response. Check connectivity to the deployment.',
    );
  }
  if (!response.ok) throw new Error(`Smoke check /docs-json: HTTP ${response.status}.`);
  let schema;
  try {
    schema = await response.json();
  } catch {
    throw new Error(
      'Smoke check /docs-json: expected JSON. Check deployment protection and routing.',
    );
  }
  if (
    !schema?.openapi ||
    !schema.paths?.['/api/auth/login']?.post ||
    !schema.paths?.['/api/parties']?.get
  )
    throw new Error('OpenAPI is missing expected auth/parties routes.');
  return 'OpenAPI passed; login and business API checks are manual.';
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
