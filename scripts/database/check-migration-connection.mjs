import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

function connectionFailure(error) {
  switch (error.code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'DNS could not resolve the host. Check the direct endpoint in DIRECT_URL.';
    case '28P01':
    case '28000':
      return 'PostgreSQL rejected the login. Check the role, password and access rules.';
    case '3D000':
      return 'The requested database does not exist. Check the database name in DIRECT_URL.';
    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
    case 'ETIMEDOUT':
      return 'The endpoint did not accept the connection. Check compute availability and runner network access.';
    default:
      if (error.message === 'timeout expired')
        return 'Connection timed out after 20 seconds. Check compute availability and runner network access.';
      return 'The connection could not be established. Check the endpoint, TLS settings and database access.';
  }
}

// Establish a session before Prisma starts migrations. This also wakes suspended databases.
export async function checkMigrationConnection(directUrl, Client = pg.Client) {
  if (!directUrl?.trim())
    throw new Error('DIRECT_URL is required to check migration connectivity.');
  try {
    const client = new Client({
      connectionString: directUrl,
      connectionTimeoutMillis: 20_000,
      enableChannelBinding: true,
    });
    try {
      await client.connect();
    } finally {
      await client.end();
    }
  } catch (error) {
    // Driver errors can include connection details. Log only the diagnosis.
    throw new Error(`DIRECT_URL connection from the runner failed. ${connectionFailure(error)}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await checkMigrationConnection(process.env.DIRECT_URL);
    console.log('The runner connected to PostgreSQL using DIRECT_URL.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
