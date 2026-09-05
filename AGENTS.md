# Buck-Workflow for agents

A loose collection of skills, prompts, and extensions for agentic development workflows.

## Targets
The targets for this are pi-coding-agent, oh-my-pi (omp), claude, codex, goose.
 
 ## Cross-Platform Agent Reference
 
 Detailed docs for each agent's context files, skills, and customization:
 
 | Agent | Context File(s) | Skills Location | Skills Standard | Extensions | Doc |
 |---|---|---|---|---|---|
 | **Pi** | `AGENTS.md`, `SYSTEM.md`, `APPEND_SYSTEM.md` | `~/.pi/agent/skills/`, `.pi/skills/`, `~/.agents/skills/` | [Agent Skills](https://agentskills.io) | TypeScript (`~/.pi/agent/extensions/`) | [docs/pi.md](docs/pi.md) |
 | **Oh My Pi (omp)** | `AGENTS.md`, `CLAUDE.md`, `SYSTEM.md` | `~/.omp/agent/skills/`, `.omp/skills/` + Pi paths | [Agent Skills](https://agentskills.io) | TypeScript (`~/.omp/agent/extensions/`) | [docs/oh-my-pi.md](docs/oh-my-pi.md) |
 | **Claude Code** | `CLAUDE.md` (root + subdirs) | `~/.claude/skills/`, `.claude/skills/` | [Agent Skills](https://agentskills.io) | Plugins, hooks, subagents | [docs/claude-code.md](docs/claude-code.md) |
 | **Codex** | `AGENTS.md`, `AGENTS.override.md` (walk root→cwd) | `$HOME/.agents/skills/`, `.agents/skills/` | [Agent Skills](https://agentskills.io) | Plugins (`.codex/plugins/`) | [docs/codex.md](docs/codex.md) |
 | **Goose** | `.goosehints`, `AGENTS.md` | Via Summon extension | Skills via Summon | MCP servers (all extensions are MCP) | [docs/goose.md](docs/goose.md) |

### Bootstrap vs Project `AGENTS.md`

- `GLOBAL_OR_PROJECT-AGENTS.md` is the **installable bootstrap source** for agent-global `AGENTS.md` files (for example `~/.omp/agent/AGENTS.md`, `~/.pi/agent/AGENTS.md`, or other harness bootstrap targets).
- This repository's root `AGENTS.md` is the **project-specific directive** for work inside `buck-workflow-pi`.
- They are intentionally different:
  - `GLOBAL_OR_PROJECT-AGENTS.md` stays generic and installable across projects.
  - `AGENTS.md` carries repository-specific workflow, architecture, and packaging guidance.
- When updating bootstrap policy, update `GLOBAL_OR_PROJECT-AGENTS.md` and any docs describing install/sync behavior.
- When updating repository-local guidance, update this `AGENTS.md`.

### Shared Skill Directories
 
 The `~/.agents/skills/` and `.agents/skills/` paths are the cross-tool standard. Pi, OMP, and Codex all scan these. Claude Code uses `.claude/skills/` but Pi/OMP can be configured to load from it too:
 
 ```json
 // ~/.pi/agent/settings.json or ~/.omp/agent/settings.json
 { "skills": ["~/.claude/skills"] }
 ```
 
 ### Context File Conventions
 
 | Convention | Used by | File |
 |---|---|---|
 | `AGENTS.md` at project root | Pi, OMP, Codex, Goose | Standard cross-tool context |
 | `CLAUDE.md` at project root + subdirs | Claude Code, OMP (reads on first launch) | Claude-specific context |
 | `.goosehints` per directory | Goose | Goose-specific hints |
 | `SYSTEM.md` / `APPEND_SYSTEM.md` | Pi, OMP | System prompt customization |
 
 ### Agent Documentation Links
 
 **Skills:**
 - [pi](https://pi.dev/docs/latest/skills) · [claude](https://code.claude.com/docs/en/skills) · [codex](https://developers.openai.com/codex/skills) · [goose](https://goose-docs.ai/docs/getting-started/using-extensions/)
 
 **Prompts / Commands:**
 - [pi — Prompt Templates](https://pi.dev/docs/latest/prompt-templates) · [claude — Commands](https://code.claude.com/docs/en/commands) · [codex — Slash Commands](https://developers.openai.com/codex/guides/slash-commands/)
 
 **Extensions / Plugins:**
 - [pi — Extensions](https://pi.dev/docs/latest/extensions) · [claude — Plugins](https://code.claude.com/docs/en/plugins) · [codex — Plugins](https://developers.openai.com/codex/plugins)


## Architecture

Buck workflow uses a **three-layer model** for portability across agents (Pi, Claude Code, OpenCode, Codex):

1. **Skills** (`skills/`) — Canonical, portable workflow logic. These are the reusable instruction sets that define *how* each workflow behaves. They are agent-neutral and the source of truth.
2. **Commands / Prompts** (`prompts/`) — Agent-native thin wrappers that invoke skills. Pi uses prompt templates (`/b-*`). Claude Code, OpenCode, and Codex use their own command/skill mechanisms to load the same canonical skill.
3. **Extensions / Plugins** (`extensions/`) — Runtime automation that needs event hooks, session state, and persistence. Not portable as static instructions; stays agent-specific.

For the full rationale and migration details, see `.context/2026-05-12.prompt-to-skill-portability/plan-prompt-to-skill-portability.md`.

**Note on agent-specific syntax in skills:** Skills may reference Pi-specific syntax (e.g. `/skill:b-phase`, `/b-save`) when describing workflow handoffs. This is intentional — each agent's wrapper layer adapts these to native equivalents. The skill body remains the canonical logic; only the invocation surface varies per agent.

## Project Structure

```
skills/          # Canonical portable skills (b-brainstorm, b-research, b-plan, b-build, b-iterate, b-review, b-docs, b-howto, b-save, b-memory-import, b-present, b-phase, fix-pr, git-clean-orphans, git-commit, b-grill*, run-in-idle-pane, …)
extensions/      # Pi extensions for runtime automation (b-flow, b-grill-auto)
prompts/         # Pi prompt templates — thin wrappers that invoke skills (including b-commit wrapping git-commit skill)
docs/            # Documentation
presentations/   # Output from b-present
```

## Setup

### OMP skill loading

OMP scans `.omp/skills/` (native provider, priority 100). The canonical skills live in `skills/`. Link them once:

```bash
mkdir -p .omp && ln -s ../skills .omp/skills
```

This makes all project skills load automatically on next OMP start. Pi does not need this — it scans `skills/` directly.

## Available Skills

**Vault-Native LLM Wiki** (`skills/llm-wiki-vault/`): Enables any agent to ingest sources, build interlinked research notes, and maintain the Obsidian knowledge base at `~/Documents/second brain` using the same vault-native LLM Wiki protocol Hermes uses. Agents load it automatically from this project's `skills/` directory. See the skill's Quick Agent Lookup block for invocation keys (`LLM-WIKI`, `INGEST`, `QUERY`, `LINT`, `WIKI-SCHEMA`, etc.).

**Session memory** (`skills/b-save/`, `skills/b-memory-import/`):
- `/b-save` always writes git-portable `.context/memory` (+ backlog/index). On OMP, when `retain`/`learn` tools exist, it also mirrors durable session facts into harness LTM. Non-OMP agents optionally re-index via the configured Memory Search Tool.
- `b-memory-import` is a **one-shot/backfill** Bun script that pushes existing `.context/memory/**/*.md` into Hindsight via retain HTTP (stable `document_id`, local manifest). Not part of the every-session loop.

# Buck Workflow Steps

Buck workflow commands follow a discoverable `/b-` prefix. The completion sequence is: review → (fix issues / sync docs) → save → commit:

```
/b-build → /b-review → /b-iterate (if in-plan issues) → /b-docs (if doc impact) → /b-save → /b-commit
```

**Out-of-plan review findings** (issues beyond the plan's scope) do **not** iterate — they spawn a separate `/b-plan` → `/b-build` cycle, after the accepted work is closed via `/b-save` → `/b-commit`. `/b-iterate` is reserved for in-plan defects.

`/b-commit` is the final step after durable state has been recorded via `/b-save`. It uses the `git-commit` skill to create a Conventional Commits message and commit.
`/b-docs` is a conditional step: when `/b-review` flags documentation impact (new conventions, architecture decisions, or domain language), run it to update the project's living docs before `/b-save`. See `skills/b-docs/SKILL.md` for the canonical doc locations.
`/b-howto` is a conditional step: when `/b-review` flags how-to impact (a new or changed user-facing action with no how-to), run it to write `docs/howto/` before `/b-save`. See `skills/b-howto/SKILL.md`. Distinct from `/b-docs` (how vs why). If both are flagged, run `/b-docs` first — it will load and follow `b-howto`. Either skill may follow the other once in the same session; they do not write each other's files.

**PR review feedback** (external comments on a PR, not your own `/b-review` loop): load `fix-pr` via `/skill:fix-pr <pr-url-or-number>`. Skill-only — no `prompts/`/`commands/` wrapper. Validates each comment against code, then fixes+pushes in-session or files GitHub issues. See `skills/fix-pr/SKILL.md`.

# Intention

The skills, prompts, and extensions are designed to have a loose coupling. Each can build off the other, but it's not 100% required for most skills to be used in a dogmatic workflow that encopasses an entire development pass. For example, if `b-plan` is run, but there wasn't a `b-brainstorm` step, that's ok. `b-plan` will fill in the gaps as much as possible. It won't be as thorough, and that's ok for some tasks.

# OMP integration

buck-workflow plans and phase files are omp-aware — see [docs/buck-workflow.md § OMP Autonomous Loops](docs/buck-workflow.md#omp-autonomous-loops) for the full description. Three primitives (`/goal set`, the `orchestrate` keyword, the `workflow` keyword) are user-toggled; the workflow only *recommends* them via the `omp_execution` phase field, the `eval-<topic>.py` template for `workflow` plans, and the `b-review` 6-step completion-audit. Slash-command stubs at `prompts/omp-{orchestrate,workflow,goal}.md` document each contract. Background: `.context/2026-06-06.omp-integration-buck-workflow/`. The b-flow deprecation (`.context/2026-06-01.deprecate-b-flow/`) is the lesson: no new extension-based orchestration, prompt-level / skill-level only.

**Memory layers:**
1. **`.context/memory`** — required, git-portable session record (all harnesses).
2. **Harness LTM (OMP only)** — when `memory.backend` is `hindsight` or `mnemopi`, agents use `retain` / `recall` / `reflect` (and optional `learn`). `/b-save` mirrors checkpoint facts via those tools; do not call Hindsight HTTP from skills except `b-memory-import`'s deterministic importer.
3. **Memory skill (non-OMP)** — optional local search/index tool for non-OMP agents. Configure the skill path in the project's `AGENTS.md` under "Memory Search Tool".

Prior-work search is **conditional** (defined in installable bootstrap `GLOBAL_OR_PROJECT-AGENTS.md`):
- **If OMP**: use native memory tools (`recall`/`reflect`)
- **Else**: use configured memory skill (see "Memory Search Tool" section below)
- **Fallback**: read `.context/memory/index.md`

## Memory Search Tool

For non-OMP agents, use: `~/.agents/skills/qmd/SKILL.md`


<!-- BEGIN b-init-guardrails -->
# Quality Guardrails (managed block)

This block is managed by `b-init-guardrails`. Do not edit manually; re-run the skill to refresh.

## When to Run Guardrails Checks

The **mainline agent** owns dispatch. Run a guardrails check **at coherent points** — after a completed edit batch, never per-file. Examples:
- After finishing a feature or bug fix
- Before committing
- When the mainline agent is about to yield

If the session touched code, the check is **blocking** for completion. A session is docs-only when every changed path is `.md`, `.mdx`, `.txt`, `LICENSE`, or under `.context/`, `docs/`, or `presentations/` — those skip the gate with one line of explanation. Any other change (source, `package.json`, lockfiles, CI YAML) makes the session code-touching and the gate mandatory.

Do **not** run mid-edit; the working tree may be in an inconsistent state and yield false failures. `b-guardrails-check` only measures — it never dispatches itself and never edits.

## How to Read a Verdict

`/b-guardrails-check` resolves its contract via `skills/b-guardrails-check/docs/contract-resolution.md` and returns a structured verdict:

```json
{
  "status": "pass",
  "contract": "durable",
  "contract_version": 2,
  "tests": {
    "unit_gate": "pass",
    "unit_exit_code": 0,
    "functional_gate": "skipped",
    "functional_exit_code": null
  },
  "lint": {
    "lint_gate": "pass",
    "mode": "diff-scoped",
    "files_linted": 3,
    "exit_code": 0
  },
  "coverage": {
    "current": 45.2,
    "baseline": 42.5,
    "target": 75,
    "patch": 92.0,
    "patch_threshold": 90,
    "patch_gate": "pass"
  },
  "complexity": {
    "hotspots_remaining": 10,
    "baseline_size": 12,
    "new_violations": [],
    "hard_ceiling_violations": [],
    "complexity_gate": "pass"
  },
  "gates": {
    "unit_test_gate": "pass",
    "functional_test_gate": "skipped",
    "lint_gate": "pass",
    "patch_gate": "pass",
    "global_ratchet": "pass",
    "complexity_gate": "pass"
  },
  "ratchet_update": {
    "baseline_coverage_rewrites": true,
    "new_baseline_coverage": 45.2,
    "complexity_inventory_rewrites": true,
    "new_complexity_baseline_size": 10,
    "complexity_baseline_file": null
  }
}
```

- `status: pass` — all gates passed. Continue.
- `status: fail` — one or more gates failed. The verdict shows which gate failed and by how much.
- `contract` — one of `durable`, `ephemeral`, `suggested`, `none`. A `none` or `suggested` result means the repo needs `/b-init-guardrails` to record a real contract.
- `ratchet_update` — a proposed update only. The check skill is read-only; the mainline agent or `/b-init-guardrails` refresh applies approved baseline raises and complexity-inventory shrinkage at a coherent point.

## What to Do on Failure

**Unit / functional test failure** (gate `fail`):
- Fix the test or the code under test before committing.
- Never delete the test, never record `null` to silence the gate, never widen ignores.

**Lint gate failure** (gate `fail`, mode `diff-scoped` or `whole-repo-enforced`):
- Fix the reported lint errors in the files you changed.
- Never widen the lint ignore config to silence the gate. If a lint_cmd is genuinely wrong, re-run `/b-init-guardrails` to refresh.

**Patch gate failure** (changed lines < 90% covered):
- Add tests for the changed lines before committing.
- Do not lower the threshold; the patch gate is non-negotiable.

**Global ratchet failure** (coverage regressed below baseline):
- Add tests to bring coverage back to or above the baseline.
- Do not re-baseline unless explicitly approved by the user (re-baseline is a manual opt-in, not automatic).

**Complexity violation** (new function > 10 cyclomatic):
- Refactor the function before committing.
- If the function is legitimately complex, document the exception and add it to the baseline via explicit re-baseline (manual opt-in).

**v1 contract detected** (`contract_version: 1`):
- Run `/b-init-guardrails` to upgrade to v2 and add lint and functional-test gates.

## Contract Resolution

`/b-guardrails-check` resolves the check contract in this order, first hit wins. **Resolution never writes a file.**

1. `guardrails.json` at repo root → authoritative. Run all gates. Verdict `contract: "durable"`.
2. Managed block present but `guardrails.json` missing → warn the contract is broken, continue to step 3.
3. `b-init-guardrails`' `scripts/detect-stack.ts` reports ≥ 1 ecosystem → ephemeral contract; run lint and test gates only. Verdict `contract: "ephemeral"`.
4. No ecosystem detected → surface any `README.md` testing/development command block as unverified suggestions. Do not execute them. Verdict `contract: "suggested"`.
5. Nothing found → warn and offer `/b-init-guardrails`. Verdict `contract: "none"`.

Full chain: `skills/b-guardrails-check/docs/contract-resolution.md`.

## Dispatch Modes

**Caller owns the mode.** Choose by harness; do not assume a bare slash command is non-blocking.

**OMP (async):** fire a background `task` that runs the measurement procedure, then keep working until the verdict auto-delivers:
```typescript
task({
  tasks: [{
    task: "Run b-guardrails-check in the current repo and return the structured verdict JSON",
    agent: "task"
  }]
})
```
Equivalent: load `skills/b-guardrails-check/SKILL.md` (or `skill://b-guardrails-check`) inside that background task. A foreground `/b-guardrails-check` is still a normal blocking skill run.

**Portable (blocking):** at a coherent checkpoint, run `/b-guardrails-check` (or load the skill) synchronously and wait for the verdict before proceeding.

## Coherent-Point Dispatch Rule

The mainline agent must dispatch checks **at coherent points** — after a completed edit batch, never per-file. This avoids false failures from tree contention (the check reading a half-written tree).

If a check fails, re-verify before escalating:
1. Ensure the working tree is in a consistent state (no mid-edit files).
2. Re-run the check.
3. If it fails again, treat it as a real failure and act on the verdict.

<!-- END b-init-guardrails -->
