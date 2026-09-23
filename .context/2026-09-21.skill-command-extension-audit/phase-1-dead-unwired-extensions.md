---
status: completed
phase: 1
order: 1
plan: plan-skill-surface-cleanup.md
phases_overview: plan-skill-surface-cleanup-phases.md
difficulty: medium
model_hint: capable general model preferred — deletes are mechanical, but grill doc-mode rewrite, complexity-inventory shrink, and Codex bundle parity must land in the same batch
buck_hint: /b-build
goal: "Delete the three unwired extension modules, stop grill skills from calling grill-me_dialog, shrink the complexity inventory, and close the grill-auto live-test backlog item."
files:
  - extensions/grill-me-dialog.ts
  - extensions/tmux-window-status.ts
  - extensions/tmux-window-status.test.ts
  - extensions/b-grill-auto/
  - guardrails.json
  - docs/extension-loading.md
  - docs/buck-workflow.md
  - README.md
  - skills/b-grill-me/SKILL.md
  - skills/b-grill-with-docs/SKILL.md
  - skills/b-grill/SKILL.md
  - skills/b-grill-auto/SKILL.md
  - plugins/buck-workflow/skills/b-grill/
  - plugins/buck-workflow/skills/b-grill-me/
  - plugins/buck-workflow/skills/b-grill-with-docs/
  - .context/backlog/todo.md
  - .context/backlog/items/test-b-grill-auto-extension.md
from_plan_steps: [1, 2, 3, 4, 5]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] `extensions/grill-me-dialog.ts`, `tmux-window-status.ts`, `tmux-window-status.test.ts`, and `extensions/b-grill-auto/` are gone."
  - "[x] `extensions/index.ts` still wires the same eight modules + model auto-switch. `buck-mode.test.ts` still passes. Do not touch `buck-mode.test.ts`."
  - "[x] No live `skills/` or `prompts/` instruction calls `grill-me_dialog`."
  - "[x] `guardrails.json` complexity inventory has no rows for deleted files; complexity_gate still passes."
  - "[x] Live docs (`docs/extension-loading.md` tree, `docs/buck-workflow.md` tombstone table, `README.md:350`) no longer describe the three modules as on-disk unwired code."
  - "[x] Canonical `b-grill`, `b-grill-me`, and `b-grill-with-docs` are byte-identical to `plugins/buck-workflow/skills/` copies. Do not add bundled `b-grill-auto`."
  - "[x] `test-b-grill-auto-extension` is completed/archived. Do not archive `skill-surface-cleanup.md`."
completed_at: 2026-09-21
completed_by: b-build
---

# Phase 1: Dead Unwired Extensions

## Context

Parent user goal: Agents and humans using this package stop executing dead unwired extension code, follow one `/b-save` procedure, and write code-review artifacts into `.context/` instead of a machine-specific Windows path.

This phase delivers the first outcome: dead unwired extension code is gone, grill doc-mode no longer calls a tool that never registered, and live docs stop listing those files as present-but-unwired. `/b-save` and `code-review` path work is Phase 2.

Do not restore `skills/b-loop/` or `extensions/b-flow/`. Slice 3 (project-specific skills, grill-family collapse, `thought-dump-writer`) stays a user call.

## Implementation Details

1. Confirm `extensions/index.ts` still has no imports of `grill-me-dialog`, `tmux-window-status`, or `b-grill-auto`. Delete:
   - `extensions/grill-me-dialog.ts`
   - `extensions/tmux-window-status.ts`
   - `extensions/tmux-window-status.test.ts`
   - `extensions/b-grill-auto/` (five files: `index.ts`, `rpc-client.ts`, `harness.ts`, `grill-state.ts`, `types.ts`)
   Do not touch `extensions/buck-mode.test.ts` (slimdown regression + model auto-switch). Do not edit `extensions/index.ts` unless a stale comment names the deleted files.

2. Remove `guardrails.json` `ratchet.baseline_complexity_inventory` entries for:
   - `extensions/b-grill-auto/grill-state.ts` / `buildSessionBody` (complexity 17)
   - `extensions/grill-me-dialog.ts` / `renderResult` (complexity 15)
   - `extensions/grill-me-dialog.ts` / `handleWait` (complexity 13)
   Shrink inventory size by those three rows. Do not weaken other floors (`baseline_coverage`, remaining hotspot rows, `cyclomatic_max`).

