---
status: active
date: 2026-09-10
subject: 2026-09-10.b-save-state-machine-analysis
topics: [b-save, command-contract, deprecated-b-save, flags, resume]
type: technical-spec
memory: [../memory/b-save-phase-1-boundaries-2026-09-10.md]
---

# Spec: `/b-save` command contract

Frozen for Phases 2–6. Later modules encode this document; they do not re-decide names, flags, resume, headless recovery, or the Hindsight effect outcome.

## User Goal

Buck Workflow users run the new deterministic checkpoint as `/b-save`, while the current prompt-driven workflow remains available as `/deprecated-b-save` for compatibility and fallback.

## Public surfaces

| Command | After Phase 6 cutover | Until parity |
|---|---|---|
| `/b-save` | Deterministic OMP state-machine engine (`extensions/b-save`) | Current prompt-driven skill/prompt/command. Engine code may land under `extensions/b-save` but **must not** register as `/b-save` until Phase 6. |
| `/deprecated-b-save` | Unchanged prompt-driven workflow (today's `/b-save` skill + prompt + command, renamed) | Does not exist yet. Created in the same cutover that promotes the engine. |
| `/b-save-improved` | **Removed.** Must not resolve. | Remains available. Removed only after the Phase 6 parity checklist passes. |

Cutover is atomic: one commit (or one tightly-coupled pair) such that a fresh session discovers exactly `/b-save` and `/deprecated-b-save`.

`/deprecated-b-save` keeps the current prompt contract, including mainline `retain`/`learn` handoff. It is the cross-harness fallback. The engine is OMP-first.

## Engine flags

Compatible with `/b-save-improved`, plus a resume selector. Unknown flags are errors; they are not ignored.

| Flag | Meaning |
|---|---|
| `--dry-run` | Compute the snapshot, proposals, and report. Write nothing: no run journal, no `.context/**` mutation, no memory effect. |
| `--subject <name>` | Skip subject resolution. Containment- and slug-validate the name. A missing folder is created (date prefix added when the name has none). `--subject=` form is accepted. |
| `--no-retain` | Skip the Step 8 native-memory effect (local / Mnemopi / Hindsight). Durable `.context` apply still runs unless `--dry-run`. |
| `--model <provider/id>` | Override the configured model for every engine role (scribe, evidence-auditor, goal-classifier). `--model=` form is accepted. Authoritative over inferred defaults. |
| `--archive-inferred` | Explicit inferred-completion policy override. See below. |
| `--run-id <id>` | Resume selector for a non-terminal run. `--run-id=` form is accepted. |

Free-form text that is not a flag is additional user context for the scribe, same as `/b-save-improved`.

### Inferred-completion policy

This is the explicit policy the plan required. It is not silent inference.

| Candidate | Default | `--archive-inferred` | Interactive approve |
|---|---|---|---|
| Cited **explicit** completion | Archive | Archive | n/a |
| **Inferred** completion | Stage only; report in the run | Archive | Archive |
| Explicit user-requested new/deferred item | Create | Create | n/a |
| **Inferred** new/deferred item | Stage only | Stage only (flag does **not** create it) | Create |

`--archive-inferred` never creates inferred new items and never chooses a subject.

## Resume selector

Non-terminal runs persist under:

```text
.context/workflow/b-save/<run-id>/
```

- `run-id` is a stable opaque id allocated at run start and printed on every engine invocation (including failures).
- `--run-id <id>` loads that directory. Unknown, terminal, or foreign (path-escaping) ids fail closed with the id and the recovery instruction to start a new run.
- Resume replays persisted user decisions and validated proposals. Cheap observations may be recomputed. Input-hash drift invalidates only dependent proposals.
- `--dry-run` does not create or update a run directory.
- Terminal outcomes (`completed`, `aborted`, `failed_model` after the user discards the run) are not resumed in place. Start a new run.

## Headless ambiguity

When `ctx.hasUI` is true, subject choice and inferred-backlog approval use OMP UI.

When `ctx.hasUI` is false (print/RPC/headless), the engine **must not guess**:

1. Persist the run in the matching waiting state (`awaiting_subject_choice` or `awaiting_policy`).
2. Print a recovery block that includes at least:

   ```text
   run_id: <id>
   state: <waiting-state>
   recovery: /b-save --run-id <id> --subject <folder>
   ```

   For inferred completions, `recovery` names `--archive-inferred` or an interactive re-run. For inferred new items, recovery says they stay staged until an interactive approve.
3. Return a failing command outcome. Do not pick the lexically newest subject, the `current-session.json` subject, or the first candidate.

`--subject` on a later `--run-id` invocation is the headless resolution for subject ambiguity. It does not imply `--archive-inferred`.

## Native-memory effect (Step 8)

Locked by `research/hindsight-guarded-retain-result.md` against `@oh-my-pi/pi-coding-agent@18.1.17` / `omp/18.1.17`:

| Backend | Adapter | Outcome when skipped/unavailable |
|---|---|---|
| `local` | `ctx.memory.status()/save()` | `skipped` if `--no-retain` or runtime missing; `failed_nonblocking` after one retry |
| `mnemopi` | `ctx.memory.status()/save()` | same |
| `hindsight` | **`unsupported`** | Always `unsupported` unless `--no-retain` (`skipped`). No raw `retain`, no OMP patch, no post-execution payload check, no Hindsight HTTP. |
| none / `off` | n/a | `skipped` |

A successful durable `.context` apply is never invalidated by an effect outcome.

## SDK dependency

The Phase 1 experiment inspected `@oh-my-pi/pi-coding-agent@18.1.17`, recorded as an **optional** peerDependency. Final packaging normalization (required vs optional, version range, dual-harness loading) is Phase 6. The legacy prompt path must not import this package.

## Non-goals (still frozen)

- No harness-neutral engine adapter in this implementation.
- No registration of the engine as `/b-save` before Phase 6 parity.
- No removal of `/b-save-improved` before Phase 6 parity.
- No guessing under headless ambiguity.
- No model-controlled Hindsight payload.
