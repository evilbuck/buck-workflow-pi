---
status: active
date: 2026-09-21
updated: 2026-09-23
subject: 2026-09-21.jev-decision-opportunities
topics: [jev, typesafe, buck-loop, b-review, typed-output, recovery]
research:
  - research-jev-decision-opportunities.md
  - ../2026-09-22.buck-loop-block-warning-diagnosis/research-buck-loop-block-warning.md
iterations: [iterate-jev-decision-opportunities.md]
spec: null
memory: [typed-workflow-output-hardening-plan-2026-09-22.md, typed-output-contract-phase-1-build-2026-09-22.md, typed-output-iteration-2026-09-22.md, fix-pr-48-review-repairs-2026-09-23.md]
phases_overview: plan-jev-buck-loop-chooser-phases.md
---

# Plan: Typed workflow outputs and fix-or-continue recovery

## User Goal

Operators can trust Buck Workflow automation to produce complete control decisions, repair malformed agent output without dead-ending, and continue safely when repair is unnecessary.

## Goal

Harden every model-authored binary or closed-set output produced by the core Buck workflow when it routes work or makes a closed-set recommendation. Each output gets a deterministic schema check and a TypeSafe semantic verification call before code or a user acts on it. Start with the failing `b-review` → `/buck-loop` path: make the complete review routing contract mandatory, replace prose-heading routing with typed facts, and constrain recoverable ambiguity to `fix | continue`—never a model-selectable `block`.

## Problem and evidence

- `skills/b-review/SKILL.md` already requires Documentation Impact, How-to Impact, Issue Classification, Verdict, and Recommended Next Step, but the requirement is prose-only. A passing report omitted How-to Impact and still escaped the review session.
- `extensions/buck-loop/scan.ts::parseReviewImpact` requires both impact sections but extracts only prose. Missing How-to Impact therefore becomes `parseable: false`; `None. Stale ...` can also be misread as positive documentation impact.
- `extensions/buck-loop/machine.ts` sends an unparseable review to a closed-set fallback that currently includes `block`. `extensions/buck-loop/choice.ts` asks a tool-less model to emit JSON and accepts any legal label, so an otherwise passing run can stop without the model seeing the report evidence.
- The generic `jev` tool already exists at `extensions/jev-tool/index.ts` and wraps `@typesafe-ai/sdk` `systemOne`. Its client/evaluator seam is currently embedded in the tool adapter, so runtime consumers would otherwise duplicate it.
- Diagnosis: `.context/2026-09-22.buck-loop-block-warning-diagnosis/research-buck-loop-block-warning.md`.
- Baseline: HEAD `07a48a8`. The working tree contains in-progress Jev Phase 2 and buck-loop changes owned by another loop; implementation must begin only after that work is committed or deliberately reconciled.

## Decisions

### 1. Deterministic shape, TypeSafe meaning

Ordinary code validates presence, schema version, boolean types, enum membership, and cross-field invariants. TypeSafe verifies whether each declared binary/enum value agrees with the report and evidence. TypeSafe does not replace JSON/schema validation.

### 2. Required review control block

Every `b-review` report must end with one fenced JSON object:

```json
{
  "schema": "buck.review/v1",
  "verdict": "pass",
  "documentation_impact": true,
  "how_to_impact": false,
  "has_in_plan_issues": false,
  "has_out_of_plan_issues": true
}
```

The human-readable sections remain required. The control block is the routing source of truth. Code derives the next route from these facts; the model does not author a second `route` field.

Cross-field invariants:

- `needs_work` iff `has_in_plan_issues` is true.
- `pass` requires both issue booleans false.
- `pass_with_warnings` requires no in-plan issues and at least one out-of-plan issue or non-blocking impact/follow-up.
- Documentation and how-to impact never change the correctness verdict.

### 3. End-of-step semantic verification

After deterministic validation, submit the report plus its declared control block to one batched TypeSafe call:

- Choice: which verdict is supported?
- Noul: is there documentation impact?
- Noul: is there how-to impact?
- Noul: are there in-plan issues?
- Noul: are there out-of-plan issues?

The verifier returns typed answers, probabilities, confidence where available, comparison results, and an audit status. Thresholds are named policy constants and must be calibrated with the fixture corpus; they are not silently copied from an unrelated decision.

### 4. Recoverable choices are exactly fix or continue

Missing fields, malformed control JSON, verifier disagreement, or low confidence enter a bounded recovery step. The recovery model receives the full artifact, deterministic diagnostics, and TypeSafe discrepancies. Its only legal output is:

- `fix`: regenerate or edit the current artifact, then validate and verify again.
- `continue`: return a complete replacement typed decision from the supplied evidence, then validate and verify it before routing.

The `fix | continue` output is itself model-authored closed-set data, so TypeSafe Choice verifies it before use. Disagreement or unavailable verification selects conservative `fix` while the repair budget remains; after the budget is exhausted, code may continue only with a schema-valid typed decision and a durable `semantic_verification: unavailable|disagreed` audit.

