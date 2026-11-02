---
name: commit
description: Prepare or create scoped Git commits when the user asks to commit or prepare a commit. Use for commit work, not ordinary implementation.
---

Read `AGENTS.md` and `.ai/core/verification.md`. Inspect status, staged/unstaged diffs and project checks.
Separate unrelated work and exclude secrets, local AI outputs and generated noise. Run proportional
verification. Stage/create a commit only for the explicitly requested scope; preparing a message is
not permission to commit. Never push, amend, rewrite history or revert user changes without authorization.
