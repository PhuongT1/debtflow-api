# Team AI setup and portable NestJS rules

Every member uses the same reviewed sources, regardless of AI client. After cloning or pulling
updated rules/skills, run:

```bash
npm run ai:setup
npm run ai:check
```

Setup runs offline with Node built-ins only. It does not install dependencies, run configured shell
commands, read `.env`, access a database, modify global AI settings, commit or push. No npm lifecycle
hook runs it implicitly. Reload/restart the AI session after installation.

## Two layers

| Layer                 | Maintained source                         | Responsibility                                                                                                                        |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Portable NestJS core  | `.ai/core/`                               | Names, module/provider ownership, controller/service boundaries, validation, security principles, transactions, tests and Git hygiene |
| Portable workflows    | `.ai/core/skills/`                        | Default backend-change, review and commit skills                                                                                      |
| Project configuration | `.ai/project.json`                        | Name, project rule entry points, skill source folders and verification commands                                                       |
| DebtFlow contract     | `AGENTS.md`, `docs/guides/backend-rules/` | Feature paths, REST envelope, Prisma/Decimal, tenant/current-role policy, EN/VI and audit semantics                                   |
| DebtFlow workflows    | `.ai/skills/`                          | Authored project skills/checklists shared by every AI client                                        |
| Local installations   | Client folders and `.ai/generated/`       | Recreated adapters, context and skills; ignored by Git                                                                                |

Core is mandatory for changed code. Project rules specialize it, naming any intentional exception.
Skills select workflows; they do not supersede policy or authorize unrelated actions. Later
`skillSources` entries replace a complete same-named core skill, including its resources.

Setup renders reviewed project knowledge; it does not ask a model to guess business rules from file
names. Maintainers update source rules when behavior changes. New members receive that exact policy.
Manifest commands are reference data, never executable setup hooks.

## Clients

| Client         | Instruction entry                                                         | Task skills                                |
| -------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| Codex          | Root `AGENTS.md` → core/project rules                                     | `.agents/skills/<name>/SKILL.md` (also mirrored to `.codex/skills/`)           |
| Claude Code    | `CLAUDE.md` imports root policy, core index and generated context         | `.claude/skills/<name>/SKILL.md`           |
| Cursor         | `.cursor/rules/team-nestjs.mdc`, `alwaysApply: true`                      | `.cursor/skills/<name>/SKILL.md`           |
| GitHub Copilot | `.github/copilot-instructions.md` → shared policy                         | No Copilot skill integration is promised   |
| Other clients  | Configure their instruction loader to read `AGENTS.md` and the core index | Use portable SKILL.md sources if supported |

Check the client's loaded-instruction/skill view after restarting. Discovery, slash-command conflicts,
directory scope and user/global overrides vary by version. Tests verify installed files, not that
every client obeys them. A Markdown link alone does not guarantee inclusion; adapters explicitly
tell agents to read the sources.

Paths follow official [Codex instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
[Codex skills](https://learn.chatgpt.com/docs/build-skills),
[Claude memory](https://code.claude.com/docs/en/memory), [Claude skills](https://code.claude.com/docs/en/skills),
[Cursor rules](https://cursor.com/docs/rules) and [Cursor skills](https://cursor.com/docs/skills).

## Safe regeneration

Setup validates sources and preflights every output/removal before writing. `.ai/local-state.json`
stores installed content hashes. Unchanged managed files can update; edited files or unrelated
existing adapters cause a conflict instead of being overwritten. Preserve/move local changes out of
the managed path before retrying. There is no force-delete flag.

Edit versioned sources, never installed copies. Unmanaged member skills with other names remain
untouched. Removed resources are deleted only when their hash still matches. Symlink paths,
out-of-repo paths, malformed skills/config and invalid state are rejected. File copies avoid requiring
symlink support. Authored `AGENTS.md` is retained and must reference `.ai/core/index.md`.

`ai:check` is read-only and fails for missing/outdated outputs, conflicts or a missing ignore block.
Rules are referenced directly from source, so their text does not need duplicated generated copies.

## Git policy

Commit core, project configuration, authored rules/skills, root `AGENTS.md`, setup script/tests,
package scripts and `.gitignore`. DebtFlow's public generated API/database references stay versioned.

Setup maintains a narrow, marked `.gitignore` block for installed skills, generated client adapters,
context and local state. Other ignore rules are preserved. Do not ignore entire `.github/`, `.codex/`,
`.ai/`, `.claude/` or `.cursor/` directories that may contain team-owned configuration.
Local secrets/sessions, build/test output, logs and scratch files are ignored separately.

```bash
git status --short
git check-ignore .agents/skills/review/SKILL.md .ai/local-state.json CLAUDE.md
```

Ignore rules do not remove tracked files. If a future checkout has tracked local installations,
review and explicitly untrack just those outputs as a separate Git change. Setup never edits the
Git index. `.ai/skills/` is authored source; `.codex/skills/` is now a generated, ignored mirror.
When migrating an older checkout, move authored skills into `.ai/skills/` and untrack only their
former client paths. Setup itself never edits the index or removes authored sources.

## Copy to another NestJS project

Copy **only** `.ai/core/` and `scripts/ai-setup.mjs` into matching paths of the new repo. Do not copy
DebtFlow's manifest, business rules, baselines, Prisma/auth decorators or project checkers as generic
NestJS requirements. From the new repo root:

```bash
node scripts/ai-setup.mjs --init
```

Initialization reads `package.json` for name, declared package manager and existing lint/test/build/check
commands. It creates a version-1 manifest only when absent. Without a declared package manager it
defaults to npm; maintainers must verify that choice. Existing configuration is never replaced.

Then configure the new project's actual rules, for example:

```json
{
  "version": 1,
  "name": "Orders API",
  "rules": ["docs/backend-contract.md"],
  "skillSources": [],
  "commands": {
    "lint": "npm run lint",
    "test": "npm test",
    "build": "npm run build"
  }
}
```

Only configure existing paths. Keep `skillSources: []` for defaults or supply a folder containing
project-specific skill directories under `.ai/` (normally `.ai/skills/`). Generated client
folders cannot be used as source. Document the actual feature roots, ORM, auth/policy, ownership,
envelope/errors, business invariants, events and tests in the project contract. Setup does not infer
these. If root `AGENTS.md` exists, add the core index to its required reading; it is preserved.
If absent, setup creates a small root entry that should be committed.

Add package scripts; no dependency is needed:

```json
{
  "ai:setup": "node scripts/ai-setup.mjs",
  "ai:check": "node scripts/ai-setup.mjs --check"
}
```

Run setup/check, review and commit maintained sources/ignore rules/root entry. Later members only
run setup. Optionally copy `scripts/ai-setup.test.mjs` to retain portability/conflict regression tests.

## Enforcement and Vendure evidence

DebtFlow's `npm run check` verifies AI installation, setup regression tests, backend build,
architecture/conventions/maintainability gates, checker tests, lint and unit tests. CI runs setup first on a clean
checkout, then checks and documentation generation/build.

The [Vendure source map](./backend-rules/vendure-source-map.md) records 30 pinned source anchors and
traced Customer/Product/Role flows. The core carries useful principles; DebtFlow rules document the
REST/Prisma adaptations. This is a focused source study, not an audit of every Vendure feature.

Rules cannot force every AI to comply. Runtime validation/guards, constraints, behavioral tests and
required CI checks enforce behavior. Maintainers configure `API quality` as a required merge check
separately; setup does not change remote branch protection.
