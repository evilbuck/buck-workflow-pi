# Extension audit — `extensions/` and `extensions/index.ts`

Date: 2026-09-21 · Repo: `buck-workflow-pi` · Branch: `master` @ `7dc2aaf`
Scope: every top-level path under `extensions/`, plus `extensions/index.ts`.
Doc targets: `docs/extension-loading.md`, README "Extension-Backed Commands" section.

Source of truth: `extensions/index.ts` (default export) — eight explicit
`wire*(pi)` calls and one inlined handler block. Anything not on that list
is unwired.

---

## Wired extensions (called from `extensions/index.ts` default export)

| Path | Wire call | `registerCommand` (if any) | Notes |
|---|---|---|---|
| `extensions/index.ts` | self (default export) | — | Composes the seven wires below + inlines model auto-switch (no command). |
| `extensions/tps-tracker.ts` | `wireTpsTracker(pi)` | none | Token-per-second tracker via `agent_start`/`message_update`/`message_end`/`agent_end`. |
| `extensions/b-pr-improved/index.ts` | `wireBprImproved(pi)` | `b-pr-improved` | Deterministic PR: preflight script → model conflict resolve → push → `gh pr create`. |
| `extensions/b-commit-improved/index.ts` | `wireBCommitImproved(pi)` | `b-commit-improved` | Conventional Commits: preflight → model draft → commit, with sentinel fallback. |
| `extensions/b-kamal-release/index.ts` | `wireKamalRelease(pi)` | `b-kamal-release` | Kamal tag + deploy. **No skill fallback.** |
| `extensions/plan-artifact.ts` | `wirePlanArtifact(pi)` | none | Opt-in `turn_end` hook persisting OMP plan-mode exits to `.context/`. |
| `extensions/b-save-improved/index.ts` | `wireBSaveImproved(pi)` | `b-save-improved` | Deterministic session checkpoint (preflight → scribe → auditor → apply). |
| `extensions/code-review-iteration/index.ts` | `wireCodeReviewIteration(pi)` | `code-review` | Local Reviewer → Fixer → fresh-Reviewer loop. **Name collision with skill.** |
| `extensions/buck-loop/index.ts` | `wireBuckLoop(pi)` | `buck-loop` | Observable happy-path plan runner. |
| inlined in `extensions/index.ts` | (no function) | — | Model auto-switch on `b-build`/`b-build-hard`/`b-iterate`/`b-review`; deferred to `before_agent_start`; restore on `agent_end`; consumes `omp-models.ts::mappingFromOmpRoles`. |

---

## Helpers / libraries (no `wire()`, only imported by other extensions)

| Path | Imports | Consumers |
|---|---|---|
| `extensions/subprocess.ts` | none internal | `b-kamal-release`, `b-pr-improved`, `b-commit-improved`, `b-save-improved`, `code-review-iteration` — `execFileCaptured`, `execFileCapturedWithStdin`, `recordCommandError`, `createLineRing`, `KAMAL_TAIL_LINES`. |
| `extensions/state-machine.ts` | none internal | `buck-loop/machine.ts`, `buck-loop/loop.ts`, `code-review-iteration/machine.ts`, `code-review-iteration/loop.ts`, plus `docs/state-machine.md` example. |
| `extensions/omp-models.ts` | none internal | `index.ts` (`mappingFromOmpRoles` only); `b-pr-improved`, `b-commit-improved`, `b-save-improved`, `code-review-iteration`, `buck-loop/{choice,run-step}`. `DIFFICULTY_TO_ROLE`, `ompAgentDir`, `readOmpModelRoles`, `resolveOmpRole`, `runOmpModelSession`, `EmptyModelResponseError`, `lastAssistantText`. |
| `extensions/extension-activity.ts` | none internal | `b-kamal-release`, `b-pr-improved`, `b-commit-improved`, `b-save-improved`, `buck-loop`, `code-review-iteration`. `createActivity` + `ActivityEvent` + `Activity` + `sanitizeLine` + types. **Has its own test suite.** |

---

## Unwired / dead candidate extensions

