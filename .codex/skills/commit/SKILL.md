---
name: commit
description: Prepare or create git commits for this repository. Use when the user says /commit, commit, commit code, prepare a commit, create a commit message, split changes into commits, or safely push commit-ready work after review and validation.
---

# Commit

Prepare clean commits. Only create commits when the user explicitly asks to commit. Never commit secrets or unrelated changes.

## Workflow

1. Inspect `git status --short`.
2. Group changed files/hunks by purpose and dependency order. Multiple independent purposes require
   multiple commits; name each group before staging. Separate unrelated work.
3. Read relevant diffs before staging or committing.
4. Check for secrets, `.env`, generated noise, lockfile churn, and unrelated files.
5. Run relevant validation before commit when practical.
6. State the commit groups and concise titles. Stage and inspect one group at a time.
7. Commit only after the user has clearly asked for a commit.

Read `references/commit-checklist.md` before creating a commit.

## Commit Scope

Prefer small, coherent commits:

- One reviewable purpose per commit. Split tooling, source reorganization, independent behavior fixes,
  API contract changes and documentation when they can stand on their own.
- Stage explicit paths or hunks for each group. Do not use one repository-wide add/commit for a
  mixed working tree. A file shared by several concerns may need hunk-level or intermediate staging.
- Keep a move/import change together with its required wiring. Order prerequisites first so each
  commit builds; use temporary snapshots to verify intermediate trees when splitting a large change.
- Group the owning tests and generated references with their source change where practical. Do not
  force one commit per file; closely related files belong together.
- Schema/migration changes can be committed with code that depends on them.
- Avoid mixing formatting-only changes with behavior changes.
- Do not include user-local files, secrets, or accidental generated artifacts.

## Validation

Use the smallest relevant checks:

- Prisma/schema changes: `npm run db:check`.
- Backend TypeScript changes: `npm run build`.
- Lint-only or simple docs changes: explain when tests are unnecessary.

If a command cannot run, report that clearly and do not pretend it passed.

## Commit Message Style

Match the repository history with concise Conventional Commits (`type(scope): imperative summary`).
Keep the subject at most 72 characters. Default to the subject alone. If a non-obvious reason needs
explaining, add a short paragraph or at most three brief bullets. Report the full validation results
in the final response, rather than copying a task report into every commit body. A message listing
many independent changes is a signal to split the commit again.

Use `feat`, `fix`, `refactor`, `docs`, `test` or `chore` for the actual change. Examples:

```txt
refactor(prisma): split schema by domain
chore(ai): add backend contribution rules
fix(auth): preserve localized login errors
```

Avoid vague messages:

```txt
update
fix bug
changes
```

## Safety Rules

- Do not commit `.env` files or secrets.
- Do not run destructive git commands unless the user explicitly asks.
- Do not revert user changes unless the user explicitly asks.
- Do not push unless the user explicitly asks.
- If unrelated changes are present, ask or commit only the requested subset.
