import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkBackendConventions } from './check-backend-conventions.mjs';

const owner = 'src/modules/widgets/widgets.controller.ts';
const imports = `
import { Controller, Get, Post, Body, Query, HttpCode, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiNoContentResponse } from '@nestjs/swagger';
import { ProtectedApi, PublicApi } from '@auth/decorators/auth-api.decorator';
import { Roles } from '@auth/decorators/roles.decorator';
import { ApiEnvelope } from '@common/swagger/decorators/api-envelope.decorator';
import { SkipApiResponse } from '@common/decorators/api-response.decorator';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { WidgetResponseDto } from './dto/widget-response.dto';
`;
const controller = (method, policy = '@ProtectedApi()') => `${imports}
@Controller('widgets') ${policy}
export class WidgetsController { ${method} }
`;
const validCreate = `@Post() @Roles('ADMIN') @ApiOperation({ summary: 'Create widget' })
@ApiEnvelope(WidgetResponseDto, { status: 201 })
create(@Body() input: CreateWidgetDto) { return input; }`;

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'debtflow-conventions-'));
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
        experimentalDecorators: true,
        paths: { '@auth/*': ['./src/auth/*'], '@common/*': ['./src/common/*'] },
      },
      include: ['src/**/*.ts'],
    }),
  );
  for (const [file, names] of [
    ['src/auth/decorators/auth-api.decorator.ts', ['ProtectedApi', 'PublicApi']],
    ['src/auth/decorators/roles.decorator.ts', ['Roles']],
    ['src/common/swagger/decorators/api-envelope.decorator.ts', ['ApiEnvelope']],
    ['src/common/decorators/api-response.decorator.ts', ['SkipApiResponse']],
  ])
    write(
      file,
      names.map((name) => `export const ${name} = (...args: unknown[]) => () => {};`).join('\n'),
    );
  write(
    'src/modules/widgets/dto/create-widget.dto.ts',
    'export class CreateWidgetDto { name!: string; }',
  );
  write(
    'src/modules/widgets/dto/widget-response.dto.ts',
    'export class WidgetResponseDto { id!: string; }',
  );
  write(owner, controller(validCreate));
  try {
    run({ root, write, check: (options) => checkBackendConventions(root, options) });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('accepts a real DTO class and explicit auth, role, operation and response metadata', () =>
  fixture(({ check }) => {
    assert.deepEqual(check().violations, []);
  }));

test('rejects Record, interface and type-only inputs despite DTO-looking names', () =>
  fixture(({ write, check }) => {
    for (const body of ['Record<string, unknown>', 'any']) {
      write(owner, controller(validCreate.replace('input: CreateWidgetDto', `input: ${body}`)));
      assert.ok(check().violations.some((v) => v.rule === 'request-dto'));
    }
    write(
      owner,
      controller(validCreate).replace(
        'import { CreateWidgetDto }',
        'import type { CreateWidgetDto }',
      ),
    );
    assert.ok(check().violations.some((v) => v.rule === 'request-dto'));
    write(
      owner,
      controller(validCreate)
        .replace(
          "import { CreateWidgetDto } from './dto/create-widget.dto';",
          "import type * as Dtos from './dto/create-widget.dto';",
        )
        .replace('input: CreateWidgetDto', 'input: Dtos.CreateWidgetDto'),
    );
    assert.ok(check().violations.some((v) => v.rule === 'request-dto'));
    write(owner, controller(validCreate));
    write(
      'src/modules/widgets/dto/create-widget.dto.ts',
      'export interface CreateWidgetDto { name: string }',
    );
    assert.ok(check().violations.some((v) => v.rule === 'request-dto'));
  }));

test('requires an actual response DTO rather than Object, a cast or a DTO-looking function', () =>
  fixture(({ write, check }) => {
    for (const model of ['Object', 'WidgetResponseDto as any', 'undefined']) {
      write(
        owner,
        controller(validCreate.replace('ApiEnvelope(WidgetResponseDto,', `ApiEnvelope(${model},`)),
      );
      assert.ok(check().violations.some((v) => v.rule === 'response-dto'));
    }
    write(owner, controller(validCreate));
    write(
      'src/modules/widgets/dto/widget-response.dto.ts',
      'export function WidgetResponseDto() { return {}; }',
    );
    assert.ok(check().violations.some((v) => v.rule === 'response-dto'));
  }));

test('accepts aliased and namespace response DTO classes', () =>
  fixture(({ write, check }) => {
    write(
      owner,
      controller(validCreate)
        .replace('import { WidgetResponseDto }', 'import { WidgetResponseDto as OutputDto }')
        .replace('ApiEnvelope(WidgetResponseDto,', 'ApiEnvelope(OutputDto,'),
    );
    assert.deepEqual(check().violations, []);
    write(
      owner,
      controller(validCreate)
        .replace('import { WidgetResponseDto }', 'import * as Outputs')
        .replace('ApiEnvelope(WidgetResponseDto,', 'ApiEnvelope(Outputs.WidgetResponseDto,'),
    );
    assert.deepEqual(check().violations, []);
  }));

test('does not accept a same-named local Roles function as authorization metadata', () =>
  fixture(({ write, check }) => {
    write(
      owner,
      controller(validCreate).replace(
        "import { Roles } from '@auth/decorators/roles.decorator';",
        'const Roles = (...args: unknown[]) => () => {};',
      ),
    );
    assert.ok(check().violations.some((v) => v.rule === 'mutation-policy'));
  }));

test('rejects empty role policies overriding a class policy', () =>
  fixture(({ write, check }) => {
    for (const policy of ['@Roles()', '@Roles(...[])']) {
      write(
        owner,
        controller(
          validCreate.replace("@Roles('ADMIN')", policy),
          "@ProtectedApi() @Roles('ADMIN')",
        ),
      );
      assert.ok(check().violations.some((v) => v.rule === 'mutation-policy'));
    }
  }));

test('resolves aliased and namespace decorators', () =>
  fixture(({ write, check }) => {
    write(
      owner,
      controller(validCreate)
        .replace('Controller, Get, Post,', 'Controller as RouteController, Get, Post as Write,')
        .replace('@Controller(', '@RouteController(')
        .replace('@Post()', '@Write()'),
    );
    assert.deepEqual(check().violations, []);
    write(
      owner,
      controller(validCreate)
        .replace(
          "import { Controller, Get, Post, Body, Query, HttpCode, Res } from '@nestjs/common';",
          "import * as Nest from '@nestjs/common';",
        )
        .replace('@Controller(', '@Nest.Controller(')
        .replace('@Post()', '@Nest.Post()')
        .replace('@Body()', '@Nest.Body()'),
    );
    assert.deepEqual(check().violations, []);
  }));

test('requires explicit auth and reviewed public access independently of the domain folder', () =>
  fixture(({ write, check }) => {
    write(owner, controller(validCreate, ''));
    assert.ok(check().violations.some((v) => v.rule === 'route-auth'));
    write(owner, controller(validCreate, '@PublicApi()'));
    assert.ok(check().violations.some((v) => v.rule === 'public-route-policy'));
    const routePolicy = {
      publicHandlers: [
        {
          file: owner,
          symbol: 'WidgetsController.create',
          reason: 'Explicitly reviewed public integration endpoint.',
        },
      ],
      memberMutations: [],
    };
    assert.deepEqual(check({ routePolicy }).violations, []);
    write(
      owner,
      controller(validCreate.replace('create(@Body()', 'otherAction(@Body()'), '@PublicApi()'),
    );
    assert.ok(check({ routePolicy }).violations.some((v) => v.rule === 'public-route-policy'));
    assert.ok(check({ routePolicy }).violations.some((v) => v.rule === 'stale-route-policy'));
    write(owner, controller(validCreate, '@PublicApi() @ProtectedApi()'));
    assert.ok(check().violations.some((v) => v.rule === 'conflicting-auth'));
  }));

test('does not exempt all mutations merely because they live in the auth domain', () =>
  fixture(({ write, check }) => {
    const file = 'src/modules/auth/auth.controller.ts';
    const method = `@Post() @ApiOperation({summary: 'Switch own context'})
      @ApiEnvelope(WidgetResponseDto, {status: 201}) switchOrganization() { return {}; }`;
    write(file, controller(method));
    assert.ok(check().violations.some((v) => v.file === file && v.rule === 'mutation-policy'));
    const routePolicy = {
      publicHandlers: [],
      memberMutations: [
        {
          file,
          symbol: 'WidgetsController.switchOrganization',
          reason: 'Self-service membership is checked in the service.',
        },
      ],
    };
    assert.ok(!check({ routePolicy }).violations.some((v) => v.rule === 'mutation-policy'));
    write(file, controller(method.replace('switchOrganization()', 'grantAccess()')));
    assert.ok(check({ routePolicy }).violations.some((v) => v.rule === 'mutation-policy'));
  }));

test('detects POST documentation that promises 200 while Nest returns 201', () =>
  fixture(({ write, check }) => {
    write(owner, controller(validCreate.replace(', { status: 201 }', '')));
    assert.ok(check().violations.some((v) => v.rule === 'response-status'));
    write(
      owner,
      controller(
        validCreate.replace(', { status: 201 }', '').replace('@Post()', '@Post() @HttpCode(200)'),
      ),
    );
    assert.deepEqual(check().violations, []);
  }));

test('accepts explicit binary transport without a JSON envelope', () =>
  fixture(({ write, check }) => {
    write(
      owner,
      controller(`@Get() @ApiOperation({ summary: 'Download' })
    @SkipApiResponse() @ApiProduces('application/octet-stream') download(@Res() response: unknown) { return response; }`),
    );
    assert.deepEqual(check().violations, []);
  }));

test('accepts empty 204 documentation but rejects a JSON envelope at 204', () =>
  fixture(({ write, check }) => {
    const method = `@Post() @Roles('ADMIN') @HttpCode(204) @ApiOperation({summary: 'Delete'})
    @ApiNoContentResponse() remove() { return; }`;
    write(owner, controller(method));
    assert.deepEqual(check().violations, []);
    write(
      owner,
      controller(
        method.replace('@ApiNoContentResponse()', '@ApiEnvelope(WidgetResponseDto, {status: 204})'),
      ),
    );
    assert.ok(check().violations.some((v) => v.rule === 'response-contract'));
  }));

test('checks file/class names and disallows unsafe raw SQL APIs', () =>
  fixture(({ write, check }) => {
    write('src/modules/widgets/BadService.ts', 'export const bad = 1;');
    write(
      'src/modules/widgets/widgets.service.ts',
      'export class WidgetHelper { run(db: any) { return db.$queryRawUnsafe("select 1"); } }',
    );
    const rules = check().violations.map((v) => v.rule);
    assert.ok(rules.includes('file-naming'));
    assert.ok(rules.includes('class-naming'));
    assert.ok(rules.includes('unsafe-raw-query'));
    write(
      'src/modules/widgets/widgets.service.ts',
      'export class WidgetsService { run(db: any) { const execute = db["$executeRawUnsafe"]; return execute("select 1"); } }',
    );
    assert.ok(check().violations.some((v) => v.rule === 'unsafe-raw-query'));
  }));

test('freezes only an exact reviewed legacy handler and rejects changes or new routes', () =>
  fixture(({ write, check }) => {
    const old = controller(
      validCreate.replace('@ApiEnvelope(WidgetResponseDto, { status: 201 })', ''),
    );
    write(owner, old);
    const baseline = check().violations.map((v) => ({
      ...v,
      reason: 'Existing response documentation debt at rollout.',
    }));
    write('scripts/backend-conventions-baseline.json', JSON.stringify(baseline));
    assert.deepEqual(check().violations, []);
    assert.equal(check().legacy.length, 1);
    write(owner, old.replace('return input;', 'return { name: input.name };'));
    assert.equal(check().violations.length, 1);
    assert.equal(check().staleBaseline.length, 1);
    write(owner, old.replace('return input;', 'return input; /* harmless formatting/comment */'));
    assert.equal(check().violations.length, 0);
    write(owner, old.replace('create(@Body()', 'newAction(@Body()'));
    assert.equal(check().violations.length, 1);
  }));

test('never allows security violations into the legacy baseline', () =>
  fixture(({ write, check }) => {
    write(owner, controller(validCreate.replace("@Roles('ADMIN')", '')));
    const baseline = check().violations.map((v) => ({ ...v, reason: 'Should not be allowed.' }));
    assert.throws(() => check({ baseline }), /cannot be exempted/);
  }));
