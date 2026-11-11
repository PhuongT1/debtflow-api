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
      'src/modules/orders/orders.controller.ts': 'export class OrdersController {}',
      'src/modules/orders/services/orders.service.ts': 'export class OrdersService {}',
      'src/modules/orders/services/delivery.service.ts': 'export class DeliveryService {}',
      'src/modules/orders/orders.list-query.ts': 'export const QUERY = {};',
      'src/modules/orders/order.types.ts': 'export type Identity = { id: string };',
      'src/modules/orders/dto/update-order.dto.ts':
        'export class UpdateOrderDto extends BaseDto {}',
    },
    ({ check }) => assert.deepEqual(check().violations, []),
  );
});

test('rejects misplaced DTOs and generic or provider-owned contracts', () => {
  fixture(
    {
      'src/modules/orders/orders.dto.ts': 'export class OrdersDto {}',
      'src/modules/orders/orders.repository.ts': 'export abstract class OrdersRepository {}',
      'src/modules/orders/types.ts': 'export type Order = { id: string };',
      'src/modules/orders/orders.service.ts': 'export type Shared = { id: string };',
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
      'src/modules/a/a.service.ts': `export function first(value: unknown) { ${body} }`,
      'src/modules/b/b.service.ts': `export function second(value: unknown) { /* formatting */\n${body} }`,
      'src/modules/a/a.controller.ts': `export function delegate(value: unknown) { ${body} }`,
    },
    ({ check, write }) => {
      assert.equal(
        check().violations.filter((issue) => issue.rule === 'duplicate-helper').length,
        2,
      );
      write(
        'src/modules/b/b.service.ts',
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
      'src/modules/a/a.types.ts': 'export type A = { id: string; name: string; value: number };',
      'src/modules/b/b.types.ts': 'export type B = { value: number; name: string; id: string };',
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
      'src/modules/a/a.service.ts': 'export class AService {}',
      'src/modules/a/a.module.ts': 'export class AModule {}',
      'src/modules/a/public/a.ts': "export { AService } from '../a.service';",
      'src/modules/b/b.service.ts': "import { AService } from '../a/a.service';",
      'src/modules/b/public/b.ts': "export { AService } from '@modules/a/a.service';",
    },
    ({ check, write }) => {
      assert.equal(
        check().violations.filter((issue) => issue.rule === 'feature-public-contract').length,
        2,
      );
      write(
        'src/modules/b/b.service.ts',
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
      'src/modules/a/a.service.ts': 'export class AService {}',
      'src/modules/a/public/a.ts': "export * from '../a.service';",
    },
    ({ check, write }) => {
      assert.ok(check().violations.some((issue) => issue.rule === 'explicit-public-contract'));
      write('src/modules/a/public/a.ts', "export { AService } from '../a.service';");
      assert.deepEqual(check().violations, []);
    },
  );
});

test('rejects unnecessary one-file folders while preserving architectural boundaries', () => {
  fixture(
    {
      'src/modules/orders/controllers/orders.controller.ts': 'export class OrdersController {}',
      'src/modules/orders/dto/query-orders.dto.ts': 'export class QueryOrdersDto {}',
      'src/modules/orders/repositories/orders.repository.ts':
        'export abstract class OrdersRepository {}',
      'src/modules/orders/infrastructure/prisma-orders.repository.ts':
        'export class PrismaOrdersRepository {}',
      'src/modules/orders/public/orders.ts':
        "export { OrdersRepository } from '../repositories/orders.repository';",
    },
    ({ check }) => {
      const violations = check().violations;
      assert.equal(violations.length, 1);
      assert.equal(violations[0].rule, 'single-file-folder');
    },
  );
});

test('requires grouping when a second ordinary provider is added', () => {
  fixture(
    {
      'src/modules/orders/orders.service.ts': 'export class OrdersService {}',
      'src/modules/orders/delivery.service.ts': 'export class DeliveryService {}',
    },
    ({ check }) => {
      assert.equal(check().violations.filter((v) => v.rule === 'responsibility-folder').length, 2);
    },
  );
});

test('accepts direct named DTO classes and type-only owned types without a forwarding barrel', () => {
  fixture(
    {
      'src/modules/a/dto/a-response.dto.ts': 'export class AResponseDto { id!: string; }',
      'src/modules/a/a.types.ts':
        'export type ARecord = { id: string }; export interface AShape { name: string; }',
      'src/modules/b/b.service.ts':
        "import { AResponseDto as Output } from '@modules/a/dto/a-response.dto'; import type { ARecord } from '../a/a.types'; import { type AShape } from '@modules/a/a.types'; export class BService {}",
    },
    ({ check }) => assert.deepEqual(check().violations, []),
  );
});

test('does not allow namespace imports, runtime helpers or fake DTO functions through contract owners', () => {
  fixture(
    {
      'src/modules/a/dto/a-response.dto.ts':
        'export class AResponseDto {} export function FakeDto() {} export const LIMIT = 10;',
      'src/modules/a/a.types.ts':
        'export type ARecord = { id: string }; export const build = () => 1; export class HiddenService {}',
      'src/modules/b/b.service.ts': 'export class BService {}',
    },
    ({ check, write }) => {
      for (const statement of [
        "import * as Outputs from '@modules/a/dto/a-response.dto';",
        "import { FakeDto } from '@modules/a/dto/a-response.dto';",
        "import { LIMIT } from '@modules/a/dto/a-response.dto';",
        "import { build } from '@modules/a/a.types';",
        "import type { HiddenService } from '@modules/a/a.types';",
        "export { AResponseDto } from '@modules/a/dto/a-response.dto';",
      ]) {
        write('src/modules/b/b.service.ts', statement + ' export class BService {}');
        assert.ok(
          check().violations.some((issue) => issue.rule === 'feature-public-contract'),
          statement,
        );
      }
    },
  );
});

test('separates shared query definitions from private SQL builders without waiving placement', () => {
  fixture({
    'src/modules/orders/queries/order.query.ts': 'export const ORDER_QUERY = {};',
    'src/modules/orders/queries/order.select.ts': 'export const ORDER_SELECT = {};',
    'src/modules/orders/infrastructure/sql/order-page.sql.ts': 'export const PAGE_SQL = {};',
    'src/modules/orders/infrastructure/sql/order-filter.sql.ts': 'export const FILTER_SQL = {};',
  }, ({ check, write }) => {
    assert.deepEqual(check().violations, []);
    write('src/modules/orders/helpers/order-balance.sql.ts', 'export const BALANCE_SQL = {};');
    assert.ok(check().violations.some(({ rule }) => rule === 'responsibility-folder'));
  });
});
