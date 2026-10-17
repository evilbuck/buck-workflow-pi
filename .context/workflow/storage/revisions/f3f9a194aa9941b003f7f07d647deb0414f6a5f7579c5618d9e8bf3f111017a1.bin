---
status: completed
date: 2026-10-01
subject: 2026-09-30.buck-loop-tui-preview
topics: [review, tui, child-context-usage]
plan: plan-stacked-cards-live-integration.md
review_verdict: pass-with-warnings
---

# Plan Path Review: Stacked-cards live integration

## Verdict

**Pass with warnings.** No remaining in-plan implementation defect established. The previously missing child-context addendum is implemented and covered by fresh passing tests. Documentation drift and verification limits below are non-blocking. This review does not close the plan, save shared memory, commit implementation, or choose a supervisor continuation.

## Plan Source

- Exact contract: `plan-stacked-cards-live-integration.md`, including steps 11–15 and all sixteen acceptance criteria.
- User goal: truthful, glanceable current state, reported work cost, legal continuations and recent activity at narrow widths; current context occupancy must come from the child stage session.
- Baseline: `d828d8d6f12955781898beb268d47253276eaa09` plus staged implementation and current source. Recent commits concern SQL memory and machine portability, not this card implementation; source-state verification is the acceptance baseline.
- Spec/research links: none. Reviewed corrective work recorded in `iterate-stacked-cards-context-usage.md` and `iterate-context-usage-verification.md`.

## Evidence Sources and Ownership

- Initial status: extensive pre-existing staged card implementation/tests/docs and subject artifacts; unstaged gallery, backlog, lifecycle index and machine changes; untracked plan and unrelated subject work. These were not changed or staged by this review.
- Relevant recent commits: `d828d8d` SQL notice/rebase record; `80d5def` machine-loop merge; `bda7423` portable buckMachine cutover. They do not establish this plan's completion.
- Production inspected: `activity-view.ts`, `activity-snapshot.ts`, `activity-widget.ts`, `choice-ranking.ts`, `index.ts`, `loop.ts`, `run-step.ts`, and the `choice.ts` rubric-export diff.
- Tests inspected/executed: renderer, projection, ranker, live card, command wiring, nested session and loop suites.
- Documentation inspected: `docs/buck-loop.md`, `docs/howto/change-buck-loop-density.md`, and the older activity convention in `docs/oh-my-pi.md`.
- Supervisor-provided recall reused as reference only. No `sql_memory` call.
- Workflow pointer names the unrelated state-machine subject and has no active goal; it does not override this exact assigned plan or establish its save completion.

## Completion Matrix

