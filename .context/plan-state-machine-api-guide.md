---
status: completed
date: 2026-09-30
subject: 2026-09-30.state-machine-api-guide
research: []
memory: [state-machine-api-guide-2026-09-30.md]
---

# State-machine guide API explanation

## User Goal

Extend `site/guides/state-machine.html` so a junior engineer can define a state and understand every machine/state/rule property, public operation, returned decision, and failure without inferring the API from the complete recipe.

## Scope

- Keep the existing eight-step runnable recipe and all four file samples.
- Add API navigation, property tables, callback signatures, exact result objects, evaluation order, and failure-code explanations within the existing guide.
- No evaluator, dependency, package-script, or other living-document changes.

## Structure

1. Step 3: five generic types; machine properties; flat state structure and optional properties; rule fields; exact callback arguments and choice/event identity.
2. Step 4: `defineMachine` and the three compiled operations; caller-owned initial/current state; one-step evaluation; result discriminants and every returned field.
3. Step 6: every `MachineFailureCode`; operation-specific terminal failures; contextual details; callback exceptions.
4. Add direct API anchors to desktop/mobile navigation while preserving the existing design.

## Source constraints

- Use the current evaluator implementation as authority, not contradictory legacy JSDoc or Markdown examples.
- Targets are fixed state values, not callbacks. Choice guards receive facts only; event guards and outputs receive the incoming event. Choice output receives an isolated declared choice, not arbitrary caller payload.
- State properties are optional; a terminal state overrides outgoing rules. Event rules are evaluated only by `send`; `advance` and `choose` check automatic/choice ambiguity.
- Missing-state and target checks happen when accessed/selected; construction is not full graph validation. Clone unsupported choices fail at construction. Definition immutability is a caller discipline, not runtime freezing.

## Acceptance and verification

- [x] Machine, state, and rule properties are explained with requiredness and callback signatures.
- [x] Definition steps, methods, all decision fields, failure codes, and boundaries are explained.
- [x] Exact recipe samples and displayed result objects execute/match the current SDK.
- [x] Desktop/mobile API navigation, readable tables, copy controls, and browser errors checked.
- [x] Required deterministic quality checks pass; disabled/advisory gates recorded.

## Evidence

- Exact HTML-extracted recipe files strictly type-check and run; stdout and publication match the guide. All seven shell blocks pass syntax checking. Both displayed decision JSON objects match actual evaluator results.
- Temporary consumer smoke exercises all thirteen documented MachineFailure codes, canonical choice payloads, incoming event payloads, current legality checks, target validation before output, stateless facts, and unwrapped callback exceptions. All pass.
- Browser: six desktop API links and mobile state/failure links work; keyboard JSON copy matches; no page errors. Desktop width 1440px and mobile width 390px remain within their viewports. Wide API tables scroll locally without splitting property identifiers.
- With JavaScript disabled, eight recipe steps, six API sections, and four file samples remain present; copy controls stay hidden. Browser tabs closed; temporary verification files removed.
- Final post-layout npm run guardrails:check: durable v2 pass. Required unit-test, coverage-ratchet, and complexity gates pass; advisory patch coverage passes; lint/functional disabled and skipped. No baselines changed.
- SDK, package scripts, other docs, and unrelated backlog unchanged. SQL memory is not callable; portable file context records this ad-hoc work.
