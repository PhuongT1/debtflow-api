import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@generated/prisma/client.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaDebtsRepository } from '@modules/debts/infrastructure/prisma-debts.repository.js';
import { DebtsService } from '@modules/debts/services/debts.service.js';
import { DebtLineItemService } from '@modules/debts/services/debt-line-item.service.js';
import { PrismaPartiesRepository } from '../infrastructure/prisma-parties.repository.js';
import { PartiesService } from '../parties.service.js';
import { partySearchText } from '@common/utils/search-normalization.util.js';

// Explicit opt-in, dedicated loopback database only. Never fall back to DATABASE_URL.
const connectionString = process.env.PARTY_WRITE_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !url.pathname.startsWith('/debtflow_party_test_')
  ) {
    throw new Error('Party write tests require a dedicated local debtflow_party_test_* database');
  }
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function pauseFirstRead() {
  const reached = gate();
  const proceed = gate();
  let first = true;
  return {
    reached: reached.promise,
    release: proceed.release,
    run: async <T>(read: () => Promise<T>) => {
      const value = await read();
      if (first) {
        first = false;
        reached.release();
        await proceed.promise;
      }
      return value;
    },
  };
}

describe.skipIf(!connectionString)('Party writes on native PostgreSQL through Prisma', () => {
  const schema = `party_write_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString });
  let first: PrismaClient;
  let second: PrismaClient;
  let schemaCreated = false;
  let connected = false;

  beforeAll(async () => {
    await admin.connect();
    connected = true;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await admin.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await admin.query(`SET search_path TO "${schema}", public`);
    const root = resolve(import.meta.dirname, '../../../..');
    // Generate DDL from current models; do not migrate/seed any application database.
    const ddl = execFileSync(
      process.execPath,
      [
        resolve(root, 'node_modules/prisma/build/index.js'),
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema',
        resolve(root, 'prisma'),
        '--script',
      ],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: connectionString, DIRECT_URL: connectionString },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    await admin.query(ddl.replace('CREATE SCHEMA IF NOT EXISTS "public";', ''));
    first = new PrismaClient({ adapter: new PrismaPg(connectionString!, { schema }) });
    second = new PrismaClient({ adapter: new PrismaPg(connectionString!, { schema }) });
    await first.organization.create({
      data: {
        id: 'org-a',
        name: 'Test organization A',
        slug: 'test-org-a',
        kind: 'BUSINESS',
        status: 'ACTIVE',
      },
    });
    await first.organization.create({
      data: {
        id: 'org-b',
        name: 'Test organization B',
        slug: 'test-org-b',
        kind: 'BUSINESS',
        status: 'ACTIVE',
      },
    });
    await first.user.create({
      data: { id: 'actor-a', name: 'Test actor', email: 'actor@example.invalid' },
    });
  }, 30_000);

  afterAll(async () => {
    try {
      await Promise.all([first?.$disconnect(), second?.$disconnect()]);
      if (schemaCreated) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      if (connected) await admin.end();
    }
  });

  async function party(id: string) {
    return first.party.create({
      data: {
        id,
        organizationId: 'org-a',
        name: 'Original',
        code: `code-${id}`,
        searchText: partySearchText('Original', `code-${id}`),
        type: 'CUSTOMER',
      },
    });
  }

  it('rejects debt creation after concurrent deactivation wins', async () => {
    await party('deactivate-wins');
    const partyRepo = new PrismaPartiesRepository(first as never);
    const debtRepo = new PrismaDebtsRepository(second as never);
    const partyTransaction = partyRepo.inTransaction.bind(partyRepo);
    const debtTransaction = debtRepo.inTransaction.bind(debtRepo);
    const count = pauseFirstRead();
    const active = pauseFirstRead();
    partyRepo.inTransaction = (work) =>
      partyTransaction((store) =>
        work({
          ...store,
          countActiveDebts: (org, id) => count.run(() => store.countActiveDebts(org, id)),
        }),
      );
    debtRepo.inTransaction = (work) =>
      debtTransaction((store) =>
        work({
          ...store,
          hasActiveParty: (org, id) => active.run(() => store.hasActiveParty(org, id)),
        }),
      );
    const partyEvents = { emit: vi.fn() };
    const debtEvents = { emit: vi.fn() };
    const parties = new PartiesService(partyRepo, partyEvents as never, {} as never);
    const debts = new DebtsService(debtRepo, new DebtLineItemService(), debtEvents as never);
    const deactivation = parties.deactivate('org-a', 'deactivate-wins', 'actor-a');
    const creation = debts.create(
      {
        partyId: 'deactivate-wins',
        type: 'RECEIVABLE',
        title: 'Test debt',
        originalAmount: '100',
        issueDate: '2026-11-10',
        dueDate: '2026-11-11',
      },
      'org-a',
      'actor-a',
    );
    const creationResult = creation.then(
      () => null,
      (error: unknown) => error,
    );
    try {
      await Promise.all([count.reached, active.reached]);
      count.release();
      await deactivation;
      active.release();
      expect(await creationResult).toMatchObject({ status: 404 });
      expect(await first.debt.count({ where: { partyId: 'deactivate-wins' } })).toBe(0);
      expect(
        (await first.party.findUniqueOrThrow({ where: { id: 'deactivate-wins' } })).isActive,
      ).toBe(false);
      expect(partyEvents.emit).toHaveBeenCalledOnce();
      expect(debtEvents.emit).not.toHaveBeenCalled();
    } finally {
      count?.release();
      active?.release();
      await Promise.allSettled([deactivation, creation]);
    }
  }, 15_000);

  it('rejects concurrent deactivation when debt creation commits first', async () => {
    await party('debt-wins');
    const partyRepo = new PrismaPartiesRepository(first as never);
    const debtRepo = new PrismaDebtsRepository(second as never);
    const transaction = partyRepo.inTransaction.bind(partyRepo);
    const count = pauseFirstRead();
    partyRepo.inTransaction = (work) =>
      transaction((store) =>
        work({
          ...store,
          countActiveDebts: (org, id) => count.run(() => store.countActiveDebts(org, id)),
        }),
      );
    const partyEvents = { emit: vi.fn() };
    const debtEvents = { emit: vi.fn() };
    const parties = new PartiesService(partyRepo, partyEvents as never, {} as never);
    const debts = new DebtsService(debtRepo, new DebtLineItemService(), debtEvents as never);
    const deactivation = parties.deactivate('org-a', 'debt-wins', 'actor-a');
    const result = deactivation.then(
      () => null,
      (error: unknown) => error,
    );
    try {
      await count.reached;
      await debts.create(
        {
          partyId: 'debt-wins',
          type: 'RECEIVABLE',
          title: 'Test debt',
          originalAmount: '100',
          issueDate: '2026-11-10',
          dueDate: '2026-11-11',
        },
        'org-a',
        'actor-a',
      );
      count.release();
      expect(await result).toMatchObject({ status: 400 });
      expect(await first.debt.count({ where: { partyId: 'debt-wins' } })).toBe(1);
      expect((await first.party.findUniqueOrThrow({ where: { id: 'debt-wins' } })).isActive).toBe(
        true,
      );
      expect(partyEvents.emit).not.toHaveBeenCalled();
      expect(debtEvents.emit).toHaveBeenCalledOnce();
    } finally {
      count.release();
      await result;
    }
  }, 15_000);

  it('retries a concurrent PATCH and derives searchText from both committed edits', async () => {
    await party('patch-race');
    const firstRepo = new PrismaPartiesRepository(first as never);
    const secondRepo = new PrismaPartiesRepository(second as never);
    const firstEvents = { emit: vi.fn() };
    const secondEvents = { emit: vi.fn() };
    const reached = gate();
    const proceed = gate();
    let attempts = 0;
    const transaction = firstRepo.inTransaction.bind(firstRepo);
    firstRepo.inTransaction = (work) =>
      transaction((store) => {
        attempts++;
        return work({
          ...store,
          findRecord: async (org, id) => {
            const record = await store.findRecord(org, id);
            if (attempts === 1) {
              reached.release();
              await proceed.promise;
            }
            return record;
          },
        });
      });
    const firstService = new PartiesService(firstRepo, firstEvents as never, {} as never);
    const secondService = new PartiesService(secondRepo, secondEvents as never, {} as never);
    const patchName = firstService.update(
      'org-a',
      'patch-race',
      { name: 'Updated name' },
      'actor-a',
    );
    // Attach the rejection handler before awaiting the other operation.
    const patchResult = patchName.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await reached.promise;
      await secondService.update('org-a', 'patch-race', { code: 'NEW-CODE' }, 'actor-a');
      proceed.release();
      expect(await patchResult).toHaveProperty('value');
      const row = await first.party.findUniqueOrThrow({ where: { id: 'patch-race' } });
      expect(row).toMatchObject({
        name: 'Updated name',
        code: 'NEW-CODE',
        searchText: partySearchText('Updated name', 'NEW-CODE'),
      });
      expect(attempts).toBe(2);
      expect(firstEvents.emit).toHaveBeenCalledOnce();
      expect(secondEvents.emit).toHaveBeenCalledOnce();
    } finally {
      proceed.release();
      await patchResult;
    }
  }, 15_000);

  it('filters an inconsistent cross-tenant debt link from detail', async () => {
    await party('detail-scope');
    const data = {
      partyId: 'detail-scope',
      type: 'RECEIVABLE' as const,
      title: 'Fixture',
      originalAmount: '100',
      issueDate: new Date('2026-11-10'),
      dueDate: new Date('2026-11-11'),
    };
    await first.debt.create({
      data: { ...data, id: 'own-debt', organizationId: 'org-a', code: 'OWN' },
    });
    await first.debt.create({
      data: { ...data, id: 'foreign-debt', organizationId: 'org-b', code: 'FOREIGN' },
    });
    const repository = new PrismaPartiesRepository(first as never);
    const result = await repository.detail('org-a', 'detail-scope');
    expect(result.debts.map(({ id }) => id)).toEqual(['own-debt']);
    await expect(repository.detail('org-b', 'detail-scope')).rejects.toMatchObject({
      code: 'P2025',
    });
    const events = { emit: vi.fn() };
    const service = new PartiesService(repository, events as never, {} as never);
    await expect(
      service.update('org-b', 'detail-scope', { name: 'Forbidden edit' }),
    ).rejects.toMatchObject({ code: 'P2025' });
    expect((await first.party.findUniqueOrThrow({ where: { id: 'detail-scope' } })).name).toBe(
      'Original',
    );
    expect(events.emit).not.toHaveBeenCalled();
  });
});
