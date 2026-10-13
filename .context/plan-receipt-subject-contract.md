---
status: active
date: 2026-10-02
subject: 2026-10-02.buck-loop-save-receipt-subject
topics: [buck-loop, sql-memory, receipts, save-stage, verification]
research: []
iterations: []
memory: []
---

# Plan: Fix buck-loop SQL-save receipt subject mismatch

## User Goal

The operator's `/buck-loop` save checkpoints verify deterministically: a save child that did the real work and wrote a real receipt must not be reported as unverifiable — and must not block at `saving → blocked` — merely because the receipt identity contract never told the child what the canonical `subject` string is.

## Goal

Close the receipt identity gap: `saveDirective()` emits `attemptId`, `runId`, `project`, `phase`, `receipt` but omits `subject`, so the child session invents a subject string when writing the receipt (and when passing `subject` to `op: "remember"`). `sameAttempt()` requires an exact subject match, so the invented string makes `receiptShape()` return `unverified` even when everything else matches. The fix dictates the canonical subject in the directive and pins the contract in the `b-save` skill, with a regression test.

## Context used / assumptions

- User-provided context: `.context/backlog/items/buck-loop-save-receipt-subject.md` (created 2026-10-02, untracked, `status: active`).
- Live evidence in this repo, verified 2026-10-02:
  - `extensions/buck-loop/sql-save.ts:80-93` — `saveDirective()` lists attemptId, runId, project, phase, receipt; no `subject` line.
  - `.context/workflow/sql-save-attempt.json` — `"subject": "2026-09-30.buck-loop-tui-preview"`.
  - `.context/2026-09-30.buck-loop-tui-preview/sql-memory-receipts/5cbd82ce-…-190ee6c4-….json` — `"subject": "2026-09-30.buck-loop-tui-preview stacked-cards live integration"`. `attemptId`, `runId`, `project`, `probed: true`, `completed: true`, one real memory id all match; only the undictated `subject` is wrong. That run ended `saving → blocked` at 03:50:20Z.
  - `skills/b-save/SKILL.md:39` — "The supervisor directive names `attemptId`, `runId`, `project`, `phase` … and `receipt`. Use those values exactly." The `subject` field is missing from that list too, and step 3 (`SKILL.md:47`) requires the child to write the receipt's `subject` without saying where it comes from.
  - Every dictated identity field matched in the incident; the single undictated field is the one that mismatched. This is the evidence that dictating `subject` closes the observed failure class.
- Assumption: the child copies dictated fields exactly (it always has for attemptId/runId/project); `subject` becomes equally dictated. Residual mistranscription risk is accepted; receipt unforgeability is explicitly out of scope.

Decision closure: low-risk path applies — reversible text changes, no trust-boundary change (the child gains no new capability; one more field is dictated), no migration, single layer, four files. Evidence recorded above; no ledger manufactured.

## Scope

1. `saveDirective()` (`extensions/buck-loop/sql-save.ts`) emits `subject: ${attempt.subject}` immediately after the `runId` line. No other behavior change.
2. `skills/b-save/SKILL.md` SQL-mode section: add `subject` to the directive-named values ("Use those values exactly"), and state that the receipt's `subject` field and the `op: "remember"` `subject` parameter must be the directive's `subject` value, copied exactly.
3. Recopy `skills/b-save/SKILL.md` to `plugins/buck-workflow/skills/b-save/SKILL.md` byte-identical (`scripts/codex-plugin.test.ts` enforces canonical copies).
4. Regression test in `extensions/buck-loop/__tests__/sql-save.test.ts`: the directive carries the complete receipt identity — assert it contains `subject: ${SUBJECT}` alongside the existing attemptId/runId/project/receipt assertions.

## Out of scope

- Receipt unforgeability / extension-side receipt writes (the remember-op plan, `.context/2026-10-01.sql-memory-remember-op/`, explicitly excluded it; changing who writes the receipt is a separate plan).
- The sibling item `buck-loop-save-commit-handoff` (teardown-vs-work failure classification, commit staging scope) — distinct defect, distinct plan.
- A diagnostic reason string on `unverified` receipts.
- Hand-editing the historical bad receipt (that would forge the postcondition). Recovery of the `2026-09-30.buck-loop-tui-preview` run is operational, not code: after the fix, resume the subject; `prepareSaveAttempt(reuse)` reuses the attempt, the child re-runs the save stage. Caveat to check at resume: if the original `remember` call passed the inflated subject, the retry inserts a second row under a different source key — recover with a `previousId` correction or supersede the duplicate then.

## Affected files

- `extensions/buck-loop/sql-save.ts` — `saveDirective()` gains the `subject` line.
- `extensions/buck-loop/__tests__/sql-save.test.ts` — directive-identity assertions.
- `skills/b-save/SKILL.md` — SQL-mode directive list + receipt `subject` sourcing.
- `plugins/buck-workflow/skills/b-save/SKILL.md` — byte-identical recopy.

## Implementation steps

1. In `saveDirective()`, insert `subject: ${attempt.subject},` after the `runId` entry (field order mirrors `SaveAttempt`: attemptId, runId, subject, project, phase, receipt).
2. In `skills/b-save/SKILL.md` line 39, add `subject` to the named-values sentence. In step 3 (line 47), add: the receipt's `subject` is the directive's `subject` value, exactly; the same value is the `subject` parameter of `op: "remember"`.
3. `cp skills/b-save/SKILL.md plugins/buck-workflow/skills/b-save/SKILL.md` (byte-identical copy).
4. Extend the existing `saveDirective` assertions in `sql-save.test.ts` with `expect(saveDirective(current)).toContain(\`subject: ${SUBJECT}\`)`.

## Acceptance criteria

- [x] `saveDirective()` output contains `subject: <canonical subject>`; existing fields and wording otherwise unchanged.
- [x] `skills/b-save/SKILL.md` names `subject` among the directive's values and requires exact use in both the receipt and the `remember` call; the bundled copy is byte-identical.
- [x] `npx vitest run extensions/buck-loop/__tests__/sql-save.test.ts scripts/codex-plugin.test.ts` passes.
- [x] `tsc` clean on the changed extension file (pre-existing unrelated diagnostics are non-blocking).
- [x] `npm run guardrails:check` verdict `pass`.

## Verification

```bash
npx vitest run extensions/buck-loop/__tests__/sql-save.test.ts scripts/codex-plugin.test.ts
npm run guardrails:check
```

Behavioral proof (throwaway, not committed): build a `SaveAttempt` via `prepareSaveAttempt`, print `saveDirective(attempt)`, confirm the `subject:` line equals `attempt.subject`; then `writeReceipt` via the normal path and confirm `verifySqlSave` returns `verified` — i.e. a directive-conformant receipt verifies, which is the incident's failing transition.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings route to a separate `/b-plan` → `/b-build` cycle. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted, leave a clear note in memory and resume from the active plan next turn.

## Risks

- The child could still mistranscribe the dictated subject. Mitigation: dictation is exactly how attemptId/runId/project have stayed correct across every observed receipt; the incident's only failure was the undictated field. Residual risk accepted; the stronger fix (extension-side receipt write) is deliberately out of scope.
- Byte-identity drift between the two `b-save` skill copies. Mitigation: recopy in the same change; `scripts/codex-plugin.test.ts` fails the suite otherwise.