### 5. Safety blocks remain terminal guards

`block` is removed from every **recoverable model-choice set**. It remains a deterministic terminal state for protected branches, corrupt persisted state, exhausted global/iterate ceilings, repeated session/protocol failure with no schema-valid output, and other hard safety invariants. Removing those guards would turn malformed output into silent unsafe advancement or an infinite loop.

### 6. One evaluator, two adapters

Extract the shared TypeSafe request/evaluation code from `extensions/jev-tool/index.ts`. The registered `jev` tool remains the agent-facing adapter. The `/buck-loop` supervisor calls the same evaluator directly because nested `createAgentSession` tool availability is not a stable runtime interface. No duplicate SDK wrappers.

## Scope

1. Define reusable typed-output contracts, deterministic validators, semantic-verification results, and durable audit records.
2. Refactor the generic `jev` tool onto the shared evaluator without changing its public tool schema.
3. Harden `b-review` so all human sections and the `buck.review/v1` block are mandatory; require an end-of-step `jev` verification when the capability is available.
4. Teach buck-loop scanning to consume the typed review block and derive routing from validated facts.
5. Add a bounded recovery session whose legal decision is only `fix | continue`; remove `block` from recoverable choice sets.
6. Verify the recovery choice through TypeSafe before acting and persist validation/verification diagnostics.
7. Inventory model-authored binary/enum outputs in the core Buck pipeline and migrate each routed action or closed-set recommendation to the same deterministic-plus-TypeSafe protocol. Candidates include b-phase difficulty, the b-plan `omp_execution` recommendation, Light Grill run/skip, b-grill boundary assessment, and b-triage category/state recommendations. Preserve required user confirmation for advisory or consequential choices.
8. Update living workflow/extension documentation and record any architecture decision identified by review.

## Out of scope

- Free-form prose, summaries, code generation, and values that do not control workflow behavior.
- Deterministic fields authored by code, such as lifecycle status, counters, dependency arrays, and guardrail verdict JSON.
- Removing the buck-loop `blocked` state or weakening protected-branch, corruption, retry, iterate, or loop ceilings.
- Treating TypeSafe as a JSON/schema validator.
- Adding a second TypeSafe dependency or wrapping TypeSafe through `runOmpModelSession`.
- Migrating unrelated review systems such as `code-review-iteration` unless the inventory proves they feed the same Buck control path.

## Affected surfaces

- `extensions/jev-tool/index.ts` and its tests
- New shared typed-output evaluator/contract module under `extensions/`
- `extensions/buck-loop/{types,machine,scan,loop,run-step,choice}.ts` as required by the phased cutover
- `extensions/buck-loop/__tests__/{scan,machine,choice,loop}.test.ts` and recovery-focused tests
- `skills/b-review/SKILL.md`
- Shared portable typed-output verification instructions under `skills/_shared/`
- Core skill consumers identified by the inventory, initially `skills/b-phase/SKILL.md`, `skills/b-plan/SKILL.md`, `skills/b-grill*/SKILL.md`, and `skills/b-triage/SKILL.md`
- `docs/buck-workflow.md`, `docs/extension-loading.md`, and ADR/conventions only when b-review confirms impact

## Implementation steps

1. **Freeze the contract.** Define versioned TypeScript types for `buck.review/v1`, validator diagnostics, semantic verification, and `fix | continue`. Document field meanings and cross-field invariants once.
2. **Share the evaluator.** Move SDK request execution, injectable client creation, error normalization, and question validation behind one internal evaluator. Keep `jevTool()` as a thin adapter over it.
3. **Build a fixture corpus.** Include clean pass, pass with out-of-plan warning, needs-work, docs-only impact, how-to-only impact, missing section, malformed JSON, contradictory verdict, and the two recorded block-warning reports.
4. **Calibrate policy.** Run the fixture corpus through mocked deterministic TypeSafe results in CI and an optional live calibration script outside CI. Name thresholds; record why disagreement, low confidence, and provider failure map to repair/audit outcomes.
5. **Harden b-review.** Make every required human section and the final typed block completion criteria. In Jev-capable environments, the review agent must call `jev` after drafting the block and correct mismatches before returning.
6. **Parse typed review facts.** Replace prose-heading booleans as the buck-loop routing authority. Preserve human sections for readers; compatibility parsing, if temporarily needed, must emit an explicit migration diagnostic and cannot silently claim verified status.
7. **Derive routes in code.** Map validated review facts deterministically to iterate, docs/how-to, fresh-plan follow-up, or save. Do not ask a model to choose among these when the facts already determine the route.
8. **Add recovery.** For genuinely incomplete/contradictory control output, run one evidence-rich repair session. Validate its replacement object, TypeSafe-verify its `fix | continue` choice, and rescan. Keep the retry budget explicit and resumable.
9. **Remove recoverable block choices.** Update machine choice sets and choice types so model-authored recovery can never select `block`. Keep deterministic hard-stop transitions disjoint and unchanged.
10. **Persist audits.** Record source artifact, schema diagnostics, TypeSafe questions/answers, declared-versus-verified comparison, selected recovery action, attempt number, and final route. Never record secrets.
11. **Migrate core closed-set outputs.** Complete the inventory and adapt every model-authored binary/enum value that routes core Buck work or presents a closed-set recommendation. Reuse the shared protocol; deterministic outputs are explicitly excluded.
12. **Document and prove.** Update living docs, run the incident reproductions, exercise the actual `/buck-loop` review path, and run the durable guardrails contract.

