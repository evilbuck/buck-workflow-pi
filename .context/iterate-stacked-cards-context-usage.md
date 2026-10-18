---
status: completed
date: 2026-10-01
updated: 2026-10-01
subject: 2026-09-30.buck-loop-tui-preview
topics: [review, iteration, tui, context-usage]
informs: []
addresses: plan-stacked-cards-live-integration.md
completed: 2026-10-01
from_review: b-review
---

# Iteration: Stacked-card child context usage

## Source

- Reviewed after: `/b-iterate`; exact assigned contract: `plan-stacked-cards-live-integration.md`, including the 2026-10-01 addendum and steps 11–15.
- Spec: none; research links: none.
- Baseline: `d828d8d6f12955781898beb268d47253276eaa09` plus current source, staged implementation and unstaged changes. Recent commits concern SQL memory and machine portability, not this card implementation. Source-state verification takes precedence over branch-history inference.
- The earlier completed `iterate-stacked-cards-live-integration.md` and `review-live-integration-verification.md` describe the core integration. Their passing claims do not establish the addendum's child-context behavior.
- Review-only assignment: no implementation, lifecycle, memory, backlog or supervisor-state changes. Supervisor recall was supplied; no SQL memory call was made.

## Critical Issues

### 1. Child context usage is absent end to end

- **Classification:** in-plan implementation defect, high priority; steps 11–15, acceptance criteria at `plan-stacked-cards-live-integration.md:179-182`, assumptions A6–A8.
- **Files:** `extensions/buck-loop/run-step.ts:170-176,462-482`; `extensions/buck-loop/loop.ts:130-137,792-796`; `extensions/buck-loop/index.ts:233-249`; `extensions/buck-loop/activity-widget.ts:11-21,52-68`; `extensions/buck-loop/activity-view.ts:8-19,26-32,63-75`.
- **Problem:** `SessionHandle` has no `getContextUsage()`. The child subscription forwards raw events but never samples that method. `LoopDeps` and the command adapter have no context observer; the card has no `context(usage)` operation; its render snapshot has no context field or context line. Completed-message input/output usage is cumulative reported work, not the child's current context occupancy or window percentage. No existing focused test verifies the addendum.
- **Runtime evidence:** a disposable driver executed the production card with the real Pi TUI Loader. At 44 columns all three profiles showed `42123 tokens` but no context line. `card.context` was absent. Supplying a render snapshot with `{ usedTokens: 42000, contextWindow: 200000, percent: 21 }`, or the nullable unknown form with the same window, produced no `ctx`, percentage or window-size-only line in any profile. The driver was removed after execution.
- **Proposed fix:** extend the child-session boundary with `getContextUsage()`, sample it in the existing subscription, and forward its value through an optional context observer in `runStep` and `LoopDeps` to the card. Store/reset child context per stage; never read the parent's `ctx.getContextUsage()` or derive occupancy from accumulated I/O. Add the typed render context and profile formatting: verbose absolute used/window plus percentage and visit I/O detail, standard `ctx 21%`, compact percentage only. When tokens/percent are null, show `ctx /200k`; when the whole usage value is unavailable, do not invent a window or `0%`. Preserve the protected token/spinner row and 44-column width budget. Keep context display-only: no compaction or loop-policy changes.
- **Verification required:** deterministic child-session tests for known and undefined usage, nullable post-compaction usage, later-event updates and stage reset; profile/width behavior tests including retained exact tokens/spinner. Then run a real phase and compare the card to that child's usage, not the parent, observing an in-phase change. Re-run the focused suites and durable guardrails.

## Warnings

- The ledger names A1–A8 but does not declare validated/deferred status or blocking flags. This review does not invent those fields or reopen the accepted design. A6–A8 lack implementation and evidence regardless of flags.
- Actual `/buck-loop` host interaction, native ranking latency and child-versus-parent live comparison were not rerun in this review. The previous verification artifact records native ranking at 176 ms and real-host profile/abort behavior for the core card; it contains no child-context proof. Fresh runtime proof here is component-level, with supplied machine/events and the real Loader, not a native child phase.
- The current workflow pointer names the unrelated state-machine subject and contains no active goal. It does not override the explicitly assigned plan or establish save completion for this target.

