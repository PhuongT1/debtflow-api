---
name: review
description: Perform a read-only code review of NestJS changes for correctness, validation, access control, persistence and API regressions. Use when a code review is requested.
---

Read `AGENTS.md`, the applicable `.ai/core/` topics and project rules. Inspect Git status and the
requested diff, surrounding implementation and callers. Do not edit, fix, commit or push during review.
Report concrete introduced defects with severity, path/line and a failing scenario. Prioritize access,
data integrity and contract regressions. Omit speculative/style-only findings. If none qualify, state
that and name remaining verification gaps; passing static checks do not prove authorization or race safety.
