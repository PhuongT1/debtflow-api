import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import generatorHelper from '@prisma/generator-helper';

const { generatorHandler } = generatorHelper;

// Prisma's generator protocol supplies schema metadata without opening a database connection.
// Only the field shape used by list-query validation is retained; no runtime/private Prisma API.
generatorHandler({
  onManifest() {
    return {
      prettyName: 'List query schema metadata',
      defaultOutput: '../src/generated/list-query',
    };
  },
  onGenerate({ generator, dmmf }) {
    const output = generator.output?.value;
    if (!output) throw new Error('List query metadata requires a generator output directory.');
    const models = dmmf.datamodel.models.map(({ name, fields }) => ({
      name,
      fields: fields.map(({ name, kind, type }) => ({ name, kind, type })),
    }));
    mkdirSync(output, { recursive: true });
    writeFileSync(
      join(output, 'models.ts'),
      '// Generated from the Prisma schema. Do not edit.\n' +
        `export const LIST_QUERY_MODELS = ${JSON.stringify(models)};\n`,
    );
  },
});