## Plan Path Review: Stacked-cards live integration

### Plan Source

- File: `.context/2026-09-30.buck-loop-tui-preview/plan-stacked-cards-live-integration.md`.
- Goal: truthful live state, work cost, legal continuations and recent activity in a narrow stacked card, plus the running child's context occupancy/window percentage.
- Baseline: `d828d8d` and current working tree; no commit/status claim is used as implementation proof.

### Evidence Sources

- Initial status contained the staged production renderer, projection, ranking, widget, command/loop/session observers, seven relevant suites and docs; pre-existing subject/gallery/backlog changes, an unstaged machine type deletion, untracked plan and other-subject work also existed.
- Production paths inspected: `activity-view.ts`, `activity-snapshot.ts`, `choice-ranking.ts`, `activity-widget.ts`, `index.ts`, `loop.ts`, `run-step.ts`, the existing chooser export diff and machine diff.
- Tests inspected/run: four co-located card suites and existing `__tests__/wire.test.ts`, `__tests__/run-step.test.ts`, `__tests__/loop.test.ts`.
- Documentation inspected: `docs/buck-loop.md`, `docs/howto/change-buck-loop-density.md`; retired viewport parity inspected in `extensions/extension-activity.ts`.
- Literal search for `getContextUsage`, `onContextUsage`, `ContextView`, `contextWindow`, `usedTokens` under `extensions/buck-loop` returned no matches; source inspection and actual rendering independently confirmed the gap.

### Completion Matrix

| Step / criterion | Status | Evidence / missing piece |
|---|---|---|
| 1. Pure production renderer | complete | `activity-view.ts:63-75`; rendering depends on explicit snapshot/profile/width/glyph, no machine imports or timers. |
| 2. Three density levels | complete | `activity-view.ts:26-60`; profile field-budget test and real component profile switching pass. |
| 3. Narrow protected current fields, closed heavy box | complete | `activity-view.ts:26-32`; nine 44/80/110 cases pass; fresh 44-column output preserves `42123 tokens` and glyph inside a closed box. |
| 4. Real snapshot projection, previous model/cost | complete | `activity-snapshot.ts:10-24`, `activity-widget.ts:52-68`; real-machine deterministic/ambiguous projection tests and transition/cost tests pass. |
| 5. Jev advisory ranking, legal-set immutability, no selection | complete | `choice-ranking.ts:23-39`; frozen-input ordering, fractional scores, no-selection and unranked native-failure tests pass. |
| 6. Loader lifecycle | complete for component behavior | `activity-widget.ts:29-46,99-104`; fresh real-timer glyphs and no-repaint teardown below; tests also cover host disposal. Prior real-host evidence is explicitly historical. |
| 7. Retire only this command's six-row viewport | complete | `index.ts:261-273` creates the card; assignment diff does not alter other commands or `extension-activity.ts`. |
| 8. Runtime profile control | complete | `index.ts:292-311`; command test switches the active card without restarting work and clears it on stop. |
| 9. Docs paragraph | complete | `docs/buck-loop.md:3-5` describes the current core card and advisory rule; density how-to exists. Child context is not yet documented because it is not implemented. |
| 10. Focused suites and durable checks | complete for implemented core | Seven suites pass: 140 tests, 3 skipped; guardrails pass. These suites contain no child-context acceptance coverage. |
| 11. Child context snapshot/getter | missing | Render snapshot lacks context; `SessionHandle` lacks getter. Fix: issue 1. |
| 12. Sample child usage on events | missing | `run-step.ts:473-482` only forwards raw/normalized events. Fix: issue 1. |
| 13. Thread context observer to card | missing | `LoopDeps`, nested runner, adapter and card expose no context path. Fix: issue 1. |
| 14. Profile context lines and 44-column protection | missing | No context rows at any profile, independently exercised with known usage. Fix: issue 1. |
| 15. Unknown window-only degradation | missing | Nullable usage input renders no window-size-only row. Absence of `0%` alone does not satisfy the required fallback. Fix: issue 1. |
| Live percentage tracks child rather than parent, updates during phase | missing | No sampling/rendering path exists; cannot exercise the requested child-phase behavior until issue 1 is implemented. |
| Verbose old-field parity | complete | `activity-widget.ts:70-96` retains text, phase, tool/target, success/failure messages, retry and completion; `activity-view.ts:56-60` renders all verbose entries. Existing parity/profile tests pass. |
| Machine/transition table/selection behavior unchanged | complete within assignment scope | Chooser diff only exports existing rubric; loop still invokes `chooseSafely` with original legal set (`loop.ts:580-605`). Pre-existing machine deletion removes an unused type, not transition policy. |
| A1/A2/A4/A5 | complete | Real-machine projection, immutable ranking, profile/width determinism and field-parity tests pass with inspected source. |
| A3 / Loader abort mitigation | complete at component level | Real Loader observed four distinct glyphs over 2.2 s, then zero repaints after disposal over 2.1 s and a late event. Real-host abort evidence remains historical. |
| A6/A7/A8 | missing | Child getter/event test, context width sweep and child-versus-parent phase proof absent. Fix: issue 1. |
| Material recovery routes | partial evidence | Full unranked fallback passes its test; profiles are renderer-local; old `createActivity`/status surface remains available in `extension-activity.ts`. Native ranking latency and actual alternate/dual-widget cutover are not freshly exercised here; no assertion of tested deployment rollback. |

