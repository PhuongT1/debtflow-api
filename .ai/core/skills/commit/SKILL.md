---
name: commit
description: Prepare or create scoped Git commits when the user asks to commit or prepare a commit. Use for commit work, not ordinary implementation.
---

Read `AGENTS.md` and `.ai/core/verification.md`. Inspect status, staged/unstaged diffs and project checks.
Separate unrelated work and exclude secrets, local AI outputs and generated noise. Run proportional
verification. Stage/create a commit only for the explicitly requested scope; preparing a message is
not permission to commit. Commit requests authorize local work only: do not contact remotes, pull,
fetch, push, troubleshoot credentials or deploy without a separate explicit request for that action.
"Commit so I can push/deploy" is context, not authorization. Stop after local commits and report
hashes and status. Never amend, rewrite history or revert user changes without authorization.
Reuse checks already passed for the exact unchanged tree; validate only changed/unverified scope
or reconstructed intermediate trees. Do not rerun a full suite or regenerate unchanged docs solely
because a commit was requested.

Group independent purposes into separate commits, ordered by their prerequisites. State the groups
and titles, then stage explicit paths/hunks and review one staged group at a time. Preserve buildable
intermediate snapshots; do not split required wiring away from a move or force one commit per file.
Use a Conventional Commit subject of at most 72 characters. Default to no body; add only a brief
reason when needed. Keep long change inventories and validation reports in the final response.
