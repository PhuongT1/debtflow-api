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
  write('src/modules/parties/parties.service.ts', 'export class PartiesService {}');
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
      import { PartiesService } from '@modules/parties/parties.service';
      export { PartiesService as Other } from '../modules/parties/parties.service';
      const a = import('../modules/parties/parties.service');
      const b = require('@modules/parties/parties.service');
      import c = require('../modules/parties/parties.service');
      type D = import('../modules/parties/parties.service').PartiesService;
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
      'src/modules/parties/parties.controller.ts': `
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

test('allows service persistence and controller enum imports; ignores generated code and specs', () => {
  fixture(
    {
      'src/modules/parties/parties.controller.ts': `
      import { PartyType } from '@generated/prisma';
      import { PartiesService } from './parties.service';
    `,
      'src/modules/parties/parties.service.ts': `import { PrismaService } from '@database/prisma.service';`,
      'src/common/allowed.ts': `const sample = "import x from '@modules/parties/parties.service'";`,
      'src/common/example.spec.ts': `import { PartiesService } from '@modules/parties/parties.service';`,
      'src/generated/ignored.ts': `import { PartiesService } from '@modules/parties/parties.service';`,
    },
    (result) => assert.deepEqual(result.violations, []),
  );
});

test('checks database and config dependencies as well as common helpers', () => {
  fixture(
    {
      'src/config/bad.ts': `import { PartiesService } from '@modules/parties/parties.service';`,
      'src/auth/auth.service.ts': 'export class AuthService {}',
      'src/database/bad.ts': `export { AuthService } from '../auth/auth.service';`,
    },
    (result) => assert.equal(result.violations.length, 2),
  );
});

test('keeps Express, Swagger and controllers out of service dependencies', () => {
  fixture(
    {
      'src/modules/parties/parties.controller.ts': 'export class PartiesController {}',
      'src/common/i18n/i18n.service.ts': `import type { Request } from 'express'; export class I18nService {}`,
      'src/modules/parties/parties.service.ts': `
      import type { Response } from 'express';
      import { ApiOperation } from '@nestjs/swagger';
      import { PartiesController } from './parties.controller';
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
        "import { PartiesService } from '../../modules/parties/parties.service';",
      'src/auth/types/context.types.ts': 'export type Context = { id: string };',
      'src/auth/guards/good.guard.ts': "import type { Context } from '../types/context.types';",
    },
    (result) => {
      assert.equal(result.violations.length, 1);
      assert.equal(result.violations[0].rule, 'infrastructure-dependency');
    },
  );
});

test('resolves native ESM package imports and permits generated enums but rejects a client', () => {
  fixture(
    {
      'package.json': JSON.stringify({
        type: 'module',
        imports: {
          '#generated/*': { types: './src/generated/*', default: './dist/src/generated/*' },
        },
      }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' },
        include: ['src/**/*.ts'],
      }),
      'src/generated/prisma/client.ts':
        'export class PrismaClient {}; export enum PartyType { CUSTOMER }',
      'src/modules/parties/good.controller.ts':
        "import { PartyType } from '#generated/prisma/client.js';",
      'src/modules/parties/bad.controller.ts':
        "import { PrismaClient as Client } from '#generated/prisma/client.js';",
      'src/modules/parties/namespace.controller.ts':
        "import * as Database from '#generated/prisma/client.js';",
      'src/modules/parties/dynamic.controller.ts':
        "const db = import('#generated/prisma/client.js');",
    },
    (result) => {
      assert.equal(result.violations.length, 3);
      assert.equal(result.violations[0].rule, 'controller-persistence');
    },
  );
});
