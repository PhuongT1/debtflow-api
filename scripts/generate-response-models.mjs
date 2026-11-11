import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import generatorHelper from '@prisma/generator-helper';

// Base models are generated, not API contracts. Consumers must select their public fields.
export function renderResponseModel(model) {
  const scalars = {
    String: ['string', 'String'],
    Boolean: ['boolean', 'Boolean'],
    Int: ['number', 'Number'],
    Float: ['number', 'Number'],
    DateTime: ['Date', 'Date'],
    Decimal: ['Prisma.Decimal', 'String'],
  };
  const fields = model.fields.filter(({ kind }) => kind !== 'object');
  const enums = [...new Set(fields.filter(({ kind }) => kind === 'enum').map(({ type }) => type))];
  const imports = [
    "import { ApiProperty } from '@nestjs/swagger';",
    `import type { ${model.name}${fields.some(({ type }) => type === 'Decimal') ? ', Prisma' : ''} } from '../prisma/client.js';`,
    ...(enums.length ? [`import { ${enums.join(', ')} } from '../prisma/client.js';`] : []),
  ];
  const properties = fields.map((field) => {
    const scalar = field.kind === 'enum' ? [field.type, 'String'] : scalars[field.type];
    if (!scalar)
      throw new Error(`Unsupported response scalar: ${model.name}.${field.name} (${field.type})`);
    const [type, runtimeType] = scalar;
    const metadata = [
      `type: ${runtimeType}`,
      ...(field.kind === 'enum' ? [`enum: ${field.type}`] : []),
      `required: true`,
      ...(!field.isRequired ? ['nullable: true'] : []),
      ...(field.isList ? ['isArray: true'] : []),
      ...(field.documentation ? [`description: ${JSON.stringify(field.documentation)}`] : []),
    ];
    return `  @ApiProperty({ ${metadata.join(', ')} })\n  ${field.name}!: ${type}${field.isList ? '[]' : ''}${field.isRequired ? '' : ' | null'};`;
  });
  return `// Generated from Prisma. Do not edit. Select API fields with PickType.\n${imports.join('\n')}\n\nexport class ${model.name}Base implements ${model.name} {\n${properties.join('\n\n')}\n}\n`;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  generatorHelper.generatorHandler({
    onManifest() {
      return {
        prettyName: 'Response base models',
        defaultOutput: '../src/generated/response-models',
      };
    },
    onGenerate({ generator, dmmf }) {
      const output = generator.output?.value;
      const modelName = generator.config.model;
      const model = dmmf.datamodel.models.find(({ name }) => name === modelName);
      if (!output || !model)
        throw new Error('Response generator requires an output and a known model.');
      const source = renderResponseModel(model);
      mkdirSync(output, { recursive: true });
      writeFileSync(join(output, `${model.name.toLowerCase()}-base.ts`), source);
    },
  });
}