### Review Axes

- **Spec axis worst finding:** high-priority missing child context occupancy/window percentage, steps 11–15 (issue 1). Verdict input: Needs work.
- **Standards axis worst finding:** none independently established in the scoped implementation. A second, explicitly scoped sequential pass used the TypeScript and universal-quality guides plus Duplicate Code/Long Method references. Inspected typed unknown-value boundaries, immutable ranking, async result/error handling, card ownership and cleanup, dependency reuse, method decomposition and nearby viewport utilities. Native failure preserves the legal set; Loader disposal is idempotent; renderer/projector/ranker remain separate; no new dependency or compelling duplication/abstraction defect found. This is not an independent-agent result.
- **Cross-axis ranking:** none; findings are not merged or reranked. No sub-agent dispatch tool was available, so the prescribed sequential fallback was used.

### Verification Status

- Goal achieved: partial. Core cards work; child context occupancy and percentage are not implemented.
- User goal: partially met. Current state, reported work tokens, legal continuations and activity are implemented; the explicitly added child-context readout is missing.
- Scope adhered: display-related implementation matches scope; no machine-policy or compaction change found. Pre-existing gallery, machine type deletion and unrelated subject/backlog work are excluded from this assignment's staging.
- Fresh focused command: `npx vitest run extensions/buck-loop/activity-view.test.ts extensions/buck-loop/activity-snapshot.test.ts extensions/buck-loop/choice-ranking.test.ts extensions/buck-loop/index.test.ts extensions/buck-loop/__tests__/wire.test.ts extensions/buck-loop/__tests__/run-step.test.ts extensions/buck-loop/__tests__/loop.test.ts` — exit 0, seven files passed, 140 tests passed, 3 skipped. Vitest is the repository convention; the plan's `bun test` spelling is not used as a passing-run claim.
- Fresh runtime command: `bun /tmp/buck-stacked-card-review-20261001.ts` — exit 0. Real production widget and Loader, supplied snapshot/events, all profiles at width 44; glyphs `⠋ ⠹ ⠴ ⠧` over 2.2 s; exact tokens retained; context method/lines absent; after dispose, no repaint for 2.1 s or late event. Temporary driver removed. No actual interactive terminal or native phase claim.

### Guardrails Verdict

