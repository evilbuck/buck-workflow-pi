---
date: 2026-05-13
status: active
subject: 2026-05-12.prompt-to-skill-portability
---

# Inventory: Prompts → Skills Classification

## Classification Criteria

Each prompt is classified into ONE category:

| Category | Definition | Action |
|----------|------------|--------|
| **Canonical Skill** | Reusable workflow instruction set (could run in any agent) | Convert to `skills/<name>/SKILL.md` |
| **Thin Wrapper** | Calls a canonical skill with agent-specific argument passing | Keep as `prompts/<name>.md` reduced to ~10 lines |
| **Runtime Automation** | Needs event hooks, session state, persistence, or custom tools | Keep as extension/plugin only |
| **One-off Helper** | Rarely used, agent-specific, not reusable | Document and leave as-is |
| **Undecided** | Needs discussion or user decision | Flag for review |

---

## Inventory

| Prompt | Lines | Current Location | Proposed Classification | Rationale | Owner |
|--------|-------|------------------|------------------------|-----------|-------|
| b-brainstorm | 131 | `prompts/b-brainstorm.md` | **Canonical Skill** | Self-contained interview flow with artifact guidance, resume behavior, sidecar state management, slug generation, and output format. No Pi-specific hooks. The only agent-adjacent part is `$ARGUMENTS` injection which every prompt uses. Portable to any agent that can read markdown instructions. | agent |
| b-build | 123 | `prompts/b-build.md` | **Canonical Skill** | Implements "smallest safe code change" workflow with context resolution (cross-refs, subject folders, phased plans), session awareness protocol, behavior rules, escalation paths, and closeout checklist. No Pi-specific tooling. Portable. | agent |
| b-build-hard | 125 | `prompts/b-build-hard.md` | **Canonical Skill** | Nearly identical structure to b-build but for complex/risky work. Same context resolution, session awareness, phase state updates, and closeout. The only difference from b-build is the behavior/escalation section. Portable. | agent |
| b-iterate | 85 | `prompts/b-iterate.md` | **Canonical Skill** | Quick fix workflow with context resolution, session awareness, and closeout. Smaller scope than b-build but same pattern. No Pi dependencies. Portable. | agent |
| b-plan | 174 | `prompts/b-plan.md` | **Canonical Skill** | Largest prompt (174 lines). Contains role definition, write boundary, subject folder creation, context resolution protocol, clarification interview, cross-reference stitching, plan behavior, frontmatter template, recommended structure, and output format. Entirely agent-agnostic. Portable. | agent |
| b-present | 138 | `prompts/b-present.md` | **Thin Wrapper** | The prompt explicitly defers to the `b-present` skill via "Skill Reference" section. It handles input resolution and delegates the actual generation workflow to the skill. The prompt is an adapter layer — it resolves the source artifact and invokes the skill. The skill (279 lines) has the real logic: output structure, package generation workflow, diagram rules, visual system, HTML templates. | agent |
| b-research | 75 | `prompts/b-research.md` | **Canonical Skill** | Read-only investigation workflow. Role definition, write boundary, subject folder creation, cross-reference stitching, behavior (use code lookup, web search, trace flows), research frontmatter template, output format. Agent-agnostic. Portable. | agent |
| b-review | 105 | `prompts/b-review.md` | **Canonical Skill** | Code review workflow with role definition, behavior (check correctness, edge cases, regressions, workflow compliance), structured output (pass/fail/iterate), and history/closeout. No Pi dependencies. Portable. | agent |
| git-commit | 100 | `prompts/git-commit.md` | **Canonical Skill** | Git commit workflow with inputs, safety rules, and a detailed procedure (2.7KB procedure section). Generates conventional commits, handles safety (no secrets, no large files), structured output. Agent-agnostic. Portable. | agent |

---

## Known Duplicates

### `prompts/b-present.md` vs `skills/b-present/SKILL.md`

**Status**: Active duplicate. The prompt (138 lines) references the skill (279 lines) explicitly.

- **Prompt**: Acts as a thin wrapper — resolves input, sets write boundary, calls the skill
- **Skill**: Contains the full generation workflow (7-step process), output structure, HTML templates, visual system, diagram rules, error handling

**Resolution**: The prompt should become a thin wrapper (~10-15 lines) that delegates entirely to the skill. The skill already contains all the logic. The prompt currently has some redundancy in:
  - Input resolution (both prompt and skill define this)
  - Write boundary (duplicated)
  - Output format (both define it)

**Recommended action**: Reduce `prompts/b-present.md` to a minimal adapter that passes `$ARGUMENTS` to the skill's input resolution. Remove duplicated sections from the prompt.

---

## Runtime Commands (Not in prompts/)

| Command | Current Implementation | Classification | Notes |
|---------|----------------------|----------------|-------|
| `/b-save` | Extension: `extensions/index.ts` → `pi.registerCommand("b-save", ...)` | **Runtime Automation** | Injects session state JSON + save prompt as user message to LLM. Requires Pi event hooks (`tool_call`, `input`, `agent_end`), session state persistence (`readState`/`writeState`), QMD reindex scheduling, and model switch logic. Cannot be a skill or prompt — needs the extension's event-driven lifecycle. |
| `/b-flow` | Extension: `extensions/b-flow/index.ts` → `api.registerCommand("b-flow", ...)` | **Runtime Automation** | XState state machine orchestrating the full Buck workflow lifecycle. Subcommands: `start`, `run`, `continue`, `status`, `pause`, `resume`, `jump`, `stop`, `mode`. Requires actor persistence, subscription management, compaction context injection. Inherently tied to extension runtime. |
| Plan Mode | Extension: `extensions/index.ts` → `tool_call` hook | **Runtime Automation** | Blocks mutating tools during plan mode, uses AI review for ambiguous bash commands, manages plan mode status bar. Event-driven, not portable to skill/prompt. |
| Model Auto-Switch | Extension: `extensions/index.ts` → `input`/`agent_end` hooks | **Runtime Automation** | Switches model based on phased plan difficulty (easy→sonnet, hard→opus). Requires session state tracking and model registry access. |
| Session State Tracking | Extension: `extensions/index.ts` → `tool_call` hook | **Runtime Automation** | Tracks commands run, files modified, implementation/save status. Injects into compaction context. Part of extension lifecycle. |
| Tmux Window Status | Extension: `extensions/tmux-window-status.ts` | **Runtime Automation** | Displays current workflow state in tmux window title. Requires Pi `registerTool` API and tmux integration. |