| Planned step / deliverable | Status | Current evidence |
|---|---|---|
| 1. Pure typed renderer, no machine/runtime effects | complete | `activity-view.ts:1-21,77-89`: type-only domain imports, caller-supplied glyph, pure line rendering. Nine profile/width cases pass. |
| 2. Compact/standard/verbose fields | complete | `activity-view.ts:38-75,81-87`; renderer field-budget tests and fresh production smoke frames. Compact omits previous/activity/ledger; verbose retains activity and visit splits. |
| 3. Preserve tokens/spinner at narrow widths | complete | `activity-view.ts:38-46`; 44/80/110 width assertions pass; fresh 44-column component frames preserve `42123 tokens` and live glyph in every profile. |
| 4. Real state/legal-set/previous visit projection | complete | `activity-snapshot.ts:10-24`; real-machine deterministic/ambiguous fixture tests pass. `activity-widget.ts:58-76` archives actual selected models and reported usage before changing state. |
| 5. Native display-only ranking | complete | `choice-ranking.ts:23-39`: skip <2 choices, native score question, sort a new list, no selected action. Frozen-input/fractional/error tests pass. Fresh real native result: save 3.46, iterate 2.66, document 2.52; 222 ms rounded. |
| 6. Component factory/Loader lifecycle | complete | `activity-widget.ts:35-53,112-117`; real Loader smoke observes all ten glyphs over 2.24 seconds and zero repaint requests for 500 ms after disposal. Host/command disposal regressions pass. |
| 7. Retire only buck-loop's six-row request | complete | `index.ts:262-274`; staged diff replaces this command's `createActivity` only. Other command callers still use the unchanged shared module. |
| 8. Runtime profile switch | complete | `index.ts:293-300`; wire regression changes density without another work session and clears the card on stop. Earlier actual OMP profile interaction is recorded at `review-live-integration-verification.md:34-38`. |
| 9. Card documentation | complete | `docs/buck-loop.md:3-7`; density how-to covers runtime action. Older host-wide narrative drift is a separate non-blocking documentation impact. |
| 10. Focused suites and durable contract | complete | Fresh seven-suite run: 145 passed, 3 skipped. Fresh `npm run guardrails:check`: durable v2 pass. |
| 11–12. Child context field/getter/event sampling | complete | `run-step.ts:172-176,465-480`; `activity-view.ts:8,20,28-35`; getter is called on the created child at entry and subscription events, not the command parent. Child compaction/unavailability regression passes. |
| 13. Forward/reset context without polling or compaction | complete | `loop.ts:138,798`, `index.ts:241`, `activity-widget.ts:60-80`; stage/new-child resets and subsequent occupancy updates pass. No new polling timer or compaction call. |
| 14. Profile-specific context without displacing tokens | complete | `activity-view.ts:29-43`; fresh frames show compact `30%`, standard `ctx 30%`, verbose `ctx 60k / 200k · 30%`, with exact work tokens and spinner preserved. |
| 15. Unknown usage without fabricated zero | complete | `activity-view.ts:31`, `activity-widget.ts:78-81`; all-profile null/undefined tests and fresh smoke: nullable usage yields `ctx /200k`; wholly unavailable usage omits the readout because no window is known. |
| Heavy closed CURRENT box | complete | `activity-view.ts:44-46`; all-profile tests and production frames contain closed heavy top/sides/bottom. |
| Deterministic plain next, complete advisory decision set | complete | Projection tests pass; fresh real-machine review snapshot renders iterate/save/document with native scores and `ranked, not pre-selected`. Compact retains every legal kind with an advisory label. |
| Previous model and token cost | complete | Fresh production smoke archives building with `provider/build-model` and 300 reported tokens; model/cost transition regression passes. |
| Verbose old-field parity | complete | Old `ActivityEvent` contract in `extension-activity.ts:34-39,211-222`; new `activity-widget.ts:83-110` retains phase/text/tool/target/result/retry/completion fields; `activity-view.ts:70-74` retains verbose rows. |
| Machine and chooser exclusions | complete | Card work's staged diff leaves transition table/Choice unchanged; `choice.ts` only exports its existing rubric. Loop observers publish display state and await ranking but never use ranking to select an action. Pre-existing unstaged machine edits are not attributed to this plan. |
| Child-versus-parent live provenance and in-phase updates | complete | Current child-only sampling/forwarding/reset path plus fresh deterministic update tests; recorded native-child output at `iterate-context-usage-verification.md:37-59`: child occupancy changes through 16 counts, ending 16,980 versus parent 13,103, card matching the child. This native-child run is prior evidence, not rerun or presented as freshly observed here. |

## Assumptions and Material Recovery Claims

The accepted ledger does not label assumptions as blocking/deferred; this review does not invent those flags or reopen the design.

