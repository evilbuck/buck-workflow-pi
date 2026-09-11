---
status: completed
phase: 1
order: 1
plan: plan-b-pr-manager.md
phases_overview: plan-b-pr-manager-phases.md
difficulty: medium
model_hint: capable general model; exhaustive typing and pure transition coverage, no I/O
buck_hint: /b-build
goal: "Freeze CLI, state/event, feedback, role, merge-gate, and persistence schemas, plus a pure XState machine with no shell or model calls."
files:
  - extensions/b-pr-manager/types.ts
  - extensions/b-pr-manager/machine.ts
  - extensions/b-pr-manager/__tests__/machine.test.ts
  - extensions/b-pr-manager/__tests__/fixtures/gh-payloads.ts
from_plan_steps: [1]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] `types.ts` exports versioned unions for CLI options, machine states/events, feedback versions, verdicts, role results, merge-gate snapshots, and RunState"
  - "[x] Verdict taxonomy is exactly `valid | invalid | already_done | unsure | nit | out_of_scope` — same as `skills/fix-pr/SKILL.md`"
  - "[x] `machine.ts` is a pure XState v5 machine: no git, gh, fs, timers, or model imports"
  - "[x] Every state in the plan table has explicit success, block, and cancel handling"
  - "[x] Every declared event has a legal source state; illegal events do not transition"
  - "[x] Primary paths 1–6 from the plan have pure-machine tests with fake clocks for poll decay/reset/exhaustion"
  - "[x] Exact-head OID change invalidates review and verification attestations in guards"
  - "[x] Machine/guard functions stay under the repository cyclomatic ceiling; no new complexity hotspot"
  - "[x] Existing `/b-pr-improved` tests still pass; this phase adds no command registration"
completed_at: 2026-09-10
completed_by: b-build
---

# Phase 1: Freeze contracts and pure machine

## Context

Parent user goal: a developer can run one OMP command on an open pull request and have valid review feedback fixed, verified, rebased, pushed, and merged without babysitting.

This phase freezes the typed contract and a side-effect-free state graph so later phases cannot invent events, verdicts, or success claims. No GitHub, git, persistence I/O, or model sessions.

## Implementation Details

1. Create `extensions/b-pr-manager/` (no `index.ts` command yet).
2. In `types.ts`, define versioned schemas matching [plan-b-pr-manager.md](plan-b-pr-manager.md) § Command Contract, § Ownership Boundary, § State Machine, § Deterministic Merge Gate, and § Persistence and Recovery:
   - CLI flags: PR number/URL, `--resume`, `--base`, `--merge-method`, timing flags, `--model`.
   - States and events from the mermaid diagram plus cross-cutting `CANCEL` / typed `BLOCK`.
   - Feedback version: stable ID, node ID, author, URL, timestamps, resolution/outdated, path/line, original commit, content digest, fingerprint.
   - Verdicts: reuse fix-pr taxonomy; valid local nits are actionable.
   - Role result envelopes for validator / planner / builder / reviewer / conflict, each with schema version.
   - Merge-gate snapshot: head/base OIDs, draft, mergeability, required-check rollup, `reviewDecision`, auto-merge, GitHub `state`.
   - `RunState` fields listed in the plan persistence section.
3. Put representative `gh` REST/GraphQL payload fixtures in `__tests__/fixtures/gh-payloads.ts` (reviews, inline comments, conversation comments, resolved/outdated threads, edited comments, check rollups, mergeability, auto-merge, MERGED). Fixtures only — no live network.
4. Implement `machine.ts` as pure XState v5. Guards and reducers update context; they must not call shell, fs, or models. Invoked actors are typed placeholders (later phases provide implementations).
5. Encode ownership: context mutations from `[D]` events are deterministic; `[L]` payloads are accepted only as already-validated schema objects on `[H]` events.
6. Tests in `machine.test.ts`:
   - Every declared event has a legal source; every state has success/block/cancel.
   - Paths: no-feedback, valid-feedback, review-iterate, conflict loop (max 20), base-advanced, new-feedback-after-push, pending-check, hard-check-fail, auto-merge, merged, exhausted, paused, resume/reconcile.
   - Fake clock: default poll is one immediate observation plus seven delayed waits at 30s, 60s, 120s, 240s, 480s, 600s, 600s (35m30s delayed). Progress resets the index; no progress consumes budget.
   - Head OID change clears review/verification attestations.
7. Do not register the command. Do not edit `extensions/b-pr-improved/` or `extensions/index.ts`.

## Risks

- Machine grows into a complexity hotspot. Split guards/reducers; measure lizard against `guardrails.json` before yielding.
- Inventing a second verdict taxonomy. Copy fix-pr labels exactly.
- Treating model prose as an event. Events are typed unions only; role output must already match a schema.

## Verification

- `bun`/`vitest` on `extensions/b-pr-manager/__tests__/machine.test.ts`.
- Confirm `machine.ts` has no `child_process`, `gh`, `fs`, `createAgentSession`, or timer imports.
- Confirm existing `extensions/b-pr-improved/__tests__/wire.test.ts` still passes.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues go to a separate `/b-plan` → `/b-build`; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress`.

`omp_execution` is omitted (`none`). No first-turn keyword or `/goal set`.
