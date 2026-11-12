import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { connect, createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const env = {
  ...process.env,
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://smoke:smoke@127.0.0.1:1/not_connected',
  DIRECT_URL: 'postgresql://smoke:smoke@127.0.0.1:1/not_connected',
  JWT_SECRET: 'runtime-smoke-placeholder-at-least-24-characters',
};

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

for (const target of ['standalone', 'vercel']) {
  test(
    `native ESM ${target}: HTTP, assets, validation, auth and shutdown`,
    { timeout: 20000 },
    async () => {
      const port = await freePort();
      const args =
        target === 'standalone'
          ? ['dist/src/main.js']
          : [
              '--input-type=module',
              '-e',
              `
        import { createServer } from 'node:http';
        import handler from './api/index.js';
        createServer((req, res) => {
          handler(req, res).catch(() => { res.statusCode = 500; res.end(); });
        }).listen(${port}, '127.0.0.1');
      `,
            ];
      const child = spawn(process.execPath, args, {
        cwd: root,
        env: { ...env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      // Keep diagnostics private unless this synthetic-environment smoke test fails.
      let output = '';
      child.stdout.on('data', (data) => {
        output += data;
      });
      child.stderr.on('data', (data) => {
        output += data;
      });
      const stopped = once(child, 'exit');
      const url = `http://127.0.0.1:${port}`;
      const request = (path, options) =>
        fetch(url + path, { ...options, signal: AbortSignal.timeout(5000) });
      try {
        let ready = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          if (child.exitCode !== null || child.signalCode)
            throw new Error(`Runtime stopped: ${output}`);
          try {
            // TCP readiness starts the Vercel handler under concurrent cold-start requests below.
            await new Promise((resolve, reject) => {
              const socket = connect(port, '127.0.0.1');
              socket.once('connect', () => {
                socket.end();
                resolve();
              });
              socket.once('error', reject);
            });
            ready = true;
            break;
          } catch {
            await delay(50);
          }
        }
        assert.ok(ready, `Runtime did not listen: ${output}`);
        const pages = await Promise.all(Array.from({ length: 3 }, () => request('/docs')));
        for (const response of pages) {
          assert.equal(response.status, 200, output);
          assert.match(await response.text(), /swagger-ui/);
        }
        if (target === 'standalone') {
          const advertised = output.split('Swagger UI: ')[1]?.split(/[\s\u001b]/)[0];
          assert.ok(advertised, 'Startup must print the actual Swagger URL');
          assert.equal(new URL(advertised).port, String(port));
          assert.equal(new URL(advertised).pathname, '/docs');
          assert.equal((await fetch(advertised)).status, 200);
        }
        const document = await (await request('/docs-json')).json();
        assert.ok(document.paths['/api/parties']);
        assert.ok(document.paths['/api/auth/login']);
        const asset = await request('/docs/swagger-auth.js');
        assert.equal(asset.status, 200);
        assert.match(asset.headers.get('content-type'), /javascript/);
        assert.match(await asset.text(), /SwaggerUIBundle/);
        assert.equal((await request('/api/parties')).status, 401);
        const invalid = await request('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        assert.equal(invalid.status, 400);
        assert.equal((await invalid.json()).success, false);
        // The test database is unreachable: success above proves bootstrap/docs do not query it.
        assert.doesNotMatch(output, /PrismaClientInitializationError|ERR_MODULE_NOT_FOUND/);
      } finally {
        child.kill('SIGTERM');
        const [, signal] = await Promise.race([
          stopped,
          delay(3000, undefined, { ref: false }).then(() => {
            child.kill('SIGKILL');
            throw new Error('Runtime did not stop');
          }),
        ]);
        if (target === 'standalone') assert.equal(signal, 'SIGTERM');
      }
    },
  );
}
