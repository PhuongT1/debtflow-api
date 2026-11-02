import 'reflect-metadata';
import { createRequire } from 'node:module';
import type { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma } from '@generated/prisma';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the real compiled graph: Nest build emits constructor metadata and Swagger factories.
// `npm run check` builds before tests; no Prisma connection is opened (the provider is overridden).
const require = createRequire(import.meta.url);
const membership = vi.fn();
const aggregateDebt = vi.fn();
const findDebts = vi.fn();
const countDebts = vi.fn();
const parties = { list: vi.fn(), create: vi.fn() };
const sessions = {
  login: vi.fn(),
  refresh: vi.fn(),
  switchOrganization: vi.fn(),
  getCurrentUser: vi.fn(),
};
const prisma = {
  organizationMembership: { findFirst: membership },
  debt: { aggregate: aggregateDebt, findMany: findDebts, count: countDebts },
  $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
};
const payload = {
  sub: 'test-user',
  email: 'test@example.com',
  systemRole: 'USER',
  organizationId: 'test-org',
  membershipId: 'test-member',
  role: 'ADMIN',
  type: 'access',
};
const activeMember = (role = 'VIEWER') => ({
  role,
  user: { email: 'test@example.com', systemRole: 'USER' },
});

describe('domain module composition and HTTP access', () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@127.0.0.1:5432/not_connected');
    vi.stubEnv('JWT_SECRET', 'test-only-placeholder-with-at-least-24-characters');
    const { AppModule } = require('../dist/src/app.module.js') as typeof import('./app.module');
    const { PrismaService } =
      require('../dist/src/database/prisma.service.js') as typeof import('./database/prisma.service');
    const { AuthService } =
      require('../dist/src/modules/auth/services/auth.service.js') as typeof import('./modules/auth/services/auth.service');
    const { PartiesService } =
      require('../dist/src/modules/parties/services/parties.service.js') as typeof import('./modules/parties/services/parties.service');
    const { configureApp } =
      require('../dist/src/configure-app.js') as typeof import('./configure-app');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AuthService)
      .useValue(sessions)
      .overrideProvider(PartiesService)
      .useValue(parties)
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    vi.spyOn(app.get(JwtService), 'verifyAsync').mockResolvedValue(payload);
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    membership.mockResolvedValue(activeMember());
    aggregateDebt.mockResolvedValue({
      _sum: { originalAmount: null, paidAmount: null },
      _count: { _all: 0 },
    });
    findDebts.mockResolvedValue([]);
    countDebts.mockResolvedValue(0);
    parties.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    parties.create.mockResolvedValue({ id: 'test-party', name: 'Example', type: 'CUSTOMER' });
    sessions.login.mockResolvedValue({ accessToken: 'test-placeholder' });
    sessions.refresh.mockResolvedValue({ accessToken: 'test-placeholder' });
    sessions.switchOrganization.mockResolvedValue({ organizationId: 'another-test-org' });
    sessions.getCurrentUser.mockResolvedValue({ id: 'test-user', organizations: [] });
  });

  async function request(path: string, body?: object, authenticated = false) {
    const response = await fetch(`${url}/api/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Accept-Language': 'en',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(authenticated ? { Authorization: 'Bearer test-placeholder' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }

  it('keeps credential and refresh routes public in the auth domain', async () => {
    expect(
      await request('auth/login', { email: 'test@example.com', password: 'TestPassword123' }),
    ).toMatchObject({ status: 200, body: { success: true } });
    expect(await request('auth/refresh', { refreshToken: 'test-placeholder' })).toMatchObject({
      status: 200,
      body: { success: true },
    });
    expect(sessions.login).toHaveBeenCalledOnce();
    expect(sessions.refresh).toHaveBeenCalledOnce();
    expect(membership).not.toHaveBeenCalled();
  });

  it('resolves the profile through the auth-owned service and authenticated identity', async () => {
    expect(await request('auth/me')).toMatchObject({ status: 401 });
    expect(sessions.getCurrentUser).not.toHaveBeenCalled();
    expect(await request('auth/me', undefined, true)).toMatchObject({
      status: 200,
      body: { success: true, data: { id: 'test-user', organizations: [] } },
    });
    expect(sessions.getCurrentUser).toHaveBeenCalledWith('test-user');
  });

  it('keeps protected domain routes and organization switching behind the global JWT guard', async () => {
    expect(await request('parties')).toMatchObject({ status: 401, body: { success: false } });
    expect(
      await request('auth/switch-organization', { organizationId: 'another-test-org' }),
    ).toMatchObject({ status: 401, body: { success: false } });
    expect(parties.list).not.toHaveBeenCalled();
    expect(sessions.switchOrganization).not.toHaveBeenCalled();
  });

  it('passes the verified tenant to a read and denies a VIEWER mutation despite an ADMIN token claim', async () => {
    expect(await request('parties', undefined, true)).toMatchObject({
      status: 200,
      body: { success: true, data: [] },
    });
    expect(parties.list.mock.calls[0][0]).toBe('test-org');
    expect(membership.mock.calls[0][0].where).toMatchObject({
      id: 'test-member',
      userId: 'test-user',
      organizationId: 'test-org',
      status: 'ACTIVE',
      user: { status: 'ACTIVE' },
      organization: { status: 'ACTIVE' },
    });
    expect(await request('parties', { name: 'Example', type: 'CUSTOMER' }, true)).toMatchObject({
      status: 403,
      body: { success: false },
    });
    expect(parties.create).not.toHaveBeenCalled();
  });

  it('preserves create status, validation and server-owned tenant/actor arguments', async () => {
    membership.mockResolvedValue(activeMember('ADMIN'));
    expect(
      await request(
        'parties',
        { name: 'Example', type: 'CUSTOMER', organizationId: 'foreign-org' },
        true,
      ),
    ).toMatchObject({ status: 400, body: { success: false } });
    expect(parties.create).not.toHaveBeenCalled();
    expect(await request('parties', { name: 'Example', type: 'CUSTOMER' }, true)).toMatchObject({
      status: 201,
      body: { success: true, data: { id: 'test-party' } },
    });
    expect(parties.create).toHaveBeenCalledWith(
      'test-org',
      'test-user',
      expect.objectContaining({ name: 'Example' }),
    );
  });

  it('rejects inactive membership and keeps switching a self-service authenticated action', async () => {
    membership.mockResolvedValue(null);
    expect(await request('parties', undefined, true)).toMatchObject({ status: 401 });
    expect(parties.list).not.toHaveBeenCalled();
    membership.mockResolvedValue(activeMember());
    expect(
      await request('auth/switch-organization', { organizationId: 'another-test-org' }, true),
    ).toMatchObject({ status: 201, body: { success: true } });
    expect(sessions.switchOrganization).toHaveBeenCalledWith('test-user', 'another-test-org');
  });

  it('binds report filters and returns a typed full-dataset envelope irrespective of pagination', async () => {
    aggregateDebt.mockResolvedValueOnce({
      _sum: {
        originalAmount: new Prisma.Decimal('1501.10'),
        paidAmount: new Prisma.Decimal('0.05'),
      },
      _count: { _all: 1501 },
    });
    expect(
      await request('reports/aging?page=99&pageSize=1&filter[partyId][eq]=p1', undefined, true),
    ).toMatchObject({
      status: 200,
      body: {
        success: true,
        data: {
          notDue: { amount: '1501.05', count: 1501 },
          day1To7: { amount: '0', count: 0 },
        },
      },
    });
    expect(aggregateDebt).toHaveBeenCalledTimes(5);
    expect(aggregateDebt.mock.calls[0][0].where.AND[0]).toEqual({
      AND: [{ organizationId: 'test-org' }, { AND: [{ partyId: { equals: 'p1' } }] }],
    });
  });

  it('rejects unknown report query fields, invalid enums and disallowed dynamic tenant filters', async () => {
    for (const query of [
      'organizationId=foreign-org',
      'status=NOT_A_STATUS',
      'filter[organizationId][eq]=foreign-org',
    ]) {
      expect(await request(`reports/aging?${query}`, undefined, true)).toMatchObject({
        status: 400,
        body: { success: false },
      });
    }
    expect(aggregateDebt).not.toHaveBeenCalled();
  });

  it('keeps XLSX export binary and rejects untrusted query fields before persistence', async () => {
    const response = await fetch(`${url}/api/exports/debts?page=99&pageSize=1`, {
      headers: { Authorization: 'Bearer test-placeholder' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(response.headers.get('content-disposition')).toContain('debtflow-debts.xlsx');
    expect(
      Buffer.from(await response.arrayBuffer())
        .subarray(0, 2)
        .toString(),
    ).toBe('PK');
    expect(findDebts.mock.calls[0][0]).toMatchObject({
      where: { organizationId: 'test-org' },
      skip: 0,
      take: 1000,
    });
    findDebts.mockClear();
    expect(
      await request('exports/debts?organizationId=foreign-org', undefined, true),
    ).toMatchObject({ status: 400 });
    expect(findDebts).not.toHaveBeenCalled();
  });

  it('allows a domain provider module to compose without the HTTP application or auth grouping modules', async () => {
    const { PaymentsModule } =
      require('../dist/src/modules/payments/payments.module.js') as typeof import('./modules/payments/payments.module');
    const { PaymentsService } =
      require('../dist/src/modules/payments/services/payments.service.js') as typeof import('./modules/payments/services/payments.service');
    const { DatabaseModule } =
      require('../dist/src/database/database.module.js') as typeof import('./database/database.module');
    const { PrismaService } =
      require('../dist/src/database/prisma.service.js') as typeof import('./database/prisma.service');
    const worker = await Test.createTestingModule({
      imports: [DatabaseModule, EventEmitterModule.forRoot(), PaymentsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    try {
      expect(worker.get(PaymentsService)).toBeDefined();
      expect(worker.select(PaymentsModule).get(PaymentsService, { strict: true })).toBe(
        worker.get(PaymentsService),
      );
    } finally {
      await worker.close();
    }
  });
});
