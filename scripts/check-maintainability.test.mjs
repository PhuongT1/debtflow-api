import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { test } from 'node:test';
import { checkMaintainability } from './check-maintainability.mjs';

function fixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'debtflow-maintainability-'));
  const write = (file, value) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), value);
  };
  write(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: { target: 'ES2022', paths: { '@modules/*': ['./src/modules/*'] } },
    }),
  );
  for (const [path, text] of Object.entries(files)) write(path, text);
  try {
    run({ root, write, check: () => checkMaintainability(root) });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('accepts grouped feature responsibilities, DTO inheritance and background adapters', () => {
  fixture(
    {
      'src/modules/orders/orders.module.ts': 'export class OrdersModule {}',
      'src/modules/orders/controllers/orders.controller.ts': 'export class OrdersController {}',
      'src/modules/orders/services/orders.service.ts': 'export class OrdersService {}',
      'src/modules/orders/jobs/delivery.service.ts': 'export class DeliveryService {}',
      'src/modules/orders/queries/orders.list-query.ts': 'export const QUERY = {};',
      'src/modules/orders/types/order.types.ts': 'export type Identity = { id: string };',
      'src/modules/orders/dto/update-order.dto.ts':
        'export class UpdateOrderDto extends BaseDto {}',
    },
    ({ check }) => assert.deepEqual(check().violations, []),
  );
});

test('rejects flat provider, query and shared-contract declarations at the feature root', () => {
  fixture(
    {
      'src/modules/orders/orders.service.ts': 'export class OrdersService {}',
      'src/modules/orders/orders.list-query.ts': 'export const QUERY = {};',
      'src/modules/orders/types.ts': 'export type Order = { id: string };',
      'src/modules/orders/services/other.service.ts': 'export type Shared = { id: string };',
    },
    ({ check }) => {
      const rules = check().violations.map((issue) => issue.rule);
      assert.equal(rules.filter((rule) => rule === 'responsibility-folder').length, 2);
      assert.ok(rules.includes('feature-root'));
      assert.ok(rules.includes('contract-owner'));
    },
  );
});

test('finds exact helper clones despite comments and formatting without flagging thin controllers', () => {
  const body = 'const text = String(value ?? "").trim(); return text.length > 0 ? text : null;';
  fixture(
    {
      'src/modules/a/services/a.service.ts': `export function first(value: unknown) { ${body} }`,
      'src/modules/b/services/b.service.ts': `export function second(value: unknown) { /* formatting */\n${body} }`,
      'src/modules/a/controllers/a.controller.ts': `export function delegate(value: unknown) { ${body} }`,
    },
    ({ check, write }) => {
      assert.equal(
        check().violations.filter((issue) => issue.rule === 'duplicate-helper').length,
        2,
      );
      write(
        'src/modules/b/services/b.service.ts',
        'export function second(value: string) { return value.toLowerCase(); }',
      );
      assert.deepEqual(check().violations, []);
    },
  );
});

test('forbids borrowing private DTO constants while allowing reuse through a public contract', () => {
  fixture(
    {
      'src/modules/a/dto/create-a.dto.ts': 'export const PHONE = /x/; export class CreateADto {}',
      'src/modules/b/dto/create-b.dto.ts':
        "import { PHONE as CHECK } from '@modules/a/dto/create-a.dto'; export class CreateBDto {}",
    },
    ({ check, write }) => {
      assert.ok(check().violations.some((issue) => issue.rule === 'dto-helper-dependency'));
      write(
        'src/modules/b/dto/create-b.dto.ts',
        "import { CreateADto as Input } from '@modules/a/public/a'; export class CreateBDto extends Input {}",
      );
      assert.deepEqual(check().violations, []);
    },
  );
});

test('reports equivalent type declarations for semantic review without forcing unrelated contracts to merge', () => {
  fixture(
    {
      'src/modules/a/types/a.types.ts':
        'export type A = { id: string; name: string; value: number };',
      'src/modules/b/types/b.types.ts':
        'export type B = { value: number; name: string; id: string };',
    },
    ({ check }) => {
      assert.deepEqual(check().violations, []);
      assert.equal(check().contractCandidates.length, 1);
    },
  );
});

test('ignores generated files and specs rather than treating test fixtures as production duplication', () => {
  fixture(
    {
      'src/generated/bad.service.ts': 'export type Shared = { id: string };',
      'src/modules/orders/orders.service.spec.ts': 'export type Shared = { id: string };',
      'src/modules/orders/orders.module.ts': 'export class OrdersModule {}',
    },
    ({ check }) => {
      assert.equal(check().files, 1);
      assert.deepEqual(check().violations, []);
    },
  );
});

test('guards feature boundaries for aliases, relative imports and re-exports', () => {
  fixture(
    {
      'src/modules/a/services/a.service.ts': 'export class AService {}',
      'src/modules/a/a.module.ts': 'export class AModule {}',
      'src/modules/a/public/a.ts': "export { AService } from '../services/a.service';",
      'src/modules/b/services/b.service.ts':
        "import { AService } from '../../a/services/a.service';",
      'src/modules/b/public/b.ts': "export { AService } from '@modules/a/services/a.service';",
    },
    ({ check, write }) => {
      assert.equal(
        check().violations.filter((issue) => issue.rule === 'feature-public-contract').length,
        2,
      );
      write(
        'src/modules/b/services/b.service.ts',
        "import { AService } from '@modules/a/public/a'; import { AModule } from '@modules/a/a.module';",
      );
      write('src/modules/b/public/b.ts', "export { AService } from '../../a/public/a';");
      assert.deepEqual(check().violations, []);
    },
  );
});

test('requires intentional named exports at a feature public boundary', () => {
  fixture(
    {
      'src/modules/a/services/a.service.ts': 'export class AService {}',
      'src/modules/a/public/a.ts': "export * from '../services/a.service';",
    },
    ({ check, write }) => {
      assert.ok(check().violations.some((issue) => issue.rule === 'explicit-public-contract'));
      write('src/modules/a/public/a.ts', "export { AService } from '../services/a.service';");
      assert.deepEqual(check().violations, []);
    },
  );
});
