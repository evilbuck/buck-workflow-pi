---
cluster: HARNESS & WORKFLOW WIRING
skills_covered: 0
---

## Verdict

- This cluster is the **packaging and invocation layer** for Buck Workflow: how portable `skills/` are exposed as slash commands, wired into Pi/OMP/Claude/Codex/OpenCode/Grok, and augmented with a small TypeScript extension runtime.
- The spine is a **three-layer model** documented in-repo: canonical skills → thin prompt/command wrappers → `extensions/index.ts` runtime hooks (`README.md:182-184`).
- **Pi and OMP are first-class**: both load the same checkout via `package.json` `pi` / `omp` keys (`package.json:42-63`); OMP additionally requires a `commands/` symlink mirror because it discovers slash commands from `commands/` not `prompts/` (`docs/extension-loading.md:66-79`).
- **Distribution is hybrid**: package managers (`pi install` / `omp install`), durable git clone + `node scripts/install.mjs` for bootstrap/skills/commands on non-package harnesses, and Codex marketplace plugin (`README.md:71-96`, `agent-install_instructions.md:75-82`).
- The most distinctive mechanic is the **prompts↔commands single-source-of-truth mirror**: Pi slash bodies live in `prompts/`; OMP discovers identical bodies via `commands/<name>.md → ../prompts/<name>.md` symlinks (`docs/extension-loading.md:79-103`).
- **Extension-based orchestration is explicitly deprecated** in favor of prompt/skill surfaces and OMP user-toggled primitives; `b-flow` and friends remain in-tree but unwired (`docs/buck-workflow.md:43-56`, `README.md:292`).

## Layer Table

| Component | Kind | Location | Purpose | Portable? |
|---|---|---|---|---|
| Canonical skills | Skill dirs | `skills/<name>/SKILL.md` | Agent-neutral workflow logic (owned by sibling scouts, not this cluster) | Yes — Agent Skills standard |
| Prompt wrappers | Markdown slash bodies | `prompts/*.md` (33 files) | Pi slash commands; Claude/OpenCode/Grok command source; thin “load skill X” indirection | Yes — plain Markdown |
| OMP command mirror | Symlinks + 4 native files | `commands/*.md` (36 entries) | OMP slash discovery; 33 symlinks to `../prompts/*.md`; 4 extension-only commands without prompt twins | Pi/OMP package layout |
| Package manifest | npm `package.json` | `package.json` | Declares `pi.extensions/prompts/skills` and `omp.extensions/commands/skills`; publishes `files` whitelist | Pi + OMP |
| Wired extension entry | TypeScript | `extensions/index.ts` | Loads TPS tracker, model auto-switch, `*-improved` commands, opt-in plan-artifact | Pi + OMP (peer: `@mariozechner/pi-coding-agent`) |
| TPS tracker submodule | TypeScript hook module | `extensions/tps-tracker.ts` | Live tok/s in status bar + end-of-run notify | Pi/OMP with UI |
| Plan-artifact submodule | TypeScript hook module | `extensions/plan-artifact.ts` | Opt-in OMP plan-mode exit → `.context/<date>.<slug>/plan-*.md` | OMP plan mode only |
| Improved-command submodules | TypeScript commands | `extensions/b-save-improved/`, `b-pr-improved/`, `b-commit-improved/`, `b-kamal-release/` | Deterministic code paths via `registerCommand` | Pi/OMP when extension loaded |
| Shared extension utilities | TypeScript libs | `extensions/command-progress.ts`, `extensions/omp-models.ts` | Progress UI, nested OMP model sessions, exec helpers | Internal |
| Unwired historical extensions | TypeScript (not in manifest) | `extensions/b-flow/`, `b-grill-auto/`, `grill-me-dialog.ts`, `tmux-window-status.ts` | Archival orchestration, RPC grill, tmux icons — retained + tested, not loaded | No — deprecated/unwired |
| Extension tests | Vitest | `extensions/**/*.test.ts`, `extensions/b-flow/__tests__/` | Regression for wired + archival extension code | Dev-only |
| Multi-harness installer | Node CLI | `scripts/install.mjs` (`bin.buck-workflow`) | Symlink bootstrap + skills + commands into Claude/Codex/OpenCode/Grok; bootstrap-only for Pi/OMP | All listed harnesses except Cursor global |
| Global bootstrap | Markdown | `GLOBAL_OR_PROJECT-AGENTS.md` | Durable `.context/` conventions; symlinked per harness | Yes |
| Codex plugin manifest | JSON marketplace | `plugins/buck-workflow/.codex-plugin/plugin.json` | Ships `skills/` to Codex Plugins Directory | Codex only |
| Workflow docs | Markdown | `docs/buck-workflow.md`, `docs/extension-loading.md`, harness refs (`pi.md`, `oh-my-pi.md`, `claude-code.md`, `codex.md`, `goose.md`) | Authoritative loading model, OMP primitives, install semantics | Yes |
| Context index tooling | npm scripts | `scripts/context-artifacts.ts` via `npm run context:index` | Regenerate `.context/index/*.json` query views | Project-local |
| Archival docs | Markdown | `docs/b-flow.md`, `docs/eval-kernel.md`, `docs/research-source-dictionary.md` | Historical b-flow, OMP eval kernel contract, research source catalog | Reference |
| Install guide | Markdown | `agent-install_instructions.md` | Per-harness install commands, sentinel probe for b-plan | Yes |
| `.omp/` project config | — | *(absent in repo)* | OMP project settings would live at `.omp/settings.json` per `docs/oh-my-pi.md:61-66` | N/A in package root |

