# Plan: Extension Slimdown — Keep Model Auto-Switch + TPS Tracker

## Goal

Strip `extensions/index.ts` down to only model auto-switch and TPS tracker. Everything else (b-mode, b-restrict, plan mode, b-save command, b-flow, b-grill-auto, grill-me dialog, session state machine, tmux status) leaves the extension. `/b-save` becomes a pure skill + prompt with no extension backing.

## Context / assumptions

### What stays (in extension)

| Subsystem | Lines (approx) | What it does |
|---|---|---|
| Model auto-switch | ~350 lines (1121–1471) + helpers (172–430) | Reads `buckModelMapping`, inspects phase difficulty, auto-switches model on `/b-build`/`/b-iterate`/`/b-review`, switches back on `agent_end`, TUI picker for setup |
| TPS tracker | `wireTpsTracker(pi)` — single call, logic in `tps-tracker.ts` | Token-per-second tracking |
| Model switch `model_select` / `agent_end` hooks | Lines 1412–1471 | Detect user override, switch back |

These require `pi.registerCommand`, `pi.on`, `pi.setModel`, `ctx.modelRegistry`, `ctx.model` — real extension API surface that can't be replicated as a skill/prompt.

### What leaves (was in extension, now gone or becomes skill/prompt)

| Subsystem | Fate | Rationale |
|---|---|---|
| `b-mode` command + plan mode | **Delete entirely** | User doesn't want it. Plan mode write guard, `alt+p` shortcut, mode status bar — all gone. |
| `b-restrict` command | **Delete entirely** | User doesn't want it. |
| `b-save` command | **Becomes skill + prompt** (already a prompt at `prompts/b-save.md`). The extension handler that reads the file and substitutes `{{SESSION_STATE}}` goes away. `/b-save` becomes a plain slash command — OMP already has it via the symlink; Pi has it via `prompts/`. The LLM reads `.context/workflow/current-session.json` itself (step 1 of the prompt). No extension backing needed. |
| `b-flow` orchestration | **Delete** | `wireBFlow(pi)` removed from extension. The `extensions/b-flow/` directory stays on disk but is no longer wired. If the user wants it back later, it's a one-line re-add. |
| `b-grill-auto` | **Delete** | `wireGrillAuto(pi)` removed. `extensions/b-grill-auto/` stays on disk. |
| `grill-me dialog` | **Delete** | `wireGrillDialog(pi)` removed. `extensions/grill-me-dialog.ts` stays on disk. |
| Session state machine | **Delete** | The entire `SessionState` interface, `readState`/`writeState`/`ensureState`, `.context/workflow/current-session.json` management — gone. The only consumer was b-save (which becomes a prompt that tells the LLM to read the state file directly), plan mode (deleted), and model auto-switch. Model auto-switch will need its own lightweight state. |
| Plan mode tool guard | **Delete** | The `tool_call` hook that blocks writes outside `.context/`/`docs/` — gone with plan mode. |
| File tracking | **Delete** | `files_modified[]`, `implementation_happened`, `trackFile` — only used by the save warning. Gone. |
| CWD restriction | **Delete** | `restrict_cwd_active`, the `tool_call` check for out-of-project writes — gone. |
| QMD reindex | **Delete** | Only fired from b-save and memory file writes — both gone. |
| Compaction context injection | **Delete** | `session_before_compact` hook that injected session state — gone (no session state to inject). |
| tmux status | Already disabled | Stays commented out, remove the import. |

### What happens to `SessionState` / `.context/workflow/current-session.json`

The model auto-switch needs to know which commands ran, but it doesn't need the full `SessionState` shape. It needs:
- `buckModelMapping` — read from `~/.pi/agent/settings.json` (already does this)
- Active phase difficulty — read from `.context/` plan files on disk (already does this)
- Whether a switch happened and what the original model was — in-memory only (`ModelSwitchState`), already session-scoped

The model auto-switch **already** reads everything it needs from disk or keeps in memory. It never reads `current-session.json`. So the session state file goes away entirely.

The `before_agent_start` hook currently injects mode instructions. With modes gone, the only thing left is the pending model switch. That hook stays but becomes much simpler.

