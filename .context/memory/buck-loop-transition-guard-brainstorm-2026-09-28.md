---
date: 2026-09-28
domains: [buck-loop, state-machine, research]
topics: [transition-guard, jev, choices, buck-loop]
related: []
priority: medium
status: active
subject: 2026-09-28.buck-loop-transition-guard
artifacts: [research-transition-guard.md]
---

# Buck-loop transition guard brainstorm

Captured a planning-only brainstorm. No code changed.

**Finding:** a Jev decision before a transition already exists. `choices` pause the machine; `extensions/buck-loop/choice.ts` asks Jev to pick one legal label; `choose()` validates the route. Do not add a new rule kind to `extensions/state-machine.ts`.

**Gap:** confirmed builds route automatically (`building-confirmed-review`). Jev runs only on an ambiguous postcondition. `decisionContext()` has no build output; `Snapshot` has no last-session output fact.

**Recommendation, not locked:** guard = choice rules gated by a snapshot flag, criteria keyed by target state, deterministic session summary in the Jev state string.

Open: scope (build-only vs every work boundary), always vs ambiguous-only, action verbs vs state names, profile-model fallback vs Jev-only, how much build output Jev sees.
