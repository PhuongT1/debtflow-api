# AI rules and skills

Start with the repository's `AGENTS.md`, then [core/index.md](./core/index.md). Load only the topic
needed for the current task; do not read every rule or run every check for each prompt.

| Location | Responsibility |
| --- | --- |
| [core/architecture/](./core/architecture) | File/module/provider ownership, naming, reuse and maintainability |
| [core/backend/](./core/backend) | API validation, security and persistence principles |
| [core/workflow/](./core/workflow) | Test selection, verification scope, reporting and Git hygiene |
| [core/skills/](./core/skills) | Portable backend-change, review and commit workflows |
| [skills/](./skills/SKILLS.md) | Project-specific workflows that override portable defaults |
| [project.json](./project.json) | Project rules, skill sources and available commands |
| `generated/`, `local-state.json`, `scratch/` | Ignored local installation state and temporary work |

DebtFlow-specific implementation rules stay in `docs/guides/backend-rules/`. Keep generic NestJS
principles in `core/`; do not mix project assumptions into the portable rules.

For EVERY request, follow [verification scope](./core/workflow/verification.md#keep-verification-proportional):
check only the affected behavior and necessary dependencies; reuse passing results for unchanged
code. Full-suite or deep verification requires explicit user approval before execution, unless that
exact scope was already requested. Questions and rules-only edits do not require application tests.

Edit source rules/skills here. `npm run ai:setup` generates client adapters and skill copies for
Codex, Claude Code, Cursor and Copilot; `npm run ai:check` checks their installation. Do not edit the
generated client copies. See [team setup](../docs/team/ai-setup.md).