| Assumption / risk | Result | Evidence |
|---|---|---|
| A1: machine supplies legal set without policy change | validated | `activity-snapshot.test.ts:10-18`, current production projection, fresh legal decision smoke. |
| A2: ranking orders only, never mutates/selects | validated | Frozen legal input and absence of selected-action result in `choice-ranking.test.ts:5-13`; separate chooser remains authoritative in `loop.ts:582-585,601-608`. |
| A3: live Loader animation | validated | Fresh production TUI/component run observes all ten glyphs; earlier actual OMP loop animation recorded at `review-live-integration-verification.md:36`. |
| A4: deterministic width-aware rendering | validated | Nine repeat-output/width tests plus fresh component sweep at 44/80/110. |
| A5: verbose retains old fields | validated | Field-contract comparison above and fresh verbose tool target/result/visit split output. |
| A6: real child exposes context getter | validated | `run-step.ts:465-480`, fresh child-session regression; prior native phase output in `iterate-context-usage-verification.md:37-59`. |
| A7: context respects 44-column budget | validated | All-profile width tests and fresh component frames. |
| A8: child, not parent, source | validated | Actual child local variable owns the getter; no parent getter in wiring. Prior native comparison records different parent/child values and in-phase movement. |
| Ranking interpreted as selection | mitigated | Explicit advisory labels; ordering-only return. Frozen-input tests and fresh native-ranked legal list. |
| Abort/finish leaks Loader interval | mitigated | Idempotent stop/remove in `activity-widget.ts:40-51,112-117`; command `finally` at `index.ts:282-288`; fresh disposal/late-event smoke and passing host/command tests. Existing stop remains a widget teardown claim, not newly proven in-flight child cancellation. |
| Added ranking latency | validated within exercised path | Fresh standalone native batch ~222 ms; production decision card ~222 ms. Zero/single-choice path skips native requests. Prior real chooser handoff recorded at `review-live-integration-verification.md:43-59`; no claim of a latency bound for all networks. |
| Unranked fallback / real legal-set projection | available | Current `choice-ranking.ts:37-38` plus passing native-failure regression retains complete unranked legal set; deterministic renderer works without choices/ranks. |
| Spinner/status or retained old viewport recovery | available, not switched on | Unchanged shared `createActivity`/`setStatus` implementation remains in `extension-activity.ts:177-223`; other commands still use it. These are available recovery paths requiring a deliberate wiring change, not automatic runtime fallbacks. |
| Profile-ladder recovery | available | Profile-specific formatting isolated in `activity-view.ts`; no machine change needed. |

## Review Axes

- **Spec axis worst finding:** none remaining. The prior missing child-context implementation has direct source/test/runtime evidence now.
- **Standards axis worst finding:** none established in the scoped implementation. A second explicitly scoped sequential pass was used because this assignment exposes no sub-agent dispatch tool.
- Standards seed: TypeScript type narrowing, async ownership and immutable-input guides; universal quality guide; only Duplicate Code and Long Method smell references. Checked ranking error boundaries, late/disposed events, Loader ownership, reused native evaluator/rubric, unchanged shared callers, renderer/projection separation and input immutability. Required complexity gate reports no new violations.
- **Cross-axis ranking:** none; findings are not merged or reranked.

## Fresh Verification and Limits

```text
npx vitest run extensions/buck-loop/activity-view.test.ts extensions/buck-loop/activity-snapshot.test.ts extensions/buck-loop/choice-ranking.test.ts extensions/buck-loop/index.test.ts extensions/buck-loop/__tests__/wire.test.ts extensions/buck-loop/__tests__/run-step.test.ts extensions/buck-loop/__tests__/loop.test.ts
7 files passed; 145 passed, 3 skipped; exit 0

npm run guardrails:check
status pass; durable v2; exit 0

Disposable production TUI/card + real native Jev smoke
PRODUCTION_CARD_SMOKE_PASS; exit 0
28 samples over 2240 ms; ten distinct spinner glyphs
44/80/110 width checks; runtime profiles; changing/nullable/unavailable context
No repaint request during 500 ms after disposal, including late context/text events
```

