import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { operatorsOf, validFieldsOf, type ListQueryConfig } from './list-query.types';

/** Documents the sort and filter parameters of a resource's allow-list in Swagger/OpenAPI. */
export function ApiListQuery(config: ListQueryConfig) {
  const sortable = validFieldsOf(config, 'sortable');
  const first = sortable[0] ?? 'createdAt';
  const decorators = [
    ApiQuery({
      name: 'sort',
      required: false,
      type: String,
      example: `-${first}`,
      description: `Comma-separated fields, \`-\` prefix for descending, max 3. Allowed: ${sortable.join(', ')}.`,
    }),
    ApiQuery({
      name: 'sortBy',
      required: false,
      enum: sortable,
      description: 'Single-field alternative to `sort`. Ignored when `sort` is present.',
    }),
    ApiQuery({
      name: 'sortOrder',
      required: false,
      enum: ['asc', 'desc'],
      description: 'Direction used with `sortBy`. Default asc.',
    }),
    ApiQuery({
      name: 'filterOperator',
      required: false,
      enum: ['AND', 'OR'],
      description: 'How the `filter[...]` conditions are combined. Default AND.',
    }),
  ];

  for (const [name, field] of Object.entries(config.fields)) {
    if (field.filterable === false || (field.computed && !field.filter)) continue;

    const values =
      field.type === 'enum' && field.values ? ` Values: ${field.values.join(', ')}.` : '';

    decorators.push(
      ApiQuery({
        name: `filter[${name}]`,
        required: false,
        type: String,
        description:
          `${field.description ?? ''} Type: ${field.type}.${values} ` +
          `Use \`filter[${name}][op]=value\`, op: ${operatorsOf(field).join(', ')} ` +
          `(no op means eq; \`in\`, \`notIn\` and \`between\` take comma-separated values).`,
      }),
    );
  }

  return applyDecorators(...decorators);
}