### All `prompts/*.md` files (33)

| File | Wrapper target |
|---|---|
| `b-brainstorm.md` | `skills/b-brainstorm/SKILL.md` |
| `b-build.md` | `skills/b-build/SKILL.md` (standard) |
| `b-build-hard.md` | `skills/b-build/SKILL.md` (hard) |
| `b-capture.md` | `skills/b-capture/SKILL.md` |
| `b-commit.md` | `skills/git-commit/SKILL.md` |
| `b-commit-improved.md` | `skills/git-commit-improved/SKILL.md` |
| `b-docs.md` | `skills/b-docs/SKILL.md` |
| `b-explore.md` | `skills/b-explore/SKILL.md` |
| `b-fix-rebase-conflict.md` | `skills/b-fix-rebase-conflict/SKILL.md` |
| `b-grill-me.md` | `skills/b-grill-me/SKILL.md` |
| `b-grill-with-docs.md` | `skills/b-grill-with-docs/SKILL.md` |
| `b-guardrails-check.md` | `skills/b-guardrails-check/SKILL.md` |
| `b-howto.md` | `skills/b-howto/SKILL.md` (+ `HOWTO-FORMAT.md`) |
| `b-init-factory.md` | `skills/b-init-factory/SKILL.md` |
| `b-init-guardrails.md` | `skills/b-init-guardrails/SKILL.md` |
| `b-iterate.md` | `skills/b-iterate/SKILL.md` |
| `b-nasa-prd.md` | `skills/b-nasa-prd/SKILL.md` |
| `b-phase.md` | `skills/b-phase/SKILL.md` |
| `b-plan.md` | `skills/b-plan/SKILL.md` |
| `b-plan-update.md` | `skills/b-plan-update/SKILL.md` |
| `b-present.md` | `skills/b-present/SKILL.md` |
| `b-pr.md` | `skills/b-pr/SKILL.md` |
| `b-pr-review-2-issues.md` | `skills/b-pr-review-2-issues/SKILL.md` |
| `b-recap.md` | `skills/b-recap/SKILL.md` |
| `b-research.md` | `skills/b-research/SKILL.md` |
| `b-review.md` | `skills/b-review/SKILL.md` |
| `b-save.md` | Inline 12-step prompt (no skill pointer header); skill at `skills/b-save/SKILL.md` |
| `b-save-improved.md` | `skills/b-save-improved/SKILL.md` |
| `code-review.md` | `skills/code-review/SKILL.md` |
| `code-review-universal.md` | `skills/code-review-universal/SKILL.md` |
| `omp-goal.md` | OMP `/goal set` documentation stub (no-op off-OMP) |
| `omp-orchestrate.md` | OMP `orchestrate` keyword contract stub |
| `omp-workflow.md` | OMP `workflow` keyword / eval-kernel stub |

