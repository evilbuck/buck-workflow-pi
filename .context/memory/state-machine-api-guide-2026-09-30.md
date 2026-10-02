---
date: 2026-09-30
domains: [docs, frontend, testing]
topics: [state-machine, state-definition, evaluator-api, failure-codes]
subject: 2026-09-30.state-machine-api-guide
artifacts: [plan-state-machine-api-guide.md]
related:
  - site/guides/state-machine.html
  - extensions/state-machine.ts
  - .context/2026-09-30.state-machine-api-guide/plan-state-machine-api-guide.md
priority: medium
status: completed
---

# State-machine guide: complete API explanation

## Outcome

Expanded `site/guides/state-machine.html` within its original eight-step recipe. Six desktop/mobile API anchors cover MachineDefinition, StateDefinition, rule properties/callbacks, compiled operations, returned decisions, and all thirteen MachineFailure codes. Original four runnable sample files and their expected outputs are preserved.

The guide now distinguishes a state name, its definition, and the caller's current state; explains all required outer/rule fields and optional state fields; gives five concrete steps for defining a new state; describes key matching, method evaluation order, one-step results, and caller-owned effects/state. Exact ChoiceDecision and TransitionDecision JSON examples are copyable.

## Verified SDK semantics

- Targets are fixed State values, not callbacks. Choice guards receive facts only; choice output receives an isolated declared option. Event guards/outputs receive the incoming event payload.
- States do not have an initial field; stateOf can read a field other than state. Omitted collections are empty; terminal states reject every operation with method-specific codes.
- choose rechecks legality and automatic/choice ambiguity without storing a prior offer. send evaluates event rules separately. Multiple distinct choices are valid; declaration order is not a tiebreaker.
- Target checks precede output callbacks. Construction snapshots choices but is not full graph validation. Readonly typing is not runtime freezing. Callback exceptions propagate unchanged.

## Verification

Extracted the exact four files, seven shell blocks, and two JSON results from the live guide. Strict TypeScript, runner stdout, safety-check stdout, publication contents, shell syntax, and JSON results all passed. A temporary consumer script exercised every documented failure code and the callback/payload/target/stateless boundaries listed above; all thirteen codes passed.

Browser evidence: all six desktop API anchors work; mobile state/failure anchors work; exact JSON clipboard copy works; no browser errors. Desktop stays 1440px wide and mobile stays 390px wide. API tables scroll locally at 620px instead of breaking property identifiers into fragments; verified end-to-end horizontal scroll (272px). Content and all six API sections remain available without JavaScript; copy controls stay hidden.

Final post-layout `npm run guardrails:check` returned durable v2 pass: required unit-test, global-ratchet, and complexity gates pass; advisory patch gate passes; lint/functional gates disabled/skipped. No baselines updated. Browser tabs closed and temporary verification workspace removed.

## Scope

No evaluator, dependency, or package-script changes in this request. No unrelated backlog entries were completed. SQL memory was not callable; this ad-hoc save uses portable file context. Current implementation was the API authority where older JSDoc or Markdown differed.