The `input` hook currently tracks `/b-*` commands and sets mode flags. With modes gone, the only thing left is detecting model-switch commands (`b-build`, `b-iterate`, `b-review`) and queuing `pendingModelSwitchCommand`. That hook stays but becomes much simpler.

The `agent_end` hook currently warns about unsaved implementation and switches model back. The save warning goes away. The model switch-back stays.

### `/b-save` without extension backing

Currently the extension handler:
1. Reads `prompts/b-save.md` from disk
2. Reads `.context/workflow/current-session.json`
3. Substitutes `{{SESSION_STATE}}` with the JSON
4. Sends to LLM via `pi.sendUserMessage`
5. Sets `save_completed = true` in state
6. Triggers QMD reindex

Without the extension, `/b-save` is just the prompt template at `prompts/b-save.md` (already exists). When invoked:
- **Pi**: reads the prompt file, sends the template text as a user message. The `{{SESSION_STATE}}` placeholder stays literal — the LLM sees it as an instruction to read the file itself. Step 1 of the prompt already says "Read `.context/workflow/current-session.json` for context."
- **OMP**: same via the `commands/b-save.md` symlink.

The prompt needs a small edit: replace the `{{SESSION_STATE}}` block with an instruction to read the file, since no extension will inject it. Steps 5 and 6 (state flag + QMD reindex) simply won't happen — the LLM does the work, no extension coordination needed.

## Scope

1. **Slim `extensions/index.ts`** — remove all subsystems except model auto-switch and TPS tracker. Rewrite the factory function to contain only what's needed.
2. **Update `prompts/b-save.md`** — replace `{{SESSION_STATE}}` placeholder with an instruction to read the state file directly (it already says this in step 1, just remove the placeholder block).
3. **Create `skills/b-save/SKILL.md`** — skill instructions for the b-save agent workflow.
4. **Clean up imports** — remove unused imports (`DynamicBorder`, `Container`, `SelectList`, `Text` from pi-tui stay for the model picker; remove `writeFileSync`, `readdirSync`, etc. that were only for session state).
5. **Remove dead test code** — remove session-state-dependent tests from `buck-mode.test.ts` (b-mode, b-restrict, plan mode, b-save command tests). Keep any model-switch tests if they exist.
6. **Update `package.json`** — ensure `pi.extensions` and `omp.extensions` point to `./extensions/index.ts`.
7. **Update `docs/extension-loading.md`** — reflect that the extension is now minimal (model auto-switch + TPS only).

## Out of scope

- Deleting `extensions/b-flow/`, `extensions/b-grill-auto/`, `extensions/grill-me-dialog.ts` from disk — they stay as dead code the user can re-add later if wanted.
- Removing `skills/cross-platform-pi-omp-loading/` — that skill documents the pattern, still accurate.
- Changing the model auto-switch behavior itself.
- npm publishing, Windows compatibility.

## Affected files

| File | Change |
|---|---|
| `extensions/index.ts` | Major rewrite — strip to model auto-switch + TPS tracker (~400 lines from 1472) |
| `extensions/buck-mode.test.ts` | Remove tests for deleted subsystems; keep model-switch tests |
| `prompts/b-save.md` | Replace `{{SESSION_STATE}}` with file-read instruction |
| `skills/b-save/SKILL.md` | New file — b-save skill instructions |
| `commands/b-save.md` | Symlink already exists — no change |
| `package.json` | Verify `pi` and `omp` fields are correct |
| `docs/extension-loading.md` | Update to reflect slim extension |

## Implementation steps