| Path | Status | Why unwired |
|---|---|---|
| `extensions/grill-me-dialog.ts` | UNWIRED | `registerTool("grill-me_dialog", ...)` would expose a custom tool if loaded; not imported anywhere outside its own file. Plan reference: `.context/2026-05-08.grillney-doc-skill/`. No live skill, prompt, or command wrapper references it. |
| `extensions/tmux-window-status.ts` | UNWIRED | Exports `wire`/`StateMachine`/`TmuxAdapter`; not imported by `index.ts` or any other file. Previous bug research (`.context/2026-05-07.tmux-window-name-bug/`) targeted this exact file. Plan (`2026-06-05.extension-slimdown`) explicitly chose to leave it on disk as "dead code the user can re-add later if wanted." |
| `extensions/tmux-window-status.test.ts` | DEAD-TEST | Targets the unwired `tmux-window-status.ts`. |
| `extensions/b-grill-auto/` (5 files: `index.ts`, `rpc-client.ts`, `harness.ts`, `grill-state.ts`, `types.ts`) | UNWIRED | `index.ts` exports `wire` and registers `b-grill-auto`, but `extensions/index.ts` never imports or wires it. Backlog item `.context/backlog/items/test-b-grill-auto-extension.md` (status `active`, priority `high`, created 2026-05-08) still says "Test b-grill-auto extension in live Pi session" — there is no Pi session to test, since the extension is never loaded. The skill `skills/b-grill-auto/SKILL.md` still exists and documents the Python-prototype flow (not this TypeScript extension). |
| `extensions/extension-activity.ts` | HELPER (not a candidate for unwiring) | See Helpers table; central live-progress module for the six long-running commands. |

---

## Test files classified

| Path | Status | Notes |
|---|---|---|
| `extensions/buck-mode.test.ts` | DEAD-TEST | Imports `buckWorkflowExtension` from `./index.js`; asserts that `b-mode`, `b-restrict`, `b-save`, `registerShortcut`, `tool_call`, `tool_result`, `session_before_compact` are NOT registered; plus model-auto-switch behavior. There is no `extensions/buck-mode.ts`. The test is pinning the post-slimdown shape and exercising `index.ts`. Keep — it is the regression test for the slimdown plan `.context/2026-06-05.extension-slimdown/`. |
| `extensions/extension-activity.test.ts` | KEEP (live helper) | Tests `createActivity` directly. |
| `extensions/state-machine.test.ts` | KEEP (live helper) | Tests `defineMachine` / `MachineFailure`. |
| `extensions/omp-models.test.ts` | KEEP (live helper) | Tests `parseModelRoles`, `mappingFromOmpRoles`, etc. |
| `extensions/subprocess.test.ts` | KEEP (live helper) | Tests `execFileCaptured` and friends. |
| `extensions/plan-artifact.test.ts` | KEEP (wired) | Tests the opt-in `wirePlanArtifact`. |
| `extensions/tmux-window-status.test.ts` | DEAD-TEST | See Unwired table. |
| Per-extension test dirs (`b-pr-improved/__tests__`, `b-commit-improved/__tests__`, `b-save-improved/__tests__`, `b-kamal-release/__tests__`, `buck-loop/__tests__`, `code-review-iteration/__tests__`) | KEEP (wired) | Cover the wired wires. |

---

## Findings (priority ordered)

### F1 — `extensions/grill-me-dialog.ts` is dead code
**Classification:** CLEAN `DELETE` candidate (or `UNWIRE` if a planned revival exists).
**Evidence:**
- Not imported by `extensions/index.ts` (grep across the repo finds zero consumers outside `extensions/grill-me-dialog.ts`).
- No `registerCommand`/`registerTool` reaches the host because the extension never loads; `registerTool` is a no-op.
- Plan reference `.context/2026-05-08.grillney-doc-skill/plan-grillney-doc-skill.md` proposed wiring it; `.context/2026-06-05.extension-slimdown/plan-extension-slimdown.md` then listed it for **disable** (not disk-delete): "`grill-me dialog` | **Delete** | `wireGrillDialog(pi)` removed. `extensions/grill-me-dialog.ts` stays on disk."
- `inventory-prompts.md` (2026-05-12) catalogues it as "grill-me-dialog.ts | `extensions/` | Document-mode dialog for b-grill-me skill" — never progressed to wired.
- No backlog item, no prompt, no command wrapper references it.
**Action:** DELETE `extensions/grill-me-dialog.ts`. Remove the inline TODO-class references in `.context/2026-05-08.grillney-doc-skill/plan-grillney-doc-skill.md` if any, since the plan never shipped.