### `commands/` delta vs `prompts/` (4 OMP-only files)

| File | Notes |
|---|---|
| `b-pr-improved.md` | Extension-backed; falls back to `skills/b-pr/SKILL.md` (`commands/b-pr-improved.md:9-14`) |
| `b-kamal-release.md` | Extension-only; no skill fallback (`commands/b-kamal-release.md:20`) |
| `product-tour.md` | Skill wrapper → `skills/product-tour/SKILL.md` |
| `git-clean-orphans.md` | Skill wrapper → `skills/git-clean-orphans/SKILL.md` |

Per `README.md:241` and `docs/extension-loading.md:79-103`, the other 33 `commands/*.md` entries are symlinks to `../prompts/<same-name>.md`.

### All `extensions/` files (accounted)

| Path | Wired? | Role |
|---|---|---|
| `index.ts` | **Yes** (`package.json:44,55`) | Extension entry; wires submodules |
| `tps-tracker.ts` | Yes (via index) | TPS status + notifications |
| `plan-artifact.ts` | Yes (via index) | Plan-mode durable artifact (opt-in) |
| `b-save-improved/index.ts` | Yes | `/b-save-improved` command |
| `b-pr-improved/index.ts` | Yes | `/b-pr-improved` command |
| `b-commit-improved/index.ts` | Yes | `/b-commit-improved` command |
| `b-kamal-release/index.ts` | Yes | `/b-kamal-release` command |
| `command-progress.ts` | Yes (imported) | `setStatus` / `notify` progress helper |
| `omp-models.ts` | Yes (imported) | OMP role→model mapping for nested sessions |
| `b-flow/index.ts` + subtree | No | XState orchestration (`session_before_compact` hook) |
| `b-grill-auto/index.ts` + subtree | No | RPC auto-grill command |
| `grill-me-dialog.ts` | No | `grill-me_dialog` custom tool + TUI selector |
| `tmux-window-status.ts` | No | tmux window rename status icons |
| `*.test.ts`, `b-flow/__tests__/`, `*/__tests__/` | — | Tests |

## Detail

### Prompts layer (`prompts/`, 33 files)

- **Procedure**: (1) YAML frontmatter `description` for slash-menu discovery (`prompts/b-plan.md:1-3`); (2) title + `$ARGUMENTS` passthrough (`prompts/b-plan.md:5-7`); (3) default pattern: “Load and follow the `<skill>` skill” with relative `skills/<name>/SKILL.md` path (`prompts/b-plan.md:9-13`); (4) variants: `b-build-hard` sets difficulty on same skill (`prompts/b-build-hard.md:9-12`); `b-save` inlines 12 responsibilities instead of skill pointer (`prompts/b-save.md:1-60`); `omp-*` open with harness no-op blockquote (`prompts/omp-orchestrate.md:5-8`); extension commands in `commands/` document extension path + skill fallback (`commands/b-pr-improved.md:9-14`).
- **Gates/stops**: OMP stubs declare themselves no-ops on Pi/Claude/OpenCode/Codex (`prompts/omp-orchestrate.md:5-8`); `b-save` warns on missing User Goal but does not block (`prompts/b-save.md:48`).
- **Supporting files**: None in `prompts/` itself; skills carry `references/`, scripts.
- **Explicitly does NOT do**: Implement workflow logic (delegates to skills); does not load for Codex (skill invocation `$name` instead per `README.md:161`).

### Extensions layer (`extensions/`)