---

## Extension Assets (Not commands, but supporting infrastructure)

| Asset | Location | Purpose |
|-------|----------|---------|
| `grill-state.ts` | `extensions/b-grill-auto/` | State management for b-grill-auto RPC sessions |
| `harness.ts` | `extensions/b-grill-auto/` | RPC harness for model-to-model grilling |
| `rpc-client.ts` | `extensions/b-grill-auto/` | Client for communicating with grilling model |
| `types.ts` | `extensions/b-grill-auto/` | Type definitions for grill auto |
| `grill-me-dialog.ts` | `extensions/` | Document-mode dialog for b-grill-me skill |
| `b-flow/machine.ts` | `extensions/b-flow/` | XState state machine definition |
| `b-flow/chunk-queue-machine.ts` | `extensions/b-flow/` | Sub-machine for chunk processing |
| `b-flow/persistence.ts` | `extensions/b-flow/` | Snapshot/projection persistence |
| `b-flow/ui.ts` | `extensions/b-flow/` | UI confirmations for transitions |
| `b-flow/worker.ts` | `extensions/b-flow/` | Chunk execution worker |
| `b-flow/classifier.ts` | `extensions/b-flow/` | Plan step classification |
| `b-flow/guards.ts` | `extensions/b-flow/` | State machine guard conditions |
| `b-flow/queue-builder.ts` | `extensions/b-flow/` | Builds execution queue from plan phases |
| `b-flow/scan-context.ts` | `extensions/b-flow/` | Scans .context/ for artifacts |
| `b-flow/verify-result.ts` | `extensions/b-flow/` | Verifies chunk execution results |
| `b-flow/types.ts` | `extensions/b-flow/` | Type definitions |

---

## Resolved Decisions

### 1. Merge b-build + b-build-hard into one parametric skill ✅ RESOLVED
**Decision**: Yes, merge into a single skill with a difficulty parameter.
**Implication**: Create `skills/b-build/SKILL.md` with `difficulty: standard | hard` parameter. Keep `/b-build` and `/b-build-hard` as separate prompt templates that pass the difficulty parameter. This reduces skill maintenance (one skill to update) while preserving the user-facing command surface.

### 2. git-commit as standalone or buck-workflow companion ✅ RESOLVED
**Decision**: Should act as standalone OR work with buck-workflow.
**Implication**: Convert `prompts/git-commit.md` → `skills/git-commit/SKILL.md` as a standalone canonical skill. It works independently but also integrates when called within a buck workflow session. Remove from `prompts/` and create as a self-contained skill.

### 3. Keep b-present prompt as explicit wrapper ✅ RESOLVED
**Decision**: No, don't eliminate the prompt. It's quicker and more explicit.
**Implication**: `prompts/b-present.md` stays as a thin prompt wrapper that delegates to `skills/b-present/SKILL.md`. Reduce the prompt to only input resolution + skill invocation (remove duplicated sections), but keep the prompt file.

### 4. $ARGUMENTS handling: prompts needed as wrappers ✅ RESOLVED
**Decision**: Research concluded — prompts ARE needed as wrappers for argument handling.
**Findings**:
- **Prompt templates** support `$1`, `$2`, `$@`, `$ARGUMENTS`, `${@:N}`, `${@:N:L}` — full positional argument parsing
- **Skills** receive arguments as raw text appended after skill content (`User: <args>`)
- Skills cannot do positional substitution
**Implication**: Architecture must be **skill + prompt pair** for any workflow that takes user arguments. The skill holds the portable workflow logic. The prompt is the Pi-specific adapter that parses `$ARGUMENTS` and passes structured context to the skill.

### 5. Grill consolidation: b-grill-me + b-grill-auto merge, b-grill-with-docs stays separate ✅ RESOLVED
**Decision**: User wants docs-awareness to potentially be the default, but with-docs should stay its own thing for now. Consider making docs-awareness the default in the base grill skill later.
**Implication**: Merge `b-grill-me` and `b-grill-auto` into a single `skills/b-grill/SKILL.md` with a `mode: user | auto` parameter. Keep `b-grill-with-docs` as a separate skill that extends the base with domain awareness. Prompts (`/b-grill-me`, `/b-grill-auto`, `/b-grill-with-docs`) remain as thin wrappers.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total prompts | 9 |
| Classified as Canonical Skill | 7 |
| Classified as Thin Wrapper | 1 |
| Classified as Runtime Automation | 0 (prompts) |
| Classified as One-off Helper | 0 |
| Undecided | 0 |
| **Total runtime commands** | 6 |
| Runtime Automation | 6 |
| **Known duplicates** | 1 (b-present prompt ↔ skill) |
| **Resolved decisions** | 5 |
| Total prompt lines | 1,085 |
| Total skill lines | 1,321 |
