import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkArchitecture } from './check-architecture.mjs';

function fixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'debtflow-architecture-'));
  const write = (file, contents) => {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };
  write(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'commonjs',
        paths: {
          '@modules/*': ['./src/modules/*'],
          '@database/*': ['./src/database/*'],
          '@generated/*': ['./src/generated/*'],
        },
      },
      include: ['src/**/*.ts'],
    }),
  );
  write('src/modules/orders/orders.service.ts', 'export class OrdersService {}');
  write('src/database/prisma.service.ts', 'export class PrismaService {}');
  write(
    'src/generated/prisma/index.ts',
    'export class PrismaClient {}; export enum PartyType { CUSTOMER }',
  );
  for (const [file, contents] of Object.entries(files)) write(file, contents);
  try {
    run(checkArchitecture(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('blocks infrastructure imports regardless of alias, relative path or import form', () => {
  fixture(
    {
      'src/common/bad.ts': `
      import { OrdersService } from '@modules/orders/orders.service';
      export { OrdersService as Other } from '../modules/orders/orders.service';
      const a = import('../modules/orders/orders.service');
      const b = require('@modules/orders/orders.service');
      import c = require('../modules/orders/orders.service');
      type D = import('../modules/orders/orders.service').OrdersService;
    `,
    },
    (result) => {
      assert.equal(result.violations.length, 6);
      assert.ok(result.violations.every((issue) => issue.rule === 'infrastructure-dependency'));
    },
  );
});

test('blocks controller database imports and renamed PrismaClient imports', () => {
  fixture(
    {
      'src/modules/orders/orders.controller.ts': `
      import { PrismaService } from '@database/prisma.service';
      import { PrismaClient as Client } from '@generated/prisma';
    `,
    },
    (result) => {
      assert.equal(result.violations.length, 2);
      assert.ok(result.violations.every((issue) => issue.rule === 'controller-persistence'));
    },
  );
});

test('allows adapter persistence and controller enum imports; ignores generated code and specs', () => {
  fixture(
    {
      'src/modules/orders/orders.controller.ts': `
      import { PartyType } from '@generated/prisma';
      import { OrdersService } from './orders.service';
    `,
      'src/modules/orders/infrastructure/prisma-orders.repository.ts': `import { PrismaService } from '@database/prisma.service';`,
      'src/common/allowed.ts': `const sample = "import x from '@modules/orders/orders.service'";`,
      'src/common/_test/example.spec.ts': `import { OrdersService } from '@modules/orders/orders.service';`,
      'src/generated/ignored.ts': `import { OrdersService } from '@modules/orders/orders.service';`,
    },
    (result) => assert.deepEqual(result.violations, []),
  );
});

test('checks database and config dependencies as well as common helpers', () => {
  fixture(
    {
      'src/config/bad.ts': `import { OrdersService } from '@modules/orders/orders.service';`,
      'src/auth/auth.service.ts': 'export class AuthService {}',
      'src/database/bad.ts': `export { AuthService } from '../auth/auth.service';`,
    },
    (result) => assert.equal(result.violations.length, 2),
  );
});

test('keeps Express, Swagger and controllers out of service dependencies', () => {
  fixture(
    {
      'src/modules/orders/orders.controller.ts': 'export class OrdersController {}',
      'src/common/i18n/i18n.service.ts': `import type { Request } from 'express'; export class I18nService {}`,
      'src/modules/orders/orders.service.ts': `
      import type { Response } from 'express';
      import { ApiOperation } from '@nestjs/swagger';
      import { OrdersController } from './orders.controller';
    `,
    },
    (result) => {
      assert.equal(result.violations.filter((v) => v.rule === 'service-http-dependency').length, 2);
      assert.ok(result.violations.some((v) => v.rule === 'service-controller-dependency'));
    },
  );
});

test('keeps domain subfolders flexible while rejecting auth-first feature roots', () => {
  fixture(
    {
      'src/modules/payments/jobs/reconciliation.service.ts':
        'export class ReconciliationService {}',
      'src/modules/payments/api/webhooks.controller.ts': 'export class WebhooksController {}',
      'src/modules/protected/legacy/legacy.service.ts': 'export class LegacyService {}',
      'src/modules/public/legacy/legacy.controller.ts': 'export class LegacyController {}',
    },
    (result) => {
      assert.equal(result.violations.length, 2);
      assert.ok(result.violations.every((issue) => issue.rule === 'domain-layout'));
    },
  );
});

test('keeps auth infrastructure independent of feature sessions while allowing its own helpers', () => {
  fixture(
    {
      'src/auth/guards/bad.guard.ts':
        "import { OrdersService } from '../../modules/orders/orders.service';",
      'src/auth/types/context.types.ts': 'export type Context = { id: string };',
      'src/auth/guards/good.guard.ts': "import type { Context } from '../types/context.types';",
    },
    (result) => {
      assert.equal(result.violations.length, 1);
      assert.equal(result.violations[0].rule, 'infrastructure-dependency');
    },
  );
});

test('resolves short ESM aliases and permits generated enums but rejects a client', () => {
  fixture(
    {
      'package.json': JSON.stringify({
        type: 'module',
      }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          paths: { '@generated/*': ['./src/generated/*'] },
        },
        include: ['src/**/*.ts'],
      }),
      'src/generated/prisma/client.ts':
        'export class PrismaClient {}; export enum PartyType { CUSTOMER }',
      'src/modules/orders/good.controller.ts':
        "import { PartyType } from '@generated/prisma/client.js';",
      'src/modules/orders/bad.controller.ts':
        "import { PrismaClient as Client } from '@generated/prisma/client.js';",
      'src/modules/orders/namespace.controller.ts':
        "import * as Database from '@generated/prisma/client.js';",
      'src/modules/orders/dynamic.controller.ts':
        "const db = import('@generated/prisma/client.js');",
    },
    (result) => {
      assert.equal(result.violations.length, 3);
      assert.equal(result.violations[0].rule, 'controller-persistence');
    },
  );
});

test('keeps feature tests in their own _test folder and out of production imports', () => {
  fixture(
    {
      'src/modules/orders/queries/bad.spec.ts': 'export {};',
      'src/modules/orders/_test/good.spec.ts': 'export {};',
      'src/modules/orders/_test/fixture.ts': 'export const fixture = 1;',
      'src/modules/orders/orders.service.ts': "import { fixture } from './_test/fixture';",
    },
    (result) => {
      assert.equal(result.violations.filter((v) => v.rule === 'test-layout').length, 1);
      assert.equal(result.violations.filter((v) => v.rule === 'test-dependency').length, 1);
    },
  );
});

test('blocks application-to-Prisma and implementation imports through aliases, relatives and re-exports', () =>
  fixture(
    {
      'src/modules/orders/infrastructure/prisma-orders.repository.ts':
        'export class PrismaOrdersRepository {}',
      'src/modules/orders/repositories/orders.repository.ts':
        'export abstract class OrdersRepository {}',
      'src/modules/orders/services/bad.service.ts':
        "import { PrismaService } from '@database/prisma.service'; export { PrismaOrdersRepository } from '../infrastructure/prisma-orders.repository';",
      'src/modules/orders/services/client.service.ts':
        "import { PrismaClient as Client } from '@generated/prisma';",
      'src/modules/orders/services/good.service.ts':
        "import { OrdersRepository } from '../repositories/orders.repository';",
      'src/modules/orders/orders.module.ts':
        "import { PrismaOrdersRepository } from './infrastructure/prisma-orders.repository';",
    },
    (result) => {
      assert.equal(result.violations.filter((v) => v.rule === 'persistence-adapter').length, 2);
      assert.equal(
        result.violations.filter((v) => v.rule === 'implementation-dependency').length,
        1,
      );
    },
  ));

test('Party clean core follows indirect type imports and rejects DTO/ORM/framework dependencies', () => {
  fixture(
    {
      'src/modules/parties/application/parties.service.ts':
        "import type { PartyRecord } from '../domain/party.types';",
      'src/modules/parties/domain/party.types.ts':
        "export type { PartyRecord } from '../../../common/hidden';",
      'src/common/hidden.ts':
        "export type PartyRecord = import('../generated/prisma').PrismaClient;",
      'src/modules/parties/domain/party.rules.ts': "import { Injectable } from '@nestjs/common';",
      'src/modules/parties/application/repositories/parties.repository.ts':
        "import type { InputDto } from '../../presentation/dto/input.dto';",
      'src/modules/parties/presentation/dto/input.dto.ts': 'export class InputDto {}',
    },
    ({ violations }) => {
      const issues = violations.filter(({ rule }) => rule === 'party-clean-core');
      assert.equal(issues.length, 4);
      assert.ok(issues.some(({ file }) => file === 'src/common/hidden.ts'));
      assert.ok(issues.some(({ file }) => file.endsWith('party.rules.ts')));
      assert.ok(issues.some(({ file }) => file.endsWith('parties.repository.ts')));
    },
  );
});

test('Party pure contracts/rules and outer DI/Prisma adapters remain legal', () => {
  fixture(
    {
      'src/modules/parties/application/parties.service.ts':
        "import type { Input } from '../domain/party.types'; import { validate } from '../domain/party.rules';",
      'src/modules/parties/domain/party.types.ts': 'export type Input = { name: string };',
      'src/modules/parties/domain/party.rules.ts':
        'export function validate(name: string) { return name.trim(); }',
      'src/modules/parties/parties.module.ts':
        "import { Module } from '@nestjs/common'; import { PrismaPartiesRepository } from './infrastructure/prisma-parties.repository';",
      'src/modules/parties/infrastructure/prisma-parties.repository.ts':
        "import { PrismaService } from '@database/prisma.service';",
    },
    ({ violations }) => assert.deepEqual(violations, []),
  );
});

test('domain cannot reach application through a neutral-looking type export', () => {
  fixture(
    {
      'src/modules/parties/domain/party.types.ts':
        "export type { Input } from '../../../common/bridge';",
      'src/common/bridge.ts':
        "export type { Input } from '../modules/parties/application/party.inputs';",
      'src/modules/parties/application/party.inputs.ts': 'export type Input = { name: string };',
    },
    ({ violations }) => {
      assert.ok(
        violations.some(
          ({ rule, file }) => rule === 'party-clean-core' && file === 'src/common/bridge.ts',
        ),
      );
    },
  );
});
test('new application files cannot hide outer dependencies and adapters cannot import HTTP', () => {
  fixture(
    {
      'src/modules/parties/application/extra.ts':
        "import { InputDto } from '../presentation/dto/input.dto';",
      'src/modules/parties/presentation/dto/input.dto.ts': 'export class InputDto {}',
      'src/modules/parties/infrastructure/read.ts':
        "import { InputDto } from '../presentation/dto/input.dto';",
    },
    ({ violations }) => {
      assert.ok(violations.some(({ rule }) => rule === 'party-clean-core'));
      assert.ok(violations.some(({ rule }) => rule === 'party-adapter-dependency'));
    },
  );
});
