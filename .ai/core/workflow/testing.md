# Testing requests

Read the project's test layout, scripts and existing suites before adding a test. A request to test
an existing behavior does not authorize changing that behavior, production data or deployment.

## Choose the owner and boundary

- Extend the suite that owns the scenario; create a new file only for a distinct responsibility.
- Follow the project's `_test` layout. Keep feature tests and fixtures with that feature, infrastructure
  tests with their infrastructure owner, and application composition tests at the application boundary.
- Keep unit, HTTP and database scenarios clearly named. Use the existing runner and helpers; do not
  add another framework or duplicate a fixture/type/helper that already exists.
- Add cases that observe behavior: valid input, the relevant failure path, boundary values and any
  access/resource or transaction invariant affected. Do not mirror implementation statements.

## Verification scope

Follow [proportional verification](./verification.md#keep-verification-proportional): default to the
affected cases/suites, reuse passing results and ask before full-suite or deep verification. A
request to test one behavior does not authorize testing the whole application.

## Execute and report

- Use deterministic dates and sanitized fixtures. Mock external boundaries when the test is about
  orchestration; use real validation/serialization for HTTP contract tests.
- Database tests require an authorized isolated environment. Never fall back to the application's
  database or run migrations/seeds as an incidental test. State what mocks do not establish.
- Keep tests/fixtures outside production imports and build output. Update paths and runner commands
  together when moving suites. Run targeted tests and the project's typecheck/build when appropriate.
- Report the actual command, result, skipped coverage and material limitations. A test request does
  not authorize a commit, pull, push or deployment.
