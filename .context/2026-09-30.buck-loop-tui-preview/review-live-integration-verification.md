---
status: completed
date: 2026-10-02
subject: 2026-09-30.buck-loop-tui-preview
addresses: iterate-stacked-cards-live-integration.md
plan: plan-stacked-cards-live-integration.md
verdict: pass
---

# Live stacked-card iteration verification

All three in-plan findings are addressed: the production renderer/projection/native ranking exist; `/buck-loop` owns the live Loader/card and runtime profiles; focused, real-host and deterministic-contract verification pass. This is a sequential current-state review, not an independent-agent review. No machine table or chooser policy was changed by this assignment.

## Production changes

- `extensions/buck-loop/activity-view.ts`: pure width-aware heavy-box renderer; compact/standard/verbose field budgets; protected exact token/spinner row; advisory legal continuations, prior models/cost and verbose ledger.
- `extensions/buck-loop/activity-snapshot.ts`: real `legalChoices()`/`next()` projection and completed-assistant usage accounting, including cached input. Missing usage stays unknown. Runtime usage does not change persisted machine facts.
- `extensions/buck-loop/choice-ranking.ts`: one native score batch for multi-choice sets, using the existing continuation rubric. Fractional 0–4 scores sort a copy. Failure exposes the full unranked legal set; no chat fallback or selection.
- `extensions/buck-loop/activity-widget.ts`: real host Loader registration, animation, late-event guards and idempotent host/command teardown; selected models, actual nested skill and visit costs; activity coalescing.
- `extensions/buck-loop/index.ts`: replace only this command's six-row surface; `--profile compact|standard|verbose` switches the active card without restarting work; status/stop reuse ownership; logging failure cannot bypass widget disposal.
- `extensions/buck-loop/loop.ts` and `run-step.ts`: optional snapshot/decision/raw-session observers. Snapshot publication also covers chooser-selected inline work, before its model events arrive. Existing selection and work effects remain authoritative.
- `extensions/buck-loop/choice.ts`: export the existing rubric; no chooser algorithm changes.
- Tests: `activity-view.test.ts`, `activity-snapshot.test.ts`, `choice-ranking.test.ts`, `index.test.ts`, and updated `__tests__/wire.test.ts`.
- Documentation: `docs/buck-loop.md`, `docs/howto/change-buck-loop-density.md`, `docs/howto/README.md`, `docs/ideas.md`, and the existing activity convention in root `AGENTS.md`.

## Acceptance evidence

| Criterion | Current evidence |
|---|---|
| Pure renderer, all profiles, 44/80/110 columns | Nine profile/width cases; deterministic repeat output and display-width bounds. Renderer has no machine imports, I/O or timers. |
| Exact compact tokens/spinner; closed CURRENT box | Focused boundary assertions and actual 44-column OMP surface with `18764 tokens` and a live glyph inside the closed box. |
| Deterministic plain next versus full advisory legal set | Real-machine projection cases; actual native review decision rendered all three legal kinds, most-likely first. |
| No legal-set mutation or automatic selection | Frozen-input ranking tests. A separate real native run displayed iterate first but the unchanged chooser accepted document. |
| Previous model and cost | Actual `/buck-loop` showed building with `openai-codex/gpt-6-luna` and 167765 reported tokens. The final native handoff archived reviewing with `openai-codex/gpt-6.1-sol` and 236906 tokens. |
| Live usage, no invented totals | Actual current reviewing usage advanced from unknown to 18764 and then 131173 tokens. Partial events do not count; malformed/nonfinite usage is rejected; cached input is included. |
| Live spinner | Actual `/buck-loop` CURRENT row showed `⠹` then `⠇` across two seconds. |
| Runtime profile changes | Actual active `/buck-loop --profile compact`, `verbose`, and `standard`; the same reviewing work continued. Compact was also observed at 44 columns. |
| Teardown after abort/finish | Actual `/buck-loop --stop` cleared the card; two captures two seconds apart remained clear. Final real-loop completion also cleared it. Fake-timer tests prove no further timer repaint or late-event repaint after command or host disposal. In-flight work cancellation is not claimed. |
| Verbose old-field parity | Normalized text, phase label, tool name/target, success/failure plus message, retry message, and completion plus message are retained. Actual verbose OMP output showed tool targets/results, full activity and visit I/O splits. |
| Policy unchanged | Assignment did not edit `machine.ts`; its pre-existing user changes are excluded from staging. `choice.ts` only exports its existing rubric. Display ranking has no selected-action result. |
| Tests and contract | Focused seven suites: 140 passed, 3 skipped. Durable guardrails v2: pass; required unit, coverage ratchet and complexity gates pass. |

