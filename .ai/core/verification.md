# Verification, repository hygiene and delivery

- MUST inspect package scripts and project rules before choosing commands. Use the project's package
  manager/lockfile. Do not install tools, run migrations or execute seed/import scripts incidentally.
- Test the changed decision at its owning boundary: pure rule tests for decisions, real validation
  pipe tests for DTO behavior, HTTP tests for status/envelope/auth and service tests for orchestration.
  Prefer concrete negative cases over implementation-mirroring assertions.
- Run applicable lint, build, architecture/conventions gates and targeted tests. New automation needs
  valid and violating fixtures plus a plausible bypass/failure case. Do not broaden exemptions to pass.
- Generate API/schema documentation from source and build the docs site when affected. Do not claim
  mocks establish real database constraints or that static rules prove tenant/security correctness.
- Source rules, templates, skills, scripts, sanitized configuration and intentional generated public
  references belong in Git. Local generated AI installations, logs, caches, coverage, real secrets,
  editor sessions, downloaded artifacts and one-off experiments do not. Ignore precise paths; do not
  ignore whole configuration directories that also contain maintained team policy.
- Put reusable automation in the project's scripts directory. Keep scratch artifacts outside the
  repository or in an explicitly ignored scratch directory. Do not delete unrelated existing files.
- Review the final diff for scope, credentials and generated noise. Do not stage/commit unless asked;
  do not push, rewrite history, deploy or mutate database data without that action's authorization.
- Report actual changed behavior, checks and remaining limitations. A failed command must be explained
  or resolved, not silently counted as passing. Avoid unsupported production-readiness claims.

Rules guide any AI client that loads them. Runtime guards, database constraints, tests and required CI
checks enforce behavior regardless of the member's chosen AI. Setting a workflow as a required merge
check is a separate repository-admin operation; a workflow file alone does not enable it.
