# API, DTO and validation contract

- MUST preserve the project's route, status, response/error and versioning contract. Use explicit
  status metadata when overriding Nest defaults: POST normally returns 201; Swagger does not set
  runtime status. A 204 response has no body. Streams/files need an explicit transport exception.
- Bind whole request bodies/queries to runtime DTO classes imported as values. Interfaces,
  type-only imports, ORM inputs and `Record` do not provide runtime validation metadata.
  Use the validation stack installed by the project; do not introduce another library casually.
- With class-validator, every accepted input field needs meaningful validators. TypeScript types,
  Swagger examples and transforms alone do not validate values. Preserve global transformation,
  unknown-field rejection and the project's error factory.
- Separate create/update/query/output contracts. Output annotations do not strip sensitive runtime
  fields: use a safe database selection or explicit mapper. Document actual serialized dates,
  decimals, nullable fields and arrays. Do not use `Object`/`any` as a public response schema.
- Define omitted, null and blank behavior for each update field. Omitted means unchanged; clearing
  nullable data must be deliberate. `@IsOptional()` skips null as well as undefined.
  Mapped types do not prove correct PATCH semantics; verify inherited behavior.
- Reuse DTO fields with matching semantics through inheritance or the installed mapped-type utilities
  (`PickType`, `OmitType`, `PartialType` in Swagger-based projects). Keep one definition of validators
  for truly shared fields. Do not make a line item inherit its parent document or reuse create-field
  requirements for query parameters without checking their different optional/null semantics.
- Validate strings for type, allowed length and whitespace; enums with their actual set; IDs for
  the project's format. Validate related existence, ownership and status in the service.
- Convert query numbers explicitly, then require bounded integers where appropriate. Parse booleans
  strictly: `Boolean('false')` is true. Bound pagination, arrays, bulk inputs and sort/filter complexity.
- Nested class-validator inputs require array/size/element checks as applicable, `@ValidateNested`
  and class-transformer's `@Type`. Test an invalid nested object through the actual shared pipe.
- Validate monetary precision/scale and currency with the project's decimal representation.
  Check real calendar dates, timezone interpretation and cross-field date ordering.
  Do not trim passwords or change secret values while normalizing other text.
- Normalize once with an owned helper when shared. Map accepted fields explicitly; do not pass an
  entire request object into persistence. Check `!== undefined` instead of truthiness for updates.
- Document expected authentication, forbidden, validation, not-found and conflict outcomes.
  Use stable machine codes and the project's localization keys. Do not leak database errors or
  return HTTP success for failed operations. Regenerate API references from their source.

Example: an optional PATCH property whose stored value is required, with class-validator:

```ts
@ValidateIf((_input, value) => value !== undefined)
@IsString()
@Length(2, 100)
name?: string;
```

This rejects null but still needs the project's trim/nonblank normalization and error messages.
Test omitted/null/blank, wrong types, unknown fields, nested failures and boundary values.