### F2 — `extensions/tmux-window-status.ts` + test are dead code
**Classification:** DELETE.
**Evidence:**
- File exports `wire`, `StateMachine`, `TmuxAdapter`, `Status`, `STATUS_ICONS`, `StatusDisplay`, `StatusLogger`, `WiringDeps`. None imported anywhere outside its own module.
- `extensions/index.ts` does not call `wireTmuxStatus`; prior research `.context/2026-05-07.tmux-window-name-bug/research-tmux-window-name-bug.md` line 19 says "extensions/index.ts — Wires wireTmuxStatus(pi) on line 309", but the current `index.ts` has no such call. The wiring was removed by the slimdown plan (`2026-06-05.extension-slimdown`).
- `extensions/tmux-window-status.test.ts` covers the unwired module.
- README and `docs/extension-loading.md` list it as "(unwired) tmux window status"; no other repo surface mentions the file.
**Action:** DELETE `extensions/tmux-window-status.ts` + `extensions/tmux-window-status.test.ts`.

### F3 — `extensions/b-grill-auto/` is dead code; the live-test backlog item is stale
**Classification:** CLEAN `DELETE` candidate for the directory; CLEAN `UNWIRE` for the backlog item.
**Evidence:**
- `extensions/index.ts` does not import `./b-grill-auto/index.js` and does not register `b-grill-auto`. The extension's `wire()` exists and would register the command if loaded.
- `.context/backlog/todo.md` line 16: `- [ ] [Test b-grill-auto extension in live Pi session](items/test-b-grill-auto-extension.md)` — still active, priority `high`. The extension is not wired, so there is no live Pi session to test.
- The plan that built it (`.context/2026-05-08.b-grill-auto/plan-b-grill-auto-extension.md`) planned to "Modify `extensions/index.ts` — Import + wire new module"; that step was never executed.
- `.context/2026-06-05.extension-slimdown/plan-extension-slimdown.md` row 27 explicitly says: "`b-grill-auto` | **Delete** | `wireGrillAuto(pi)` removed. `extensions/b-grill-auto/` stays on disk."
- `.context/2026-09-11.extension-activity-progress/plan-extension-activity-progress.md` line 29: "`extensions/b-flow/` and `extensions/b-grill-auto/` are unwired/deprecated source, not current runtime surfaces. They are not retrofit targets."
- `.context/2026-09-16.decision-closure/phase-5-narrative-and-proof.md` line 70: "`extensions/b-grill-auto/` untouched." — explicitly out-of-scope.
- Skill `skills/b-grill-auto/SKILL.md` still exists, but it documents the **Python** prototype (`skills/b-grill-auto/grill.py`), not the TypeScript extension.
**Action:** DELETE `extensions/b-grill-auto/` (all 5 files). Move the backlog item `test-b-grill-auto-extension.md` to completed (or remove it); the extension has been intentionally unwired and the runtime entry is the Python skill, which is out of scope for this directory.

### F4 — `/code-review` slash command has name collision (extension vs skill)
**Classification:** KEEP, but CATALOG-GAP — the prompt body in `prompts/code-review.md` does not warn the user that the runtime depends on whether the extension is loaded.
**Evidence:**
- `extensions/code-review-iteration/index.ts:433` registers `pi.registerCommand("code-review", ...)` — runs the local Reviewer/Fixer loop using `omp-models.ts::runOmpModelSession`.
- `prompts/code-review.md` is a thin loader: `Load and follow the code-review skill: skills/code-review/SKILL.md`. This invokes the **release-PR review** skill.
- `skills/code-review/SKILL.md` (frontmatter `name: code-review`) is the release-PR review workflow that fans out parallel agents and writes `CODE-REVIEW.md` — a different concern from the iteration loop.
- README's "Extension-Backed Commands" table documents this collision: "the same command name runs the bounded local Reviewer → optional Fixer → fresh-Reviewer loop."
- `docs/extension-loading.md` line 89 echoes the README.
- **What the prompt file does not say:** When the extension is loaded, the prompt is ignored and the iteration loop takes over — i.e. the prompt body becomes an active argument the LLM does not see. Users running `/code-review` from a fresh checkout (no extension) get the release-PR skill; users with the extension get the iteration loop. The user cannot tell which from the prompt body alone.
**Action:** Either rename one side (e.g. `code-review-iteration` ↔ `code-review-local`) or add a one-liner to `prompts/code-review.md` stating that with the extension loaded, this same command runs the iteration loop. The README and `docs/extension-loading.md` already document the dual identity; the prompt body is the missing piece.