- **Procedure (wired `index.ts`)**: (1) `wireTpsTracker(pi)` (`extensions/index.ts:318`); (2) register improved commands (`extensions/index.ts:320-328`); (3) `session_start` captures cwd (`extensions/index.ts:332-334`); (4) on `/b-build|b-build-hard|b-iterate|b-review`, defer model switch to `before_agent_start` (`extensions/index.ts:338-354`); (5) restore model on `agent_end` unless user overrode (`extensions/index.ts:367-404`); (6) `plan-artifact` listens `turn_end` when opt-in enabled (`extensions/plan-artifact.ts:195-196`).
- **Gates/stops**: Model switch skipped without `buckModelMapping` / OMP `modelRoles` (`extensions/index.ts:409-414`); plan-artifact default OFF (`extensions/plan-artifact.ts:170-192`); kamal-release requires flags when headless (`extensions/b-kamal-release/index.ts:16-18` header comment).
- **Supporting files**: Skill scripts reused by improved commands (e.g. `skills/b-pr/scripts/pr-preflight.ts` per `extensions/b-pr-improved/index.ts:30-31`).
- **Explicitly does NOT do**: Wire `b-flow`, `b-grill-auto`, tmux status, or session state injection (`README.md:292`, `docs/extension-loading.md:147`).

### Docs layer (`docs/`)

- **Procedure**: (1) `docs/buck-workflow.md` — workflow taxonomy, OMP autonomous-loop recommendations, Mermaid flows; (2) `docs/extension-loading.md` — Pi vs OMP discovery, mirror pattern, debugging; (3) per-harness references (`pi.md`, `oh-my-pi.md`, `claude-code.md`, `codex.md`, `goose.md`); (4) `docs/context-artifacts.md` — hybrid Markdown/JSON `.context/` indexes; (5) archival `docs/b-flow.md`, `docs/eval-kernel.md`.
- **Gates/stops**: `context:validate` exits non-zero on hard enum errors (`docs/context-artifacts.md:47-51`).
- **Supporting files**: `docs/brainstorms/b-orchestration-extension.md`; legal `privacy-policy.md`, `terms-of-service.md`.
- **Explicitly does NOT do**: Replace skill bodies; `b-flow.md` is archival, not active setup (`docs/b-flow.md:1-9`).

### Packaging / distribution layer

- **Procedure**: (1) Publish npm package `buck-workflow@0.2.0` with `pi`/`omp` manifest keys (`package.json:1-63`); (2) end users `pi install git:github.com/evilbuck/buck-workflow-pi` or `omp install …` (`README.md:75-83`); (3) clone durable checkout + `node scripts/install.mjs` for bootstrap and non-package harness surfaces (`README.md:104-113`, `scripts/install.mjs:40-101`); (4) Codex: `codex plugin marketplace add` + install **Buck Workflow** plugin (`docs/codex.md:8-21`); (5) verify with `node scripts/install.mjs --verify` (`README.md:125-126`).
- **Gates/stops**: Installer refuses split roots / copied bootstrap; `--verify` exits 1 on problems (`README.md:128-131`); never install from temp/cache (`README.md:134-135`).
- **Supporting files**: `agent-install_instructions.md`, `GLOBAL_OR_PROJECT-AGENTS.md`, `plugins/buck-workflow/.codex-plugin/plugin.json`.
- **Explicitly does NOT do**: Global Cursor install (`README.md:163`, `scripts/install.mjs:86-90`); Goose installer surface — manual Summon only (`README.md:206`, `docs/goose.md:119`).

## Cross-cutting answers

### Q1. Three-layer model (repo's words)

From `README.md:182-184`:

> 1. **Canonical skills** (`skills/`) — Portable workflow logic. Agent-neutral Markdown files that define *how* each workflow behaves. These are the source of truth.
> 2. **Thin wrappers** (`prompts/` + `commands/`) — Agent-native invocation surface. Pi reads `prompts/*.md` as slash commands. OMP reads `commands/*.md`; those files are symlinks back to `prompts/` so there is one source of truth.
> 3. **Runtime automation** (`extensions/index.ts`) — Minimal Pi/OMP extension surface for model auto-switch and TPS tracking. Historical orchestration subsystems remain in `extensions/` but are not wired by the package manifest.

(`docs/buck-workflow.md:33-37` restates the prompt/skill/extension split as “Use a prompt template… Mirror… Use a skill… Use an extension only for runtime hooks.”)

