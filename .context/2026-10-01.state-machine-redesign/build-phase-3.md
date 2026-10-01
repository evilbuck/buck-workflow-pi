---
status: completed
date: 2026-10-01
subject: 2026-10-01.state-machine-redesign
phase: phase-3-port-review-machine.md
---

# Phase 3 build evidence

## Scope and decisions

Port reviewMachine to extensions/state_machine; integrate its production decide(facts) adapter into the review loop. Guards, effects, rule labels, terminal statuses and reasons remain unchanged. Manual cancellation is explicitly declared from each non-final state and excluded from automatic availability. All terminal states are final with no targets. The adapter restores caller-owned state, requires exactly one available target, and throws ReviewMachineError(NO_ROUTE | AMBIGUOUS_ROUTE) with structured state/availability context otherwise. Effects remain data interpreted by the existing supervisor.

Source inspection corrected the plan's rule-count typo: the legacy declaration has 13 automatic rule labels (3 initializing, 2 preparingBase, 2 reviewing, 3 triaging, 3 fixing), not 15. All 13 are covered; no production behavior was removed. No dependency or extra runtime abstraction was introduced. The old engine and living-doc migration remain Phase 4 scope.

## Test seams

Policy tests cross the real production decide(facts) interface with literal destinations, labels and complete outputs. Caller-owned fact fixtures require no model or filesystem. Public definition/instance methods verify final states and manual cancellation. Only the overlap test substitutes availability (the graph's real guards are exclusive); it exercises adapter rejection without substituting routing outputs. The failure-boundary test injects ReviewMachineError at decide and verifies the persisted terminal report. Unmodified loop.test.ts exercises the production supervisor with its existing dependency fakes.

## Verification

- Baseline: 164 tests pass across 14 review suites.
- RED: the new manual-cancellation graph test fails against the old engine (edge is not a function); the port passes it.
- All 13 legacy rule labels pinned by literal truth-table expectations, including full terminal outputs. Additional assertions cover report-only findings and fallback wording.
- Exclusivity sweep passes against ReviewMachineError; missing/terminal routes fail with NO_ROUTE; injected overlapping availability fails with AMBIGUOUS_ROUTE. Stable error formatting and report text verified.
- Final review suites: 168 tests pass across 14 files; machine suite has 25 tests.
- Read-only old/new differential sweep: 129,600 adapter calls, zero output/rejection mismatches. Includes all states, catalog status/errors, base readiness/errors, review results/errors, fixer outcomes, null check exit codes, pass ceilings and resumed-at-bound facts. Successful outputs compare exactly; exceptions compare rejection behavior since error types intentionally change. Temporary legacy source was removed. Log: /tmp/review-phase3-comparison.txt.
- git diff extensions/code-review-iteration/__tests__/loop.test.ts is empty; its 24 scenarios remain green.
- Focused strict TypeScript check passes for machine.ts and machine.test.ts.
- Whole-project TypeScript exits 2 before and after: identical 194 pre-existing diagnostics, byte-for-byte; no diagnostics in changed files. Logs: /tmp/review-phase3-tsc-before.txt and /tmp/review-phase3-tsc-after.txt. The parent clean-project TypeScript requirement remains unresolved.
- Final npm run guardrails:check: exit 0, durable v2 required gates pass; coverage 87.5% against baseline 84%, no new complexity violations. Lint and functional gates remain disabled by the existing contract; patch coverage is null. Proposed ratchet update not applied. Verdict: guardrails-phase-3.json.
- git diff --check passes.
- Verification used fresh processes in Codex outside buck-loop, without reload.

## Risk and next step

Routing drift could change review status or run the wrong effect. Literal outputs, the differential sweep and unchanged integration scenarios address that risk. Phase 3 remains separately revertible from Phase 2. SQL tools are unavailable, so build memory uses file mode. Existing SQL receipts are unchanged.

Run b-review against phase-3-port-review-machine.md, then b-save, then b-commit. Phase 4 follows: delete the old engine and update living docs/site. No commit or push performed.
