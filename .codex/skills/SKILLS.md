# DebtFlow API Skills

DebtFlow-specific skill sources live here; portable defaults live in `.ai/core/skills/`.
Run `npm run ai:setup` to install the configured skills for Codex, Claude Code and Cursor.
Read the root `AGENTS.md` and `.ai/core/index.md` first. Skills add task workflows, not separate policy.
Edit these sources and rerun setup; `.agents/skills/`, `.claude/skills/` and `.cursor/skills/` are ignored
local copies. Same-named project skills replace the complete core skill, including its references.

| Skill | Use for | Mutation boundary |
| --- | --- | --- |
| `$backend-change` or `/backend-change` | Implement or fix a NestJS API feature, DTO, service, query or persistence workflow | Work within the requested change; database writes, commit and deployment need their own authorization |
| `$review` or `/review` | Review diffs for correctness, tenancy, permissions, money, migrations and test gaps | Read-only; no fixes, commits or pushes during a review request |
| `$commit` or `/commit` | Inspect scope, validate and create coherent commits | Local commits only; pull/push/deploy require a separate explicit request |

Examples:

```text
Use $backend-change to fix party assignee validation
/review current changes
/commit reviewed changes
```

Slash names are project text aliases and may not appear in an editor's slash-command UI. Normal
natural-language implementation, review and commit requests also select the matching workflow.

Keep each skill focused. Put always-applicable rules in `AGENTS.md`, detailed engineering guidance in
`docs/guides/ai-development.md`, and substantial task-specific details in skill references. Do not
copy another project's stack, commands or credentials into a skill for this API.
