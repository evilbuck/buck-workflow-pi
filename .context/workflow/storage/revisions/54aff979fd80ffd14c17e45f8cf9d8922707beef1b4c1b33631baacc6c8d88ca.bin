---
status: active
date: 2026-09-18
subject: 2026-09-18.buck-loop-extension
topics: [buck-loop, autonomous-loop, state-machine, omp-sdk, xstate-removal]
---

# Subject: buck-loop extension

Replace the deprecated XState `b-flow` supervisor with a new, observably invoked happy-path runner.

## Artifacts

| File | Type | Description |
|------|------|-------------|
| `plan-buck-loop-extension.md` | Plan | Bounded implementation plan |
| `plan-buck-loop-extension-phases.md` | Phase overview | Seven-session dependency map and execution checklist |
| `phase-1-transition-contract.md` | Phase | Pure transition types and legal-edge table |
| `phase-2-artifact-state.md` | Phase | Artifact scans, projection persistence, and resume reconciliation |
| `phase-3-closed-set-choice.md` | Phase | Tool-less legal-enum classifier and transition audits |
| `phase-4-nested-work-sessions.md` | Phase | Isolated long-running Buck skill sessions |
| `phase-5-loop-supervisor.md` | Phase | Bounded integrating supervisor |
| `phase-6-command-surface.md` | Phase | `/buck-loop` parsing and extension wiring |
| `phase-7-documentation-and-proof.md` | Phase | ADR, living docs, guardrails, and command smoke |
| `iterate-buck-loop-artifact-state.md` | Iterate | Phase 2 round 1 |
| `iterate-buck-loop-artifact-state-2.md` | Iterate | Phase 2 round 2 |
| `iterate-buck-loop-nested-work-sessions.md` | Iterate | Phase 4 tool allowlists + abort |
| `iterate-buck-loop-loop-supervisor.md` | Iterate | Phase 5 review artifacts + phase freeze |
| `iterate-buck-loop-loop-supervisor-2.md` | Iterate | Phase 5 review-zz naming |
| `iterate-buck-loop-live-feedback.md` | Iterate | Live activity, nested failure handoff, commit completion, and smoke proof |
| `iterate-buck-loop-streaming-output.md` | Iterate | Live nested assistant and tool output in a bounded viewport |
| `draft-commit.md` | Draft | Next `/b-commit` message |

## Related

- Historical XState machine: `extensions/b-flow/` (unwired)
- Deprecation: `.context/2026-06-01.deprecate-b-flow/`
- Advisory stamper (unchanged): `skills/b-loop/SKILL.md`
- Nested-session pattern: `extensions/code-review-iteration/`, `extensions/omp-models.ts`
- Follow-on picker plan: `.context/2026-09-19.buck-loop-subject-picker/`
