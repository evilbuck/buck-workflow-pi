---
date: 2026-09-19
title: "Docs ideas Q7: is buck-loop idempotent?"
domains: [buck-loop, extensions]
topics: [idempotency, state-machine, persistence, retries]
related: [2026-09-19.buck-loop-stall-diagnosis]
informs: []
priority: medium
status: draft
---

# Is `/buck-loop` idempotent?

**Verdict: PARTIALLY IDEMPOTENT.** State machine and resume are idempotent under normal flow; persistence is not atomic; a mid-phase failure re-fires the same nested worker prompt against the same phase.

## Per-dimension

| Dimension | Verdict | Evidence |
|---|---|---|
| State machine / resume | IDEMPOTENT | `table.next()` pure (`table.ts:262-270`); `persist.resume()` artifacts-win reconciliation (`persist.ts:142-175`); counters monotonic, reset only on `phasePath` change (`persist.ts:164-165`) |
| Projection persistence | NOT atomic | `writeFileSync` no tmp+rename (`persist.ts:103-104`); corrupt JSON → `null` → idle (bookmark lost); per-tick writes amplify exposure (`loop.ts:198-216`) |
| Step re-execution on retry | NOT IDEMPOTENT | `nextRetries` re-sends identical `promptFor()` payload (`run-step.ts:118-123`, `loop.ts:486-489`); no pre-edit checkpoint; only `builtPhaseLanded()` (phase `status: completed`) and `git status` cleanliness detect prior success |
| Choice/scan steps | IDEMPOTENT | `scan.ts` pure disk re-derivation; choice audits append-only timestamped+UUID (`choice.ts:97-104`); projection `lastChoice` is last-write-wins |
| Bounded retries | IDEMPOTENT (bounded) | one retry per step (`table.ts:134-137`), iterate ceiling 3 (`table.ts:21-22`), `SAFETY_TICK_CEILING=64` (`loop.ts:49`); blocked runs resume via USER_CONFIRMED (`loop.ts:181-189`), never hand-edited projection |

## Bottom line

Riskiest spot: **run-step retry without a pre-edit checkpoint** — a build worker that partially lands (edits code, doesn't flip phase `status: completed`) gets the same skill prompt replayed, producing duplicate/conflicting edits.

Secondary: non-atomic projection write — crash mid-write loses the resume bookmark (falls back to idle, not corrupt).

Possible remediations: atomic write (tmp+rename) in `persist.ts`; pre-edit file hash snapshot in `executeSkill()` to detect partial landings; give the chooser minimal scan context to break the deterministic `block` loop (see stall-diagnosis research).
