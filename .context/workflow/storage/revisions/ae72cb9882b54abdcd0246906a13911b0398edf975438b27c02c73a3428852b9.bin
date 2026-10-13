---
status: completed
date: 2026-10-02
subject: 2026-09-30.buck-loop-tui-preview
research: [research-choice-protocol-error.md]
spec: null
memory: []
sql_memory_ids: [01a0fc87-1e0f-7dfe-955a-4c99304bae02]
---

# Verified singleton chooser repair

## User goal

A singleton continuation returns the expected successful result without invoking a model. Handle zero, one, and multiple permitted choices explicitly; preserve existing typed contracts and audit safety.

## Scope

- `extensions/buck-loop/choice.ts`: after filtering operator-only `block`, reject an empty set as before; audit and return a singleton before resolving a model; use an honest `sole` audit source and emit the local reason through the existing activity sink. Multiple-choice routing remains unchanged.
- `extensions/buck-loop/__tests__/choice.test.ts`: replace the obsolete singleton-rejection expectation with a behavioral regression covering successful selection without any model dependency. Existing empty, operator-only, and multiple-choice cases remain in force.
- Existing changelog and diagnostic record updated after smoke proof.

The public boundary is `choose()` / `ChooseResult`. A singleton must not be attributed to `askJev()` when Jev was never called. Reuse the existing audit writer and failure handling; no new class or abstraction.

## Boundaries

Do not edit `machine.ts`, settings, SQL receipts, staging, commits, or loop state. The SQL-save verification and retry ceiling still govern whether retry is legal. This change returns only a machine-supplied legal action; it does not assert that saving succeeded.

## Verification and outcome

- The new singleton regression failed before the source change: the caller received `blocked` instead of the required accepted result.
- `npx vitest run extensions/buck-loop/__tests__/choice.test.ts`: 19 tests passed. Coverage includes no model resolution for a singleton, operator-only/empty sets, audit-write failure, and unchanged multiple-choice routing.
- Fresh Bun subprocess using real `choose()`, no model selector override or mocks: singleton `retry` returned `{ status: "accepted", accepted: { choice: { kind: "retry" }, reason: "Only legal continuation: retry" } }`; its audit had `source: "sole"`, and the activity sink received the reason. Empty and operator-only sets returned `blocked`. The disposable directory was removed.
- `npm run guardrails:check`: durable v2 contract passed. Unit, global ratchet, and complexity gates passed; coverage was 88.2% against an 84% baseline. Functional/lint gates were disabled; patch coverage was advisory and unavailable. No baseline changes were applied.
- LSP reported no diagnostics for `choice.ts`. The test helper's existing TS7053 diagnostic at line 70 is unchanged; this is not a claim of project-wide TypeScript cleanliness.
- Inline review: the public return contract is unchanged, the audit precedes acceptance, and downstream machine validation/retry limits remain authoritative. No new class or model dependency was added.

## Operator boundary

No live loop was resumed. Restart OMP before resuming to guarantee the changed imported extension is loaded. The independent SQL receipt subject mismatch and staging gates documented in [the diagnosis](research-choice-protocol-error.md) remain unresolved; this fix does not assert save success.

## Advisor follow-up: plan discovery and checkpoint scope

The completed repair record initially used a `plan-` prefix in the live assignment's subject. `listPlans()` filters by filename, not artifact status; `pickSolePlan()` therefore rejected the two plans. Renamed this record to `research-singleton-choice-return.md` rather than changing scanner behavior or moving the assignment's plan. Its sibling diagnostic reference remains valid; the diagnosis and repair draft references were updated.

Fresh real `scan()` smoke against the subject directory:

- Before rename: `planFacts.kind: "missing"`, reason `multiple plans in subject; pass an explicit plan path`. Passing the original plan explicitly still resolved it.
- After rename: resolved `plan-stacked-cards-live-integration.md`, `planFacts.kind: "unphased"`; facts matched the explicit original-plan scan. The original plan's 16 open acceptance lines remain open.
- The saved run's rescan uses its phase/plan path before the subject path; no workflow state or lifecycle metadata was modified.

The singleton fix owns `extensions/buck-loop/__tests__/choice.test.ts`, `docs/CHANGELOG.md`, and only its own hunks in the shared `extensions/buck-loop/choice.ts`. With no declared `files:`, these unstaged paths still hit the checkpoint refusal. Separate repair commit with hunk-level selection is the conservative choice; deliberate inclusion in the loop checkpoint also requires an operator decision. Nothing was staged or committed, and the unrelated machine change was preserved.

This follow-up changes Markdown artifact naming/references only; guardrails were not rerun. The chooser's earlier code verification remains recorded above, and the affected discovery behavior was exercised directly.
