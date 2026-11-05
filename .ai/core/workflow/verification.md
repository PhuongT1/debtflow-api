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

## Keep verification proportional

This policy applies to EVERY prompt and task: questions, implementation, bug fixes, refactoring,
rules/documentation/configuration edits, review and commit work. A request to finish, check or commit
is not permission to broaden verification. For a question, inspect only the evidence needed to answer;
do not run tests when no executable behavior needs checking.

- MUST choose the smallest checks that cover the changed behavior and its direct callers. Run the
  affected spec file(s), or individual cases when sufficient; do not run the entire application suite
  after every request. Relevant validation, permission, tenant and failure-path cases still belong
  in the targeted selection.
- Reuse passing results for unchanged code. Do not repeat tests, builds or documentation generation
  merely to finish a response or create a commit. Rules/docs/config-only edits need only their
  applicable syntax, link, configuration or installation checks, not application tests.
- MUST obtain explicit user approval before running a full suite/combined all-project check or
  expanding into deep verification: broad integration/e2e, database, load/performance, exhaustive
  coverage or multi-runtime matrices. First state the concrete reason, proposed commands and scope;
  wait for the answer. An ordinary implementation, review or commit request is not that approval.
  If the user already explicitly requested that exact verification scope, do not ask again.
- A targeted failure permits investigation and rerunning affected cases after a fix; it does not
  authorize a full-suite escalation. If wider verification is needed, request approval and report
  any pending coverage honestly. Leave existing CI checks in place; this policy governs agent-run work.
- Summarize only relevant checks and material gaps. Do not present unrun coverage as passing or add
  a long verification report to a small change.

Rules guide any AI client that loads them. Runtime guards, database constraints, tests and required CI
checks enforce behavior regardless of the member's chosen AI. Setting a workflow as a required merge
check is a separate repository-admin operation; a workflow file alone does not enable it.