### F5 — `b-kamal-release` is extension-only; no skill, no prompt backstop
**Classification:** KEEP (extension) but CATALOG-GAP.
**Evidence:**
- `extensions/b-kamal-release/index.ts:502` registers `pi.registerCommand("b-kamal-release", ...)`.
- `prompts/b-kamal-release.md` exists (moved into `prompts/` during the 2026-09-18 mirror heal, formerly an OMP-only command) and ends with: "Without the extension there is no skill fallback — load the extension or run `kamal deploy` directly."
- `skills/b-kamal-release/` does not exist (verified by directory listing; only the four `b-grill-*` skills have directories).
- The prompt therefore documents the no-fallback shape; no rename needed.
**Action:** KEEP. Document is consistent. Worth flagging here because `b-kamal-release` is the only `/b-*` command with no skill fallback — it's the lone project-specific command and may deserve a project-specific runner if the extension is ever unwired.

### F6 — `b-kamal-release` is PROJECT-SPECIFIC
**Classification:** KEEP but flag.
**Evidence:**
- The extension is dedicated to one ruby-tag application deployment workflow; the README and `docs/extension-loading.md` describe it generically but it has no skill equivalent.
- No evidence the kamal tool is wired elsewhere; the extension is the only entry point.
**Action:** No change. Future renames should keep `/b-kamal-release` paired with the kamal tool or move the flow to a generic deploy/release helper.

### F7 — `plan-artifact` (extension) is opt-in and lives separately from the `b-plan` skill
**Classification:** KEEP.
**Evidence:**
- `extensions/plan-artifact.ts` exports `wire`, `findPlanExit`, `slugFromPlanUrl`, `withFrontmatter`, `isPlanArtifactEnabled`. Header comment documents opt-in via `BUCK_PLAN_ARTIFACT=1` env var or `buckPlanArtifact.enabled: true` settings.
- `extensions/index.ts` calls `wirePlanArtifact(pi)`.
- No name collision: `prompts/b-plan.md` is the `b-plan` skill loader; `plan-artifact` is a hook, not a command.
**Action:** KEEP. The opt-in is properly contained and the test suite (`extensions/plan-artifact.test.ts`) exercises it.

### F8 — `extension-activity.ts` is only consumed by the wired commands; not wired itself
**Classification:** KEEP. (Confirmed by grep: only `b-pr-improved`, `b-commit-improved`, `b-save-improved`, `b-kamal-release`, `buck-loop`, `code-review-iteration` import it.)
**Evidence:**
- Imports confirmed in those six modules and in their tests.
- No external consumers (e.g. `skills/`, `prompts/`, `commands/`).
- Module exports `createActivity`, `ActivityEvent`, `Activity`, `ActivityUI`, `ProgressLevel`, `sanitizeLine`. None registered as commands.
**Action:** KEEP. This is a shared library, not a candidate for unwiring.

### F9 — `subprocess.ts`, `state-machine.ts`, `omp-models.ts` are all used by wired extensions
**Classification:** KEEP.
**Evidence:** grep confirms:
- `subprocess.ts` is imported by `b-kamal-release`, `b-pr-improved`, `b-commit-improved`, `b-save-improved`, `code-review-iteration` (and by their tests).
- `state-machine.ts` is imported by `buck-loop/machine.ts`, `buck-loop/loop.ts`, `code-review-iteration/machine.ts`, `code-review-iteration/loop.ts`, and cited in `docs/state-machine.md`.
- `omp-models.ts` is imported by `index.ts` (just `mappingFromOmpRoles`), `b-pr-improved`, `b-commit-improved`, `b-save-improved`, `buck-loop/{choice,run-step}`, `code-review-iteration`.
**Action:** KEEP.

### F10 — `buck-mode.test.ts` is the slimdown regression test, not a dead test
**Classification:** KEEP (despite the misnamed "buck-mode" stem).
**Evidence:**
- Imports `buckWorkflowExtension` from `./index.js` and runs through the wired extension.
- Asserts `b-mode`, `b-restrict`, `b-save`, `registerShortcut`, `tool_call`, `tool_result`, `session_before_compact` are NOT registered — i.e. it pins the slimdown contract from `.context/2026-06-05.extension-slimdown/`.
- It is the only test that exercises the model auto-switch in `index.ts`.
**Action:** KEEP. Optional follow-up: rename the file to `slimdown.test.ts` so the intent matches the filename.

