import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { Prisma } from '#generated/prisma/client.js';
import { SWAGGER_PATHS } from '#common/swagger/swagger-ui.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the real compiled graph: Nest build emits constructor metadata and Swagger factories.
// `npm run check` builds before tests; no Prisma connection is opened (the provider is overridden).
const requireCompiled = createRequire(import.meta.url);
const membership = vi.fn();
const aggregateDebt = vi.fn();
const findDebts = vi.fn();
const countDebts = vi.fn();
const writeDebt = vi.fn();
const updateDebt = vi.fn();
const debtDetail = vi.fn();
const parties = { list: vi.fn(), create: vi.fn(), assertActive: vi.fn() };
const sessions = {
  login: vi.fn(),
  refresh: vi.fn(),
  switchOrganization: vi.fn(),
  getCurrentUser: vi.fn(),
};
const prisma = {
  organizationMembership: { findFirst: membership },
  debt: {
    aggregate: aggregateDebt,
    findMany: findDebts,
    count: countDebts,
    create: writeDebt,
    update: updateDebt,
    findFirstOrThrow: debtDetail,
  },
  $transaction: (
    work: Promise<unknown>[] | ((db: unknown) => Promise<unknown>),
  ): Promise<unknown> => (Array.isArray(work) ? Promise.all(work) : work(prisma)),
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
  let document: OpenAPIObject;

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@127.0.0.1:5432/not_connected');
    vi.stubEnv('JWT_SECRET', 'test-only-placeholder-with-at-least-24-characters');
    const { AppModule } = requireCompiled(
      '../dist/src/app.module.js',
    ) as typeof import('./app.module.js');
    const { PrismaService } = requireCompiled(
      '../dist/src/database/prisma.service.js',
    ) as typeof import('./database/prisma.service.js');
    const { AuthService } = requireCompiled(
      '../dist/src/modules/auth/services/auth.service.js',
    ) as typeof import('./modules/auth/services/auth.service.js');
    const { PartiesService } = requireCompiled(
      '../dist/src/modules/parties/services/parties.service.js',
    ) as typeof import('./modules/parties/services/parties.service.js');
    const { configureApp } = requireCompiled(
      '../dist/src/configure-app.js',
    ) as typeof import('./configure-app.js');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AuthService)
      .useValue(sessions)
      .overrideProvider(PartiesService)
      .useValue(parties)
      .compile();
    app = module.createNestApplication({ logger: false });
    document = configureApp(app);
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
    parties.assertActive.mockResolvedValue(undefined);
    writeDebt.mockResolvedValue({ id: 'd1' });
    const storedDebt = {
      id: 'd1',
      invoiceNo: 'INV-1',
      followUpNote: 'Keep this',
      assignedToId: 'staff-1',
      paymentAllocations: [],
    };
    debtDetail.mockResolvedValue(storedDebt);
    updateDebt.mockImplementation(async ({ data }) => ({ ...storedDebt, ...data }));
    parties.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    parties.create.mockResolvedValue({ id: 'test-party', name: 'Example', type: 'CUSTOMER' });
    sessions.login.mockResolvedValue({ accessToken: 'test-placeholder' });
    sessions.refresh.mockResolvedValue({ accessToken: 'test-placeholder' });
    sessions.switchOrganization.mockResolvedValue({ organizationId: 'another-test-org' });
    sessions.getCurrentUser.mockResolvedValue({ id: 'test-user', organizations: [] });
  });

  async function request(
    path: string,
    body?: object,
    authenticated = false,
    method = body ? 'POST' : 'GET',
  ) {
    const response = await fetch(`${url}/api/${path}`, {
      method,
      headers: {
        'Accept-Language': 'en',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(authenticated ? { Authorization: 'Bearer test-placeholder' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }

  it('serves the same OpenAPI document returned for offline generation', async () => {
    const response = await fetch(`${url}${SWAGGER_PATHS.json}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(JSON.parse(JSON.stringify(document)));
    expect(membership).not.toHaveBeenCalled();
  });

  it('serves the standalone browser asset from the compiled application', async () => {
    const page = await fetch(`${url}${SWAGGER_PATHS.ui}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain(`src="${SWAGGER_PATHS.authScript}"`);
    expect(html).toContain(`data-spec-url="${SWAGGER_PATHS.json}"`);
    expect(html).not.toContain('<script>');
    const asset = await fetch(`${url}${SWAGGER_PATHS.authScript}`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('javascript');
    expect(await asset.text()).toBe(
      readFileSync(join(import.meta.dirname, 'common/swagger/swagger-auth.js'), 'utf8'),
    );
  });

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

  it('preserves omitted PATCH fields through actual inherited DTO validation and service mapping', async () => {
    membership.mockResolvedValue(activeMember('ADMIN'));
    expect(
      await request('debts/d1', { collectionStatus: 'CONTACTED' }, true, 'PATCH'),
    ).toMatchObject({
      status: 200,
      body: {
        data: {
          collectionStatus: 'CONTACTED',
          invoiceNo: 'INV-1',
          followUpNote: 'Keep this',
          assignedToId: 'staff-1',
        },
      },
    });
    expect(updateDebt.mock.calls[0][0].data).toEqual({ collectionStatus: 'CONTACTED' });
    updateDebt.mockClear();
    expect(await request('debts/d1', { collectionStatus: null }, true, 'PATCH')).toMatchObject({
      status: 400,
    });
    expect(updateDebt).not.toHaveBeenCalled();
  });

  it('rejects an inactive or foreign assignee before writing a debt', async () => {
    membership.mockResolvedValueOnce(activeMember('ADMIN')).mockResolvedValueOnce(null);
    expect(
      await request(
        'debts',
        {
          partyId: 'party-1',
          assignedToId: 'foreign-user',
          title: 'Invoice',
          type: 'RECEIVABLE',
          originalAmount: '100',
          issueDate: '2026-11-01',
          dueDate: '2026-11-02',
        },
        true,
      ),
    ).toMatchObject({ status: 400, body: { code: 'ASSIGNEE_NOT_FOUND' } });
    expect(writeDebt).not.toHaveBeenCalled();
  });

  it('documents every JSON handler with concrete envelope data and resolvable schemas', () => {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const operation of Object.values(methods)) {
        if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue;
        const success = operation.responses['200'] ?? operation.responses['201'];
        expect(success, path).toBeDefined();
        if (path.endsWith('/exports/debts')) continue;
        expect(JSON.stringify(success), path).toContain('"data"');
        expect(JSON.stringify(success), path).toContain('#/components/schemas/');
      }
    }
    const serialized = JSON.stringify(doc);
    for (const match of serialized.matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g))
      expect(doc.components?.schemas, match[1]).toHaveProperty(match[1]);
    expect(doc.components?.schemas?.DebtRecordDto).toMatchObject({
      properties: { originalAmount: { type: 'string' }, paidAmount: { type: 'string' } },
    });
    expect(doc.components?.schemas?.PaymentReversalResponseDto).toMatchObject({
      required: expect.arrayContaining(['id', 'restoredDebtCount']),
    });
    expect(doc.components?.schemas?.AuthUserResponseDto).not.toHaveProperty(
      'properties.passwordHash',
    );
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
    const { PaymentsModule } = requireCompiled(
      '../dist/src/modules/payments/payments.module.js',
    ) as typeof import('./modules/payments/payments.module.js');
    const { PaymentsService } = requireCompiled(
      '../dist/src/modules/payments/services/payments.service.js',
    ) as typeof import('./modules/payments/services/payments.service.js');
    const { DatabaseModule } = requireCompiled(
      '../dist/src/database/database.module.js',
    ) as typeof import('./database/database.module.js');
    const { PrismaService } = requireCompiled(
      '../dist/src/database/prisma.service.js',
    ) as typeof import('./database/prisma.service.js');
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