3. Rewrite Document Mode in `skills/b-grill-me/SKILL.md`, `skills/b-grill-with-docs/SKILL.md`, and `skills/b-grill/SKILL.md` to:
   - create `.context/<subject>/grill-qa-<slug>-<n>.md`
   - tell the user the path
   - wait for a **chat message** that they are done (not a TUI Done/Cancel selector)
   - parse answers from the file on the next turn
   Delete every `grill-me_dialog` call (`action: "create" | "wait" | "read"`). Fill the empty `### Non-interactive Mode` stub in `b-grill-me` with that same protocol, or remove the empty heading. Same empty stub in `b-grill-with-docs` if still present.

4. In `skills/b-grill-auto/SKILL.md`, drop “historical extension directory” / `extensions/b-grill-auto/` once the dir is gone. Point leftover live “grill-auto” mentions at `skills/b-grill-auto/`. Historical `.context/` subject folders stay as record.

5. Recopy the full canonical directories for the three Codex-bundled grill skills into `plugins/buck-workflow/skills/` (`b-grill`, `b-grill-me`, `b-grill-with-docs`). `scripts/codex-plugin.test.ts` requires byte identity. Do **not** create `plugins/buck-workflow/skills/b-grill-auto/`.

6. Update live docs:
   - `docs/extension-loading.md` tree `:131-133` — drop the three `(unwired)` lines
   - `docs/buck-workflow.md` tombstone table `:514-515` — `b-grill-auto` extension → removed, skill remains; drop `tmux-window-status.ts` / `grill-me-dialog.ts` “kept as unused code”
   - `README.md:350` Unwired list — drop `b-grill-auto` extension command and tmux status as on-disk unwired code
   Keep the Removed line for `/b-mode`, plan-mode write guards, `/b-save` as an extension command, `b-flow`. Session-state injection can stay described as removed.

7. Complete `.context/backlog/items/test-b-grill-auto-extension.md`: `status: completed`, `completed: 2026-09-21`, reason “extension deleted, skill remains”. Archive per backlog rules (`todo.md` uncheck → `archive/2026-09/` + `archive/completed.md`). Do **not** archive `skill-surface-cleanup.md`.

Grill skill rewrite **must** land in the same edit batch as the file delete. Unfixed skills would call a missing tool.

## Risks

- **Doc-mode hang:** skills currently wait on `grill-me_dialog`, which never registers. Mitigation: step 3 in the same batch as step 1.
- **Complexity ratchet:** deleting hotspot files without inventory shrink fails `complexity_gate`. Mitigation: step 2.
- **Coverage:** `tmux-window-status.test.ts` only covers the deleted module; removing both should not drop global coverage. Confirm in the guardrails verdict; do not re-baseline coverage.
- **Codex drift:** editing canonical grill skills without recopying the bundle fails `scripts/codex-plugin.test.ts`. Mitigation: step 5. `b-grill-auto` is not curated — do not add it.
- **Over-delete:** `extensions/index.ts` and `buck-mode.test.ts` stay. Do not collapse the four grill **skills**.

## Verification

- `rg grill-me-dialog|tmux-window-status|extensions/b-grill-auto` over `extensions/`, `skills/`, `prompts/`, `README.md`, `docs/`, `AGENTS.md`, `guardrails.json` — zero live hits except historical `.context/` and intentional tombstones (`docs/b-flow.md` style).
- `rg grill-me_dialog skills/ prompts/` — zero.
- `npx vitest run extensions/buck-mode.test.ts` — pass.
- `npx vitest run scripts/codex-plugin.test.ts` — pass.
- `diff -rq skills/b-grill plugins/buck-workflow/skills/b-grill` (and `b-grill-me`, `b-grill-with-docs`) — empty.
- `npm run guardrails:check` after the full edit batch (not mid-file). `complexity_gate` pass; coverage must not fall below `baseline_coverage` 84.
- Confirm `test-b-grill-auto-extension.md` is under `archive/2026-09/` and gone from `todo.md`.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