### Q2. Canonical end-to-end workflow chain

Documented full new-feature chain in `README.md:301`:

```
/b-brainstorm → /b-explore → /b-research → /b-plan → /b-build → /b-review → /b-docs → /b-save → /b-commit
```

`docs/buck-workflow.md:138` gives the phased default variant:

```
/b-explore or /b-research → /b-plan → /skill:b-phase → /b-build → /b-review → /b-docs → /b-save → /b-commit
```

Both docs note `/b-docs` is conditional on review flagging documentation impact (`README.md:305`).

### Q3. Skills distribution / install / harnesses

| Harness | Mechanism | Evidence |
|---|---|---|
| **Pi** | `pi install git:github.com/evilbuck/buck-workflow-pi` loads package `skills/`, `prompts/`, `extensions/` | `README.md:75-77`, `package.json:42-51` |
| **OMP** | `omp install git:…` loads `extensions/`, auto-discovers `commands/`, `skills/` | `README.md:81-83`, `package.json:53-62`, `docs/extension-loading.md:150-165` |
| **Claude Code** | Durable clone + `scripts/install.mjs` symlinks bootstrap, `prompts→.claude/commands`, `skills→.claude/skills` | `README.md:104-107`, `scripts/install.mjs:58-65` |
| **OpenCode** | Same installer → `~/.config/opencode/{AGENTS.md,commands,skills}` | `scripts/install.mjs:76-83`, `agent-install_instructions.md:80` |
| **Codex** | Marketplace plugin from repo clone; bootstrap via installer; skills via plugin cache | `README.md:88-96`, `docs/codex.md:8-21`, `plugins/buck-workflow/.codex-plugin/plugin.json:13` |
| **Grok Build** | `install.mjs --harness grok` → `~/.grok/{rules,commands,skills}` | `README.md:164`, `scripts/install.mjs:93-100` |
| **Goose** | Manual — Summon extension loads skills by name; no installer | `README.md:206`, `docs/goose.md:119` |
| **npm** | Package publishes installer as `buck-workflow` bin (`scripts/install.mjs`) | `package.json:5-7` |

Pi/OMP installer symlinks **bootstrap only** to avoid double-loading package skills (`docs/extension-loading.md:258-259`).

### Q4. Session lifecycle hooks in extensions

**Wired package (`extensions/index.ts` + imported modules):**

| Hook | File | Purpose |
|---|---|---|
| `session_start` | `extensions/index.ts:332` | Capture `cwd` for model mapping |
| `input` | `extensions/index.ts:338` | Detect model-switch slash commands |
| `before_agent_start` | `extensions/index.ts:349` | Run deferred model switch |
| `model_select` | `extensions/index.ts:358` | Detect user override of auto-switch |
| `agent_end` | `extensions/index.ts:367` | Switch model back after phase |
| `agent_start` | `extensions/tps-tracker.ts:20` | Reset TPS counters; set status |
| `message_start` / `message_update` / `message_end` | `extensions/tps-tracker.ts:30-86` | Stream TPS calculation |
| `agent_end` | `extensions/tps-tracker.ts:88` | Final TPS notify + status |
| `turn_end` | `extensions/plan-artifact.ts:196` | Infer plan-mode exit; write `.context/…/plan-*.md` |

**Unwired (present in repo, not loaded by manifest):**

| Hook | File |
|---|---|
| `session_before_compact` | `extensions/b-flow/index.ts:292` — injects b-flow state into compaction summary |
| `session_start` | `extensions/b-grill-auto/index.ts:56`, `extensions/grill-me-dialog.ts:424` |
| `agent_end` | `extensions/b-grill-auto/index.ts:77` |
| `session_shutdown` | `extensions/b-grill-auto/index.ts:89`, `extensions/tmux-window-status.ts:394` |
| `before_agent_start`, `agent_start`, `message_update`, `message_end`, `agent_end` | `extensions/tmux-window-status.ts:330-392` |

**Compaction**: only `session_before_compact` in unwired `b-flow` (`extensions/b-flow/index.ts:292`). No compaction hooks in the wired extension surface.

