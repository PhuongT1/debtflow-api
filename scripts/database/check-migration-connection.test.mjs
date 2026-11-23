import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { checkMigrationConnection } from './check-migration-connection.mjs';

const directUrl = 'postgresql://user:fixture-password@db.example.test/app?sslmode=require';

test('opens and closes a session on the direct endpoint without executing SQL', async () => {
  const connect = mock.fn(async () => {});
  const end = mock.fn(async () => {});
  const Client = mock.fn(function () {
    return { connect, end };
  });

  await checkMigrationConnection(directUrl, Client);
  assert.equal(Client.mock.calls[0].arguments[0].connectionString, directUrl);
  assert.equal(Client.mock.calls[0].arguments[0].connectionTimeoutMillis, 20_000);
  assert.equal(connect.mock.callCount(), 1);
  assert.equal(end.mock.callCount(), 1);
});

test('reports connection failure without exposing the driver message or URL', async () => {
  const end = mock.fn(async () => {});
  class Client {
    async connect() {
      throw Object.assign(new Error(directUrl), { code: '28P01' });
    }

    end = end;
  }

  await assert.rejects(checkMigrationConnection(directUrl, Client), (error) => {
    assert.match(error.message, /PostgreSQL rejected the login/);
    assert.doesNotMatch(error.message, /fixture-password|db\.example\.test/);
    return true;
  });
  assert.equal(end.mock.callCount(), 1);
});

test('requires a direct endpoint and never falls back to another URL', async () => {
  const Client = mock.fn(function () {});
  await assert.rejects(checkMigrationConnection(' ', Client), /DIRECT_URL is required/);
  assert.equal(Client.mock.callCount(), 0);
});
