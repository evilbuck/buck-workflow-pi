---
date: 2026-09-20
domains: [architecture, extensions, testing]
topics: [state-machine, pure-evaluator, typed-failures, tdd, phase-1, review-iteration]
related:
  - .context/2026-09-19.reusable-state-machine/phase-1-generic-evaluator-contract.md
  - .context/2026-09-19.reusable-state-machine/plan-reusable-state-machine-phases.md
  - .context/2026-09-19.reusable-state-machine/iterate-reusable-state-machine.md
  - .context/2026-09-19.reusable-state-machine/review-zz-buck-loop-2026-09-20T14-26-28-430Z.md
  - extensions/state-machine.ts
  - extensions/state-machine.test.ts
priority: medium
status: completed
subject: 2026-09-19.reusable-state-machine
artifacts:
  - phase-1-generic-evaluator-contract.md
  - plan-reusable-state-machine-phases.md
  - iterate-reusable-state-machine.md
  - review-zz-buck-loop-2026-09-20T14-26-28-430Z.md
  - draft-commit.md
---

# Reusable state-machine Phase 1 build

Implemented a synchronous, domain-neutral evaluator in `extensions/state-machine.ts`. `defineMachine()` compiles state definitions to exactly three operational methods: `advance`, `choose`, and `send`. The core owns current-state lookup, enabled-rule evaluation, automatic/choice ambiguity detection, legal-choice derivation and revalidation, event dispatch, terminal-state handling, and target validation. `MachineFailure` carries a stable code and structured context; transition outputs remain opaque domain values.

The contract tests use a non-Buck publishing fixture and cover one/multiple/no automatic routes, derived choices, valid and stale/forged/disabled choices, overlap between automatic and choice routes, valid/unknown/disabled/terminal events, missing states, invalid targets, and opaque outputs. No `extensions/buck-loop/**` file changed.

## Decisions

- Choice and event identity are explicit consumer-provided `PropertyKey` selectors. This supports object-shaped closed choices without embedding Buck's `{ kind }` convention in the core.
- `choose()` re-evaluates automatic rules as well as choice guards. A newly enabled automatic route cannot be bypassed by a stale choice.
- External `send()` remains independent of automatic routes so operator-owned events can intentionally interrupt a state.
- Choice keys identify declarations; caller-supplied non-key fields are not trusted. After key matching, `choose()` passes a fresh clone of the compiled canonical choice snapshot to the output callback.
- `advance()` and `choose()` share one internal route evaluator so automatic ambiguity, legal-choice derivation, unique-key validation, and automatic/choice overlap cannot drift.
- Selected targets are validated before output callbacks execute.
- Choice declarations are snapshotted with structured cloning during `defineMachine()`. Enabled choices returned by `advance()` and canonical choices passed to output callbacks are fresh clones, so consumer mutation cannot alter the private snapshot or caller-owned definition. Choices that cannot be isolated fail definition with `UNSUPPORTED_CHOICE`; successful structured clones are traversed to reject direct or nested shared memory before they become canonical.

## Verification

- Initial RED: `npx vitest run extensions/state-machine.test.ts` failed because `state-machine.ts` did not exist.
- Review regression RED: a same-key choice with forged `authority: "admin"` reached output instead of the declared `"reviewer"`.
- Offered-choice isolation regression RED from review: `advance()` recursively froze and returned the caller's authoritative declaration, mutating caller-owned data while failing to isolate internal-slot objects.
- Focused verification: `npx vitest run extensions/state-machine.test.ts` — 15/15 passed.
- Shared-memory regression RED: a nested `Uint8Array` backed by `SharedArrayBuffer` was accepted as a declared choice instead of failing with `UNSUPPORTED_CHOICE`.
- Iteration unit gate: `npx vitest run` — 60 files, 987/987 tests passed.
- Iteration type check: `npx tsc --ignoreConfig --noEmit --strict --skipLibCheck --target es2022 --module nodenext --moduleResolution nodenext extensions/state-machine.ts extensions/state-machine.test.ts` passed.
- Durable closeout: `npm run guardrails:check` — `status: pass`, durable v2 contract; required unit, global-ratchet, and complexity gates passed; functional and lint gates skipped by contract; patch gate passed as advisory.
- Guardrails measured 81.8% coverage against the 79.4% baseline, with no new or hard-ceiling complexity violations.
- Source inspection found no imports in `extensions/state-machine.ts`; runtime operations remain `defineMachine` plus compiled `advance`, `choose`, and `send`.
- `git status --short` confirmed no `extensions/buck-loop/**` file changed.
- A whole-project `npx tsc --noEmit` remains noisy with existing unrelated test and Bun typing errors; the earlier phase-scoped strict type-check was clean.
- Repeat review passed with no findings; Phase 1 and its overview are completed.

## Files Modified

- `extensions/state-machine.ts`
- `extensions/state-machine.test.ts`
- `.context/2026-09-19.reusable-state-machine/phase-1-generic-evaluator-contract.md`
- `.context/2026-09-19.reusable-state-machine/plan-reusable-state-machine-phases.md`
- `.context/2026-09-19.reusable-state-machine/draft-commit.md`
- `.context/2026-09-19.reusable-state-machine/iterate-reusable-state-machine.md`
- `.context/memory/reusable-state-machine-phase-1-build-2026-09-20.md`
- `.context/memory/index.md`
- `.context/workflow/current-session.json`

## Next

Run `/b-commit` for the completed Phase 1 checkpoint. Phase 2 remains pending; the supervisor retains authority over whether to advance.
