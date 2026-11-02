# Commit Checklist

## Before Commit

- Run `git status --short`.
- Inspect changed files and diffs. Map independent purposes to separate commits in dependency order.
- For each commit, stage explicit paths/hunks and inspect only that staged diff.
- Verify that required imports, provider wiring, tests and generated artifacts are not stranded in a
  later commit. For a large split, build intermediate snapshots as well as checking the final tree.
- Keep the subject within 72 characters. Omit the body unless a brief explanation is useful.
- Confirm no secrets are staged.
- Confirm no unrelated files are included. Browser artifacts, VitePress temp output and unrelated
  document/CV scripts do not belong in a backend commit.
- Confirm migrations match Prisma schema changes.
- Confirm generated client changes are intentional if present.
- Run relevant validation or explain why it was skipped. Include `npm run check:architecture` for
  import/placement changes; `npm run check` is the combined backend check. Do not treat a passing
  import check as proof of tenant or transaction safety.

## Files To Treat Carefully

- `.env`, `.env.*`: usually do not commit real secrets.
- `prisma/migrations/**`: commit only intentional migration history.
- `src/generated/prisma/**`: commit only if this repo intentionally tracks generated Prisma client.
- Lockfiles: commit when dependency manager changes are intentional.

## Recommended Commands

Use these depending on the changed files:

```bash
git status --short
git diff
npm run db:check
npm run build
```

## Commit Message Examples

```txt
Add project-local review and commit skills
Split Prisma schema into domain files
Add Prisma workflow scripts
Document backend validation error shape
```
