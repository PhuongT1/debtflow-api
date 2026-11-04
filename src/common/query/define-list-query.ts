import { LIST_QUERY_MODELS } from '#generated/list-query/models.js';
import type { FieldType, ListQueryConfig } from './list-query.types.js';

const SCALAR_TYPES: Record<FieldType, readonly string[]> = {
  string: ['String'],
  enum: [],
  number: ['Int', 'BigInt', 'Float'],
  decimal: ['Decimal'],
  date: ['DateTime'],
  boolean: ['Boolean'],
};

/**
 * Declares which fields of a resource clients may filter and sort on. When `model` is given, every
 * field is checked against the Prisma schema right away, so a renamed column or a wrong `type` fails
 * at startup instead of at the first request.
 */
export function defineListQuery(config: ListQueryConfig): ListQueryConfig {
  if (config.model) assertMatchesPrismaModel(config, config.model);

  return config;
}

function assertMatchesPrismaModel(config: ListQueryConfig, modelName: string) {
  const models = LIST_QUERY_MODELS;
  const find = (name: string) => models.find((model) => model.name === name);

  if (!find(modelName)) throw new Error(`defineListQuery: unknown Prisma model "${modelName}".`);

  for (const [name, field] of Object.entries(config.fields)) {
    // Fields with their own hooks (or no column at all) are not tied to a single column.
    if (field.computed || field.sort || field.filter) continue;

    const segments = (field.path ?? name).split('.');
    let model = find(modelName);

    for (const [index, segment] of segments.entries()) {
      const column = model?.fields.find((candidate) => candidate.name === segment);
      const where = `defineListQuery(${modelName}): field "${name}"`;

      if (!column) throw new Error(`${where} points to "${segment}", which does not exist.`);

      if (index < segments.length - 1) {
        if (column.kind !== 'object') throw new Error(`${where}: "${segment}" is not a relation.`);
        model = find(column.type);
        continue;
      }

      const expected = field.type === 'enum' ? column.kind === 'enum' : column.kind === 'scalar';
      const compatible = field.type === 'enum' || SCALAR_TYPES[field.type].includes(column.type);

      if (!expected || !compatible) {
        throw new Error(
          `${where} is declared as "${field.type}" but the Prisma column is ${column.kind} ${column.type}.`,
        );
      }
    }
  }
}