**Session stop**: no `session_stop` handler; closest is `session_shutdown` in unwired modules above.

### Q5. Statusline / terminal UI integration

**Yes, in wired code:**
- **TPS status segment**: `ctx.ui.setStatus("tps", …)` during generation and on completion (`extensions/tps-tracker.ts:26-27`, `extensions/tps-tracker.ts:62-65`, `extensions/tps-tracker.ts:107`).
- **Command progress**: `createProgress` calls `ui.setStatus`, `ui.setWorkingMessage`, `ui.notify` (`extensions/command-progress.ts:88-108`) — used by `b-save-improved`, `b-pr-improved`, `b-commit-improved`, `b-kamal-release`.
- **Toast notifications**: model switch uses `ctx.ui.notify` (`extensions/index.ts:392-395`, `extensions/index.ts:468-470`).

**Unwired / archival TUI:**
- **tmux window title icons** (⚙️🧠✅🚧🛑): `extensions/tmux-window-status.ts:4-14`, `wire()` at `:323-404`.
- **Inline SelectList** for grill-me document mode: `extensions/grill-me-dialog.ts:6-7`, `:423-505`.
- **Interactive selects/confirms** in kamal-release: documented at `extensions/b-kamal-release/index.ts:8-17`.

Repo does not implement OMP's native `StatusLineSegmentId` configuration; it uses Pi extension `ctx.ui.setStatus` API instead (`docs/oh-my-pi.md:82-83` describes OMP's built-in status line options separately).

### Q6. Deprecating extension-based orchestration

`docs/buck-workflow.md:43-49`:

> `extensions/b-flow/` remains in the repository as historical code and tests, but it is **not wired by `package.json`** … extension-based orchestration that is not observably invoked becomes dead weight.

`docs/buck-workflow.md:119-123`:

> **Does not write a new b-flow-style extension.** The b-flow deprecation (2026-06-01 …) is the lesson: extension-based orchestration that is not observably invoked is dead weight. All omp-integration surfaces are **prompt-level or skill-level changes** the user runs from the TUI.

`README.md:292` lists removed/unwired subsystems: “`/b-mode`, plan-mode write guards, `/b-save` as an extension command, `b-flow`, `b-grill-auto` extension command wiring, tmux status, and session state injection.”

Replacement guidance (`docs/buck-workflow.md:51-56`): use `b-plan` + `b-phase`, OMP primitives (`/goal set`, `orchestrate`, `workflow`) only when `omp_execution` recommends, and `/b-save` as pure prompt/skill.

## Gaps

- **Doc drift**: `README.md:184-190` and `docs/extension-loading.md:142-147` describe the wired extension as “model auto-switch + TPS only,” but `extensions/index.ts:319-328` also wires `b-pr-improved`, `b-commit-improved`, `b-kamal-release`, `plan-artifact`, and `b-save-improved`.
- **Incomplete prompts↔commands mirror**: four `commands/` files lack `prompts/` twins (`b-pr-improved`, `b-kamal-release`, `product-tour`, `git-clean-orphans`), so Pi users do not get those slash commands from the package `prompts/` directory unless added.
- **No `.omp/` in repo root**: plan-artifact and OMP settings are documented for project `.omp/settings.json` but not shipped as template (`docs/oh-my-pi.md:61-66`).
- **No Goose/Cursor automated install path** beyond manual/project-scoped setup (`README.md:163`, `docs/goose.md:119`).
- **No wired compaction hook** in the active extension; only archival `b-flow` had `session_before_compact`.

## Open questions

- Q-H1: Should `README.md` / `docs/extension-loading.md` be updated to list all submodules wired from `extensions/index.ts`, or should some improved commands be split behind separate opt-in manifest entries?
- Q-H2: Should `product-tour` and `git-clean-orphans` gain `prompts/` twins for Pi parity, or remain OMP-only discoveries intentional?
- Q-H3: Is `tmux-window-status.ts` slated for re-wiring behind a flag, or permanent archival alongside `b-flow`?
