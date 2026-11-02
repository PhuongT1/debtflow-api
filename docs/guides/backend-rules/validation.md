# Request validation and normalization

Vendure validates the transport with GraphQL input definitions and validates business/configured
values in services/strategies and `validateCustomFieldValue` (V04, V09–V11). It does not establish that
every REST field is validated by a `class-validator` DTO. DebtFlow uses the existing Nest validation
pipe and concrete DTO classes for its REST boundary.

## VAL-01 — runtime validation, not TypeScript assertions

Whole-object `@Body()`/`@Query()` MUST use a runtime class imported as a value. Interfaces, `Record`,
`any`, `Prisma.*Input`, `as SomeDto`, or `import type { CreatePartyDto }` do not supply DTO validation
metadata to Nest. Keep global `transform`, `whitelist`, `forbidNonWhitelisted` and the shared exception
factory. Dynamic sort/filter keys go through `@ListQuery`; do not disable validation to accept them.

Every accepted request field MUST have actual validators, directly or deliberately inherited. A
Swagger example, a TypeScript `?`, a `@Transform`, or `@IsOptional` alone is not a constraint on values.
Derived request types use the Swagger-compatible mapped-type utilities already used by the project,
but MUST be checked for inherited optional/null behavior. Do not validate response-only DTOs as inputs.

## VAL-02 — choose validators by the domain value

| Value                    | Required decisions/checks                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Required text/name/title | `@IsString`, trim if appropriate, nonempty/length limits; whitespace-only must not pass                         |
| Optional free text       | explicit max length and documented blank/null semantics                                                         |
| Enum                     | `@IsEnum` with the real enum; no assertion from an arbitrary string                                             |
| Email/phone/code         | trim/normalize as defined; format/length checks; unique conflicts handled by the database/filter                |
| Pagination/count         | explicit numeric conversion plus `@IsInt`, min/max; reject excessive page size                                  |
| Boolean query            | parse only the documented boolean spelling; do not rely on `Boolean('false')`                                   |
| Money                    | decimal string, precision/scale bound matching the schema; service positivity and business balance rules        |
| Date-only                | exact `YYYY-MM-DD`, valid calendar date, Vietnam business-day boundaries                                        |
| Timestamp                | documented ISO timestamp/timezone interpretation; reject malformed values, enforce cross-field order in service |
| ID                       | nonempty expected format; service verifies existence, owner, tenant and active state                            |
| Array/nested input       | array + bounded size + element validators, `@ValidateNested({ each: true })` and `@Type(() => ChildDto)`        |
| Password                 | do not trim/change the secret; preserve bcrypt UTF-8 byte limit and current strength policy                     |

Limits must come from the actual use case, schema and existing client contract. Do not copy arbitrary
limits, permissive password defaults, numeric-money behavior or implicit conversions from another project.
For large/bulk input, choose a concrete cap so validation and database work remain bounded.

## VAL-03 — PATCH omission is different from null

Before coding each update field, define all four cases:

| Input                      | Default meaning for new PATCH contracts                                         |
| -------------------------- | ------------------------------------------------------------------------------- |
| Omitted / `undefined`      | keep the stored value                                                           |
| `null` on a nullable field | clear it, when this is an allowed operation                                     |
| `null` on a required field | reject; document any compatibility exception                                    |
| Empty/whitespace string    | reject for required fields; clear optional text only if the contract permits it |

`@IsOptional()` skips both `undefined` and `null`. For a required stored property that is optional in a
PATCH, the existing Users pattern is deliberate:

```ts
@ValidateIf((_object, value) => value !== undefined)
@Trim()
@Length(2, 100)
name?: string;

@ValidateIf((_object, value) => value !== undefined && value !== null)
@Trim()
@Matches(PHONE_PATTERN, { message: 'validation.INVALID_PHONE' })
phone?: string | null;
```

The mapping checks `input.phone !== undefined`, not truthiness; otherwise clearing a phone or setting
a numeric value to zero may be lost. `PartialType` is not proof of correct null semantics. Existing
Party PATCH intentionally ignores null `name`/`type`; preserve that compatibility unless changing it
is authorized. Do not copy it as the default for a new resource.

## VAL-04 — normalize once, preserve meaning

Use established `@Trim`, `OptionalBlank`, normalization and data-mapping helpers. Do not coerce an
object into `'[object Object]'`, convert null into `'null'`, lowercase opaque IDs/passwords or overwrite
omitted fields. PATCH derived values such as search text MUST be built from the merged persisted and
submitted values; changing a note must not erase a phone or regenerate unrelated identity data.

Normalization and syntactic validation do not authorize a related resource. Check allowed status,
cross-field date range, remaining money, membership and ownership in the service using the tenant.

**Acceptance:** use the real shared validation pipe where whitelist/transform/error behavior matters.
Test invalid type, whitespace, unknown key, omitted/null/blank, boundary lengths/precision, invalid
calendar dates and nested failures as applicable. Check EN/VI summary and field errors for new keys.

Framework reference: [Nest validation](https://docs.nestjs.com/techniques/validation). The concrete
requirements above are project choices derived from the current DTO/pipe code and observed failures.
