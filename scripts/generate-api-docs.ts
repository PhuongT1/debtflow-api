/**
 * Generates docs/generated/openapi.json and docs/generated/api-reference.md from the compiled app.
 * Requires `npm run build` first (the Swagger CLI plugin only runs during `nest build`).
 * No database connection is opened: PrismaClient connects lazily and no request is served.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.DATABASE_URL ??= 'postgresql://docs:docs@localhost:5432/docs';
process.env.JWT_SECRET ??= 'docs-generation-only-secret-not-used';
process.env.NODE_ENV ??= 'docs';

type Schema = {
  $ref?: string;
  type?: string;
  format?: string;
  enum?: unknown[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  description?: string;
  allOf?: Schema[];
  oneOf?: Schema[];
};
type Parameter = {
  name: string;
  in: string;
  required?: boolean;
  schema?: Schema;
  description?: string;
};
type Operation = {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  security?: unknown[];
  'x-roles'?: string[];
};
type OpenApi = {
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema> };
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const outputDir = join(__dirname, '..', 'docs', 'generated');

async function main() {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/src/app.module');
  const { configureApp, createOpenApiDocument } = await import('../dist/src/configure-app');

  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  const document = createOpenApiDocument(app) as unknown as OpenApi;
  await app.close();

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
  writeFileSync(join(outputDir, 'api-reference.md'), renderMarkdown(document));
  console.log('Generated docs/generated/openapi.json and docs/generated/api-reference.md');
}

function renderMarkdown(document: OpenApi) {
  const groups = new Map<string, Array<{ method: string; path: string; op: Operation }>>();

  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      const tag = op.tags?.[0] ?? pathTag(path);
      groups.set(tag, [...(groups.get(tag) ?? []), { method, path, op }]);
    }
  }

  const total = [...groups.values()].reduce((sum, list) => sum + list.length, 0);
  const lines: string[] = [
    `# API Reference`,
    '',
    '> Generated from the OpenAPI document by `npm run docs:generate`. Do not edit by hand.',
    '> Fix the controller decorators or DTOs instead, then regenerate.',
    '',
    `**${document.info.title}** v${document.info.version} - ${total} endpoints.`,
    'Base URL: `http://localhost:4000/api`. Interactive docs: `/docs`. Raw spec: [openapi.json](./openapi.json).',
    '',
    '## Conventions',
    '',
    '- Protected endpoints need `Authorization: Bearer <access token>`. The token carries the active organization, so every query is tenant-scoped automatically.',
    '- "Roles" lists the organization roles allowed. `All members` means any authenticated active member (including `VIEWER`).',
    '- JSON responses use the envelope described in [api-response-format](../guides/api-response-format.md).',
    '- Send `Accept-Language: en` or `vi` (default `vi`) to localize messages: [localization](../guides/localization.md).',
    '- List endpoints accept `sort` and `filter[field][op]=value`: [list query](../guides/list-query.md).',
    '',
    '## Endpoint index',
    '',
    '| Method | Path | Access | Summary |',
    '| --- | --- | --- | --- |',
  ];

  for (const [tag, list] of groups) {
    for (const { method, path, op } of list) {
      lines.push(
        `| ${method.toUpperCase()} | \`${path}\` | ${access(op)} | ${op.summary ?? ''} (${tag}) |`,
      );
    }
  }

  for (const [tag, list] of groups) {
    lines.push('', `## ${tag}`);
    for (const { method, path, op } of list) {
      lines.push('', `### ${method.toUpperCase()} \`${path}\``, '');
      if (op.summary) lines.push(`**${op.summary}**`, '');
      if (op.description) lines.push(op.description, '');
      lines.push(`- Access: ${access(op)}`);

      const params = (op.parameters ?? []).filter((p) => p.in !== 'header');
      if (params.length > 0) {
        lines.push(
          '',
          '| Parameter | In | Type | Required | Description |',
          '| --- | --- | --- | --- | --- |',
        );
        for (const p of params) {
          lines.push(
            `| \`${p.name}\` | ${p.in} | ${typeOf(p.schema, document)} | ${p.required ? 'yes' : 'no'} | ${clean(p.description)} |`,
          );
        }
      }

      const body = op.requestBody?.content?.['application/json']?.schema;
      const resolved = body && resolve(body, document);
      if (resolved?.properties) {
        const required = new Set(resolved.required ?? []);
        lines.push(
          '',
          'Request body:',
          '',
          '| Field | Type | Required | Description |',
          '| --- | --- | --- | --- |',
        );
        for (const [name, schema] of Object.entries(resolved.properties)) {
          lines.push(
            `| \`${name}\` | ${typeOf(schema, document)} | ${required.has(name) ? 'yes' : 'no'} | ${clean(schema.description)} |`,
          );
        }
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function access(op: Operation) {
  if (!op.security || op.security.length === 0) return 'Public';
  return op['x-roles']?.length ? `Roles: ${op['x-roles'].join(', ')}` : 'All members';
}

function pathTag(path: string) {
  const segment = path.split('/').filter(Boolean)[0] ?? 'Other';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

function resolve(schema: Schema, document: OpenApi): Schema {
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop() as string;
    return document.components?.schemas?.[name] ?? schema;
  }
  return schema;
}

function typeOf(schema: Schema | undefined, document: OpenApi): string {
  if (!schema) return '';
  if (schema.$ref) return `\`${schema.$ref.split('/').pop()}\``;
  if (schema.enum) return schema.enum.map((value) => `\`${String(value)}\``).join(' \\| ');
  if (schema.type === 'array') return `${typeOf(schema.items, document) || 'any'}[]`;
  if (schema.allOf?.length) return typeOf(schema.allOf[0], document);
  return schema.format ? `${schema.type} (${schema.format})` : (schema.type ?? '');
}

function clean(value?: string) {
  return (value ?? '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