## Real native decision and corrected handoff

An isolated checkout ran the real `handleLoop`, native `runStep` build/review sessions, production card and original native chooser under OMP 18.4.10. The smoke driver deliberately corrupted the newly written review artifact after the real reviewer returned, making the genuine on-disk review boundary unparseable; machine scanning and legal-choice computation were not mocked. This exercised the actual ambiguous-review path rather than gallery ranks.

The final recorded terminal frames contained:

```text
NEXT · ranked, not pre-selected
  → save · 1.36/4
  → iterate · 0.93/4
  → document · 0.39/4
Jev display ranking: 176ms
CURRENT saving · b-save
PREVIOUS reviewing · openai-codex/gpt-6.1-sol · 236906 tokens
```

The unchanged chooser accepted save (confidence 0.59); the real loop returned `state: done`, reason `unphased plan completed its single cycle`. Terminal extraction asserted the corrected saving-state frame, native ranking label and duration. The fixture's native sessions, commits and malformed reports were confined to temporary checkouts. SQL was disabled in those throwaway hosts; no production-project lifecycle or shared-store state was used as smoke data.

Three defects were caught before closeout:

1. Native Jev scores are fractional expectations, not integers. The real SDK returned 2.98/2.34; integer-only acceptance was replaced with finite 0–4 acceptance and a fractional-score regression.
2. The original usage `Value.Check` boundary failed with `Unknown type` in the real OMP host. Plain record/number narrowing replaced that cross-host schema-validator boundary. Real nested builds then completed, wrote the exact marker, and emitted actual usage.
3. Chooser-selected work bypassed the drive loop's snapshot hook: CURRENT remained reviewing and charged documentation usage to the review visit. A permanent real-machine/card regression failed before the fix (`CURRENT reviewing · b-docs`, 41 tokens) and passed afterward (`CURRENT documenting`, previous review 30 tokens, current 11). The final native terminal run separately proved CURRENT saving after selection.

## Deterministic verification

```text
npx vitest run extensions/buck-loop/activity-view.test.ts extensions/buck-loop/activity-snapshot.test.ts extensions/buck-loop/choice-ranking.test.ts extensions/buck-loop/index.test.ts extensions/buck-loop/__tests__/wire.test.ts extensions/buck-loop/__tests__/run-step.test.ts extensions/buck-loop/__tests__/loop.test.ts
# 7 files passed; 140 passed, 3 skipped
npm run guardrails:check
# status pass; durable v2; coverage 88.2 versus baseline 84;
# 30 existing complexity hotspots; no new/hard-ceiling violations
```

Vitest is the repository's existing test convention; the source plan's `bun test` example is not used as a passing-run claim. Functional and lint gates are disabled/skipped by the existing contract. Patch coverage is null/advisory, not claimed as measured. No baseline rewrite or enforcement change was applied.

## Review and ownership

Spec-axis result: pass against the named renderer, native ranking, real state/usage, runtime controls, live animation/narrow/teardown, field-parity and policy exclusions. Standards-axis result: pass in the available sequential fallback using the TypeScript/universal-quality guides and scoped Duplicate Code/Long Method references. No unresolved in-plan finding remains. Native/schema response boundaries narrow unknown values; lifecycle ownership is explicit; renderer/ranker/adapter responsibilities stay separate without new dependencies.

The source plan, gallery files, subject lifecycle index, unrelated workflow/session pointers, pre-existing machine edits, and concurrently changed backlog/other-subject artifacts remain untouched. The previously staged iterate artifact receives only this assignment's completion metadata and resolution link. The distinct commit draft is `draft-commit-live-integration.md`; the earlier gallery draft is preserved. No supervisor transition is selected by this report.

## SQL save authorization

The implementation/verification record is durable in this subject folder. A reusable-memory save was attempted with `sql_memory` `op: remember` and denied: `remember is not available in the recall role; use the recall protocol`. `SQL_MEMORY_URL` is configured, but this session has no save-authorized SQL role. No row ID, connectivity probe, SQL receipt or successful `/b-save` is claimed; the recall-only denial cannot be bypassed with raw SQL or a historical Markdown memory write. This authorization limitation is separate from the passing code/visual verification and does not select the supervisor's next state.