### F11 — Extension-activity is in fact imported by the `*-improved` commands (confirmed)
**Classification:** KEEP. (Verify the task's open question.)
**Evidence:** grep across `extensions/` shows `from "../extension-activity.js"` in:
- `extensions/b-commit-improved/index.ts` (line 22): `import { createActivity, type ActivityEvent } from "../extension-activity.js";`
- `extensions/b-kamal-release/index.ts` (line 27): `import { createActivity } from "../extension-activity.js";`
- `extensions/b-pr-improved/index.ts` (line 26): `import { createActivity, type ActivityEvent } from "../extension-activity.js";`
- `extensions/b-save-improved/index.ts` (line 13): `import { createActivity, type ActivityEvent } from "../extension-activity.js";`

The remaining consumers (`buck-loop/index.ts`, `code-review-iteration/index.ts`) also import it.
**Action:** KEEP. The question "is extension-activity actually imported by the *-improved commands" — answer: yes, by all three: b-pr-improved, b-commit-improved, b-save-improved (and b-kamal-release, buck-loop, code-review-iteration).

### F12 — `b-grill-auto` extension vs `skills/b-grill-auto` skill: same name, different runtimes
**Classification:** CATALOG-GAP (separate from F4).
**Evidence:**
- `skills/b-grill-auto/SKILL.md` documents the **Python prototype** (`skills/b-grill-auto/grill.py`), invokes `/skill:b-grill-auto` in the user's session, and does not reference the TypeScript extension.
- The TypeScript extension (`extensions/b-grill-auto/`) was built to replace the Python flow but never wired.
- No `/b-grill-auto.md` prompt exists; the user reaches the skill via `/skill:b-grill-auto` (not `/b-grill-auto`).
**Action:** Pick one path forward: delete the extension (F3) and keep the Python skill, or wire the extension and retire `grill.py`. Documenting both as separate things is misleading.

### F13 — `b-kamal-release` has no slash prompt outside the extension-fallback note
**Classification:** KEEP (catalog gap closed by `prompts/b-kamal-release.md`).
**Evidence:**
- `prompts/b-kamal-release.md` is a thin loader that points at the extension code.
- README's "Extension-Backed Commands" table documents it: "no skill fallback".
- README and `docs/extension-loading.md` both include `/b-kamal-release` in the extension-backed list.
**Action:** KEEP. Already in sync.

### F14 — README vs `docs/extension-loading.md` description mismatch
**Classification:** CATALOG-GAP (minor).
**Evidence:**
- README's "Extension-Backed Commands" lists six backed commands including `/buck-loop` and `/code-review` — current and correct.
- `docs/extension-loading.md` lines 142-147 (from research notes) used to describe the wired extension as "model auto-switch + TPS only"; the current text (verified above) lists all eight wires correctly.
- README line 89 / docs line 92 row explicitly call out `/code-review` as "Portable prompt: release-PR review; with the Pi/OMP extension loaded, the same command name runs the bounded local Reviewer → optional Fixer → fresh-Reviewer loop" — already documented.
**Action:** KEEP. Cross-checked; both docs agree.

---

## Keep (brief)

- **Wired commands:** `b-pr-improved`, `b-commit-improved`, `b-save-improved`, `b-kamal-release`, `code-review`, `buck-loop`.
- **Wired no-command extensions:** `tps-tracker` (events only), `plan-artifact` (opt-in `turn_end` hook), the inlined model auto-switch block.
- **Helpers / shared libraries:** `subprocess.ts`, `state-machine.ts`, `omp-models.ts`, `extension-activity.ts` (each used by ≥1 wired command).
- **Test suites:** every `__tests__` under a wired command dir, plus `extension-activity.test.ts`, `state-machine.test.ts`, `omp-models.test.ts`, `subprocess.test.ts`, `plan-artifact.test.ts`, and `buck-mode.test.ts` (slimdown regression test).

---

## Open questions

1. **Code-review name collision** (F4): rename one side (`/code-review-iteration` vs `/code-review-release`) or update `prompts/code-review.md` to document the dual identity at runtime? The README/docs already describe both — only the prompt body is missing.
2. **b-grill-auto extension vs skill** (F12): is the Python `skills/b-grill-auto/grill.py` flow still in active use? If yes, the extension is purely dead and should be deleted (F3) along with its backlog item. If no, retire `grill.py` and keep the skill prompt as a stub.
3. **b-kamal-release** (F6): is the kamal workflow genuinely project-specific, or could it become a generic deploy-release skill? Today it's the only `/b-*` command without a skill fallback.
4. **`buck-mode.test.ts`** (F10): rename to `slimdown.test.ts` or `index.test.ts` so the test name matches the intent? Pure cosmetic; no functional impact.