- Command: `npm run guardrails:check`, exit 0.
- Contract: durable; version 2; runner 1.0.0; status: pass.
- Gates: unit_test_gate=pass, functional_test_gate=skipped, lint_gate=skipped, patch_gate=advisory, global_ratchet=pass, complexity_gate=pass.
- Functional and lint are disabled by the existing contract. Patch is advisory with null coverage, not a measured passing patch threshold.
- Coverage 88.2% versus baseline 84%; 30 baseline complexity hotspots, no new or hard-ceiling violations. Ratchet proposal not applied; contract/enforcement unchanged.

### User Goal Analysis

- Goal: identify current state, cost, legal continuations and recent activity at a glance without invented information; addendum requires the running child's absolute context usage/window percentage.
- Met: core live state/model/work-token accounting, deterministic/advisory continuations, profiles, activity, width and widget lifecycle.
- Partial: original visual goal works at the component level and has historical real-host evidence.
- Missing: child context measurement, in-phase update, profile readout, unknown window-only fallback and their acceptance proof.
- Verdict: partially met.

### Documentation Impact

- Existing docs accurately cover the implemented core card. After issue 1 is fixed, add the child-versus-parent measurement convention and nullable context behavior to `docs/buck-loop.md`.
- Recommended: `/b-docs` before `/b-save` after corrective implementation; non-blocking, not a separate correctness issue.

### How-to Impact

- No new action lacking a how-to: runtime density changes are covered by `docs/howto/change-buck-loop-density.md`. Context display adds no operator action.
- Recommended: none independently.

### Issue Classification

- In-plan: one end-to-end child-context implementation/verification defect (issue 1), route `/b-iterate`.
- Out-of-plan: none established.

### Completion Audit

1. Deliverables restated from the exact current plan, including the context addendum.
2. Every step mapped to current source/test/runtime evidence or a named missing piece in the matrix.
3. Actual current implementation inspected and durable checks run fresh; prior status and pass claims not treated as proof.
4. Fresh smoke exercised production card rendering/Loader, not gallery code. Native phase/parent comparison is not claimed; that path is absent.
5. Uncertainty retained: no context behavior inferred from work-token totals or passing existing suites; recovery/live-host limits stated.
6. Assigned review is fully delivered with a concrete correction artifact, not a passing implementation checkpoint. No goal-mode audit extension applies to the unrelated current-session pointer.

### Verdict

**Needs work** — the missing accepted addendum is an in-plan defect. Passing core suites/guardrails and earlier core verification do not satisfy steps 11–15.

## Recommended Workflow

Run `/b-iterate` against this artifact and the exact plan, implement and prove child-context behavior, then re-run `/b-review`. Sync living docs after implementation, then `/b-save` and `/b-commit` after acceptance. The earlier core iteration remains historical/completed; this separate active artifact records the remaining current-contract defect. This report does not select a supervisor continuation or mark the plan/subject complete.

## Assignment Ownership

Only this newly created iteration artifact is staged by this review. All pre-existing staged files, source changes, gallery work, the source plan, lifecycle/workflow pointers and other-subject/backlog changes are left untouched. No implementation files were changed.

## Corrective implementation resolution — 2026-10-01

Issue 1 is implemented end to end: child getter/event sampling, optional loop/command observer, resettable card context and all three profile readouts with nullable window-only degradation. No parent sampling, compaction behavior or machine-policy changes. Deterministic coverage includes changing child occupancy, compaction/unavailable samples, new-child/state reset and 44/80/110-column rendering.

Focused suites: 145 passed, 3 skipped. Final durable guardrails: pass (coverage 88.2 versus baseline 84; no new complexity violations; lint/functional skipped, patch advisory). Actual OMP child build executed in a disposable checkout: observed 16 distinct occupancy counts ending at 16,980, versus parent 13,103; rendered all profiles at 44 columns and emitted `CONTEXT_SMOKE_PASS`.

Full evidence, limitations and ownership: [Child-context iteration verification](iterate-context-usage-verification.md). This completion records corrective implementation only; historical review findings above remain the original failing baseline. Supervisor `/b-review`, `/b-save` and `/b-commit` remain separate stages; no loop state or plan lifecycle is selected here.