Fresh smoke uses production code, a real Pi TUI/ProcessTerminal/Loader, real machine projection and real TypeSafe native scores. Machine/session usage inputs are supplied smoke data, not a newly executed child phase. PTY allocation is unavailable in this assignment: the terminal-size `stty` attempt did not execute the driver; the successful run used the production terminal writer plus direct width-controlled component rendering. It is not a fresh interactive OMP capture. Prior actual OMP loop/profile/abort evidence and native-child provenance remain explicitly linked above. Two driver-only failures were corrected before the successful run: an invalid review-fact fixture and an assertion that ignored wrapping of the previous row at 44 columns. No production repair was made or implied. The temporary driver was removed.

### Guardrails Verdict

- Contract: **durable**, version **2**, status **pass**.
- `unit_test_gate=pass`; `functional_test_gate=skipped`; `lint_gate=skipped`; `patch_gate=advisory`; `global_ratchet=pass`; `complexity_gate=pass`.
- Coverage **88.2%** versus **84%** baseline. Patch coverage **null/unmeasured**, advisory; no patch percentage claim.
- **30** existing complexity hotspots; no new or hard-ceiling violations.
- Functional/lint disabled by the existing contract; no enforcement/baseline changes. Runner-proposed ratchet updates were not applied.

## Verification Status / User Goal Analysis

- Goal achieved: yes within the plan's stated display scope. Current state, work usage, model/visit history, legal continuations and child occupancy have direct evidence.
- User goal met: protected current tokens/spinner and profile-specific occupancy at narrow widths; unknown facts stay unknown. Live work tokens intentionally update only on authoritative completed assistant usage, not invented token streaming.
- Partial/missing deliverables: none established. Fresh host-interactive/native-child reruns are not claimed; their already recorded concrete evidence is distinguished from fresh component/test evidence.
- Scope adhered: yes for the reviewed card integration. No dependency/full-screen framework change; no new compaction policy or chooser-selection rule. Unrelated existing machine/gallery/backlog changes are excluded.

## Documentation Impact

**Flagged, non-blocking:** `docs/oh-my-pi.md:52-67` still says buck-loop uses the shared footer/six-row viewport and requires every long-running command to use that renderer. Current buck-loop owns a component card/Loader instead. `docs/buck-loop.md` and the density how-to already describe the new behavior correctly. Sync the host-wide convention with `/b-docs`; this documentation drift is not an implementation iteration issue and does not change the verdict.

## How-to Impact

No uncovered user-facing action. Runtime density changes are covered by `docs/howto/change-buck-loop-density.md`; context occupancy adds a readout, not an operator procedure. No independent `/b-howto` recommendation.

## Issue Classification

- In-plan implementation defects: **none**; no new `iterate-*.md`.
- Out-of-plan scope discoveries: **none established**.
- Warnings: accepted ledger omits explicit assumption status/blocking flags; native host evidence is reused rather than represented as fresh; PTY unavailable; disabled/advisory gates reported as such.
- Documentation impact is its separate non-blocking route above.

## Completion Audit

1. Objective restated from the exact plan, including its accepted context addendum.
2. Every implementation step and acceptance deliverable mapped to source, test or concrete runtime output.
3. Current implementation inspected; focused suites and deterministic durable contract executed fresh. Status fields and prior pass labels not used as proof.
4. Production card/Loader/native ranking exercised fresh; prior actual OMP and native-child evidence explicitly identified, with fresh visual limits stated.
5. No invented occupancy, native scores, patch coverage, save success or live-host observation. Unknown window cannot be fabricated when the entire usage object is absent.
6. Both review axes and all assigned review outputs completed. No supervisor state or lifecycle transition selected.

## Recommended Next Step

Documentation synchronization via `/b-docs` before `/b-save`, then `/b-commit` under supervisor control. This is a recommendation only, not a chosen loop state. Shared memory has not been saved by this review; historical Markdown memory was not altered.

## Assignment Files

Only this new review report is staged by this assignment. No pre-existing source, docs, gallery, iteration, plan, lifecycle, workflow, backlog, or unrelated changes were staged or modified. No commit created.
