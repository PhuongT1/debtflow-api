---
name: review
description: Review code changes in this repository. Use when the user says /review, review, code review, check my changes, review uncommitted changes, compare against a branch, inspect a PR-like diff, or check NestJS, Prisma, API, validation, auth, migration, security, or test risks before merging.
---

# Review

Perform a read-only, defect-first review. Do not edit files, create commits, push branches, or fix issues unless the user explicitly asks after the review.

## Workflow

1. Read repository instructions such as `AGENTS.md` when present.
2. Inspect `git status --short` to understand changed files.
3. Inspect the relevant diff:
   - For uncommitted changes, use `git diff` and staged diff when relevant.
   - For branch comparison, resolve the merge base and review the diff that would merge.
4. Read enough surrounding code and call sites to prove each finding.
5. Check relevant validation, tests, scripts, migrations, and generated-code impact.
6. Return findings first, ordered by severity.

## Review Focus

Read `references/review-checklist.md` when the change touches backend behavior, Prisma, auth, validation, API contracts, or project workflow.

Prioritize:

- Correctness bugs and regressions.
- Security and auth/authorization mistakes.
- API contract or error-shape breaks.
- Prisma schema, migration, seed, or generated client issues.
- Data-loss or production migration risk.
- Missing validation for money, identity, ownership, or status transitions.
- Tests or verification gaps for risky changes.

Avoid:

- Style-only comments.
- Speculative issues without a concrete failing scenario.
- Pre-existing problems not introduced by the reviewed change.
- Large refactor suggestions that are unrelated to the change.

## Output Format

Use this format for each issue:

```txt
[P1] Imperative finding title - path/to/file.ts:12
Short explanation of the affected scenario, why it is wrong, and what should change.
```

Priorities:

- `P0`: release blocker, data loss, critical security issue.
- `P1`: urgent defect that should be fixed before merge.
- `P2`: normal defect that should be fixed.
- `P3`: low-impact but actionable issue.

If there are no qualifying findings, say:

```txt
No findings.
```

Then add a short residual-risk or test-gap note.
