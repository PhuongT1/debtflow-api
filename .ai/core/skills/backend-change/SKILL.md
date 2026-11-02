---
name: backend-change
description: Implement or fix a NestJS backend feature, including routes, DTOs, services and persistence. Use for implementation requests, not read-only reviews or commit-only tasks.
---

Read `AGENTS.md`, `.ai/core/index.md` and the project rules selected by `.ai/project.json`.
Identify the owning feature, callers, public contract and applicable core topics before editing.
For providers, DTOs, types and queries, read `.ai/core/maintainability.md`: search existing owners
before defining contracts/helpers, and verify runtime metadata when reusing DTOs.
Preserve the installed stack and explicit access/resource/status invariants. Implement the requested
behavior, test its relevant failure cases and run the project's configured checks. Report actual
results and limitations. Implementation does not authorize commit, push, deployment or database data changes.