## Acceptance criteria

- [ ] A `b-review` result cannot be accepted without all required human sections and a schema-valid `buck.review/v1` block.
- [ ] Review routing uses validated typed facts, not heading shape or substring heuristics.
- [ ] `None. Stale ...` does not become positive documentation impact.
- [ ] The two recorded malformed-but-passing review incidents enter repair and reach the correct route; neither exposes `block` as a legal model choice.
- [ ] Every recoverable model choice exposed by buck-loop is exactly `fix | continue`.
- [ ] Every model-authored binary/enum value that routes core Buck work or presents a closed-set recommendation has deterministic validation followed by a TypeSafe verification call or an explicit, durable unavailable-verification outcome.
- [ ] TypeSafe disagreement cannot silently advance; it repairs first and records any eventual schema-valid continue.
- [ ] Protected-branch, corrupt-state, loop-ceiling, iterate-ceiling, and repeated protocol-failure guards still block deterministically without consulting a model.
- [ ] The `jev` tool and buck-loop use one shared evaluator; no duplicate SDK call path exists.
- [ ] Focused tests make no live network calls; an optional live smoke proves the actual provider path.
- [ ] The core closed-set inventory has no unexplained model-authored control output left unverified.

## Verification

- Contract/unit: focused tests for the shared evaluator and `jev` adapter.
- Review fixtures: deterministic schema and invariant tests over the fixture corpus.
- Incident regressions: `scan.test.ts` and public `handleLoop` tests for missing How-to Impact and `None. Stale ...`.
- Recovery: tests for fix, continue, verifier agreement, verifier disagreement, provider unavailable, exhausted repair budget, and hard guards that remain blocked.
- Migration: inventory assertion or table-driven test showing every core model-authored closed-set field and its verifier.
- Smoke: run `/buck-loop` on a disposable non-protected branch through build → review → save with one deliberately malformed review, then inspect the durable audit and final state.
- Full contract: `npm run guardrails:check` after each coherent code phase.

## Execution instructions

This plan exceeds one session and crosses skills, shared runtime, state-machine routing, and live verification. Execute the phase overview in dependency order with `orchestrate`; each phase uses `/b-build-hard`, `/b-review`, any required `/b-iterate`, conditional `/b-docs`/`/b-howto`, `/b-save`, then `/b-commit`.

Implementation precondition: finish or reconcile the active `.context/2026-09-21.jev-tool` work first. Its current uncommitted Phase 2 changes overlap `extensions/index.ts`, `extensions/omp-models.ts`, and buck-loop tests; do not build this plan on an uncommitted moving baseline.

## Risks

- **Verifier availability:** provider/key failure cannot satisfy semantic verification. The recovery policy records it and chooses conservative repair before any schema-valid continue; it never pretends verification passed.
- **Circular verification:** asking TypeSafe to repeat the same prompt adds no value. Questions must compare a declared value against the full artifact/evidence, and fixtures must demonstrate disagreement cases.
- **Livelock:** repeated repair can cycle. Persist attempts, cap recovery, and keep existing deterministic safety ceilings.
- **Two sources of truth:** human prose and JSON can disagree. Deterministic invariants plus TypeSafe comparison detect this; routing uses only the validated block.
- **Overreach:** not every boolean deserves AI. The inventory excludes code-authored facts and only covers model-authored values that drive automation.
- **Concurrent work:** current Jev Phase 2 edits overlap this plan. Rebase/reconcile after they are committed rather than overwriting them.

## Revision Log

### 2026-09-22 — broaden to typed workflow contracts and recovery
- Added: mandatory `buck.review/v1` control block, end-of-step TypeSafe verification, shared evaluator, fixture calibration, `fix | continue` recovery, core closed-set inventory, phased execution, and explicit safety boundary.
- Modified: Path B chooser-only goal into an end-to-end b-review/buck-loop control-output contract; TypeSafe now verifies model-authored outputs instead of replacing deterministic validation.
- Removed: selectable `block` for recoverable gaps; missing key/low confidence as immediate blocks; b-review, scan, machine, and run-step exclusions; the prohibition on evidence-rich LLM recovery.
- Inputs: user request on 2026-09-22, block-warning diagnosis, current source contracts, and live TypeSafe Choice/Noul/SDK guidance.

### 2026-09-21 — lock Path B scope after extra-efficiency check
- Added: out-of-scope rows for standards-axis skip and empty-digest scribe skip.
- Modified: verified TypeSafe skill locations and chooser-only scope.
- Removed: none.
- Inputs: session context, advisor note, and `/b-plan-update`.
