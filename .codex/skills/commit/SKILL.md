---
name: commit
description: Prepare or create git commits for this repository. Use when the user says /commit, commit, commit code, prepare a commit, create a commit message, split changes into commits, or safely push commit-ready work after review and validation.
---

# Commit

Prepare clean commits. Only create commits when the user explicitly asks to commit. Never commit secrets or unrelated changes.

## Workflow

1. Inspect `git status --short`.
2. Identify changed files and separate unrelated work.
3. Read relevant diffs before staging or committing.
4. Check for secrets, `.env`, generated noise, lockfile churn, and unrelated files.
5. Run relevant validation before commit when practical.
6. Propose a concise commit message.
7. Commit only after the user has clearly asked for a commit.

Read `references/commit-checklist.md` before creating a commit.

## Commit Scope

Prefer small, coherent commits:

- One feature or fix per commit.
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
