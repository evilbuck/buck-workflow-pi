## Plan Path Review: Phase 4 Interactive Command Cutover

### Plan Source
- File: `.context/2026-09-22.buck-loop-model-config/phase-4-interactive-command-cutover.md`
- Goal: Apply the named stage profile to interactive Buck commands, then restore the parent session exactly.
- Baseline: working tree vs `HEAD` (`12a8e6d`). Phase 4 is uncommitted.

### Evidence Sources
- Git status: `extensions/index.ts`, `extensions/buck-mode.test.ts`, phase/overview checkboxes modified; `extensions/interactive-model-switch.ts` and `extensions/index.test.ts` untracked.
- Recent commits: Phase 3 loop cutover is `3ffeaa9`. This phase is not in that commit.
- Modified files verified: `extensions/interactive-model-switch.ts`, `extensions/index.ts`, `extensions/index.test.ts`, `extensions/buck-mode.test.ts`.
- `/buck-loop` is not wired into the interactive table.

### Completion Matrix

| Step | Status | Evidence |
|------|--------|----------|
| Skill→stage map, no `choice`, unlisted skills skip `buckModels` | ✅ complete | `INTERACTIVE_STAGE_BY_SKILL` at `extensions/interactive-model-switch.ts:27-46` matches the pinned groups. Unmapped input returns `continue` without `select` (`:144-146`). Test: `extensions/index.test.ts:67-73`, `/tokens` does not pick (`:138-140`). |
| Command text, subject artifacts, bounded user/assistant tail before the turn | ✅ complete | Built in `buildRequest` (`:238-254`) and passed into the picker (`:226-235`) on `input`, before `continue`. Tail keeps 8 user/assistant messages, 12,000 chars, oldest trimmed (`:95-101`). `contentToText` keeps only `type: "text"` (`extensions/omp-models.ts:517-526`). Artifacts from the open `current-session.json` `subject` or the single open subject (`:314-333`). Test: `index.test.ts:127-134`. |
| Missing profile/stage/candidates refuses before the skill; names the stage; no host default | ✅ complete | `selectInteractiveModel` (`:115-122`) uses `formatBuckStop`, which names the stage (`extensions/omp-models.ts:341-344`). Refusal returns `{ action: "handled" }` and does not call `setModel` (`interactive-model-switch.ts:206-208`). Test: `index.test.ts:148-165`. |
| Apply model and thinking; restore both on `agent_end` | ✅ complete | Snapshot then `setModel` + `setThinkingLevel` (`:268-290`). `agent_end` restores both (`:174-185`, `:296-311`). Test: `index.test.ts:135-145`. |
| Refusal, throw, and user override leave no stale switch and do not restore over a user change | ✅ complete | Refusal never sets `switched`. Throw restores inside the `input` handler and does not `markApplied` (`:214-217`). `model_select` outside the 100ms grace sets `userOverrode`; `agent_end` skips restore (`:168-181`). Tests: `index.test.ts:168-197`. |
| Focused adapter tests and guardrails | ✅ complete | `npx vitest run extensions/index.test.ts extensions/buck-mode.test.ts`: 24/24 passed. Guardrails below. |

### Review Axes
- Spec axis worst finding: none.
- Standards axis worst finding: if `restoreSnapshot` throws inside the apply `catch` (`interactive-model-switch.ts:214-217`), the refusal notify is skipped and the original error is replaced. Sequential fallback — no background `task` tool.
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: yes.
- User goal: met — interactive commands use the stage profile and restore the parent model and thinking.
- Scope adhered: yes. New module is the cutover the phase named; `extensions/index.ts` only wires it.
- Out-of-scope changes: none. `/buck-loop` is untouched.

### Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: pass
- Gates: unit_test_gate=pass, functional_test_gate=skipped, lint_gate=skipped, patch_gate=advisory (`patch: null`), global_ratchet=pass, complexity_gate=pass

### User Goal Analysis
- Goal: switch a named profile onto interactive Buck commands and restore the parent session exactly.
- Met: stage table, refusal, apply, restore, override guard.
- Partial: none against the phase criteria.
- Missing: none.
- Verdict: met.

### Documentation Impact
- No documentation impact
- Living docs still describe the old four-command difficulty switch. That update is Phase 6's file list, not this phase.
- Recommended: none

### How-to Impact
- No how-to impact
- No new user-facing command.
- Recommended: none

### Issue Classification
- In-plan issues: none.
- Out-of-plan issues: a second mapped command before `agent_end` overwrites the restore snapshot (`markApplied` at `:156-159`). The phase verification is one mapped command plus one unmapped command, which holds. Phase 6 still owns the docs cutover.

### Verdict
Pass with warnings — in-plan criteria are met. Warnings do not block this phase.

### Recommended Next Step
`/b-save` → `/b-commit` for Phase 4. Leave the snapshot-overwrite race and the docs cutover for later phases.

Summary
Documentation impact: flagged, owned by Phase 6 — do not run `/b-docs` before this phase's save
How-to impact: none
Suggested next step: `/b-save` → `/b-commit`