1. **Rewrite `extensions/index.ts`**
   - Keep imports: `ExtensionAPI`, `completeSimple`, `Container`/`SelectList`/`Text`/`DynamicBorder`, `dirname`/`join`, `fileURLToPath`, `readFileSync`/`writeFileSync`/`existsSync`/`mkdirSync`, `spawn`, `homedir`
   - Remove imports: `writeFileSync` (only if unused after state removal — model picker still uses it), `readdirSync`, b-flow, b-grill-auto, grill-me-dialog, tmux-window-status
   - Keep: `ModelMapping`, `ModelSwitchState`, all model-switch helpers (`readModelMapping`, `parseModelId`, `getCurrentModelTier`, `findActivePhaseDifficulty`, `findActivePhaseDiscrete`, `findActivePhaseLegacy`, `findMostRecentPlan`)
   - Keep: `wireTpsTracker(pi)`
   - Keep: model-switch registrations (`before_agent_start` for pending switch, `input` for detecting switch commands, `model_select` for override detection, `agent_end` for switch-back)
   - Keep: `offerModelMappingSetup`, `suggestModelForNonPhasedPlan`, `handleModelSwitch`
   - Delete: everything related to SessionState, plan mode, b-mode, b-restrict, b-save command, b-flow, b-grill-auto, grill-me-dialog, CWD restriction, file tracking, QMD reindex, compaction context injection, tmux status
   - Simplify `session_start` — no state restoration needed, just capture `cwd`
   - Simplify `input` — only detect model-switch commands
   - Simplify `before_agent_start` — only fire pending model switch
   - Simplify `agent_end` — only switch model back (no save warning)

2. **Update `prompts/b-save.md`**
   - Replace the `{{SESSION_STATE}}` placeholder block with: "Read `.context/workflow/current-session.json` for current session state. If the file doesn't exist, skip steps that depend on it."
   - Keep all 10 responsibilities as-is.

3. **Create `skills/b-save/SKILL.md`**
   - Standard skill format: `name: b-save`, `description: ...`
   - Documents the b-save workflow: memory creation, backlog update, index update, cross-reference stitching, phase state consolidation, iterate artifact consolidation.
   - References `prompts/b-save.md` as the prompt body.

4. **Update `extensions/buck-mode.test.ts`**
   - Remove test sections for: b-mode, b-restrict, plan mode, b-save command, CWD restriction
   - Keep any model-auto-switch tests (grep for "model" in test file)
   - If no model-switch tests exist, add basic smoke test: "registers model switch for b-build/b-iterate/b-review commands"

5. **Verify `package.json`**
   - `pi.extensions: ["./extensions/index.ts"]` ✓
   - `omp.extensions: ["./extensions/index.ts"]` ✓
   - Both keys already present and correct.

6. **Update `docs/extension-loading.md`**
   - Replace description of extension contents: "All extension commands (b-save, b-flow, etc.)" → "Model auto-switch for phased plans, TPS tracker"
   - Note that b-save is now a pure prompt/skill with no extension backing.

7. **Run tests**
   - `npx vitest run extensions/buck-mode.test.ts`
   - Verify no import errors in the slim extension.

## Verification

| Check | How |
|---|---|
| Extension loads without error | `node -e "import('./extensions/index.js')"` or `bun test` |
| Model auto-switch triggers for `/b-build` | Unit test or manual: run `/b-build` with a phased plan and `buckModelMapping` configured |
| TPS tracker wires | Unit test or manual: confirm `wireTpsTracker` is called |
| No b-mode / b-restrict / plan mode registered | `grep registerCommand extensions/index.ts` — only model-picker should remain (if any) |
| `/b-save` works as prompt-only | Invoke `/b-save` in a Pi session — LLM receives the prompt from `prompts/b-save.md` |
| Tests pass | `npx vitest run` |

## Risks

- **Model auto-switch `input` hook assumes `cwd` is set by `session_start`** — ensure `session_start` still captures `cwd` before `input` fires.
- **`before_agent_start` defers model switch** — the `pendingModelSwitchCommand` pattern still requires the `input` hook to set it and `before_agent_start` to fire it. Verify the timing still works without the session state machinery.
- **Removing b-save extension handler means `{{SESSION_STATE}}` never gets substituted** — must update the prompt before removing the handler, or `/b-save` sends a literal placeholder.
- **Dead code on disk** — `extensions/b-flow/`, `extensions/b-grill-auto/`, etc. remain but aren't wired. Could confuse future contributors. Mitigated by not importing them.

## Ralph Instructions

Non-phased plan — one build/review cycle.

1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md`, run `/b-iterate`, then `/b-review` again.
4. Run `/b-save` to consolidate.
5. Run `/git-commit` to checkpoint.
