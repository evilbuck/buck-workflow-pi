## Plan Path Review: Tail-able `/buck-loop` activity log

### Plan Source
- File: `.context/2026-09-24.buck-loop-streaming-log-drain/plan-buck-loop-streaming-log-drain.md`
- Goal: expose normalized loop activity as JSONL while the loop is running.
- Baseline: `HEAD` (`3ee1d26`) against the staged implementation, with current source inspected. The branch has no upstream; unrelated unstaged changes are present.

### Completion Matrix

| Plan step | Status | Evidence |
|---|---|---|
| 1–3. Record contract, lifecycle, Git hygiene | ✅ Complete | `activity-log.ts:9-22,51-75,82-104,145-147` defines records, start/resume modes, and local exclusion. |
| 4. Ordered, resilient writer | 🔄 Partial | `activity-log.ts:119-137` orders writes, but queues one Promise per event without a bound or use of stream backpressure; hygiene and writer failures can warn twice. |
| 5. Shared activity dispatcher | ✅ Complete | `index.ts:257-280` sends nested and synthetic failure activity to both sinks. |
| 6. Progress, terminal, cleanup | 🔄 Partial | `index.ts:267-303` fans out progress and closes in `finally`; a pre-projection supervisor exception can record `idle` rather than a blocked/aborted terminal state. |
| 7. Focused and live-boundary tests | 🔄 Partial | `wire.test.ts:140-163` tests pre-settlement visibility, but the full unit gate failed when its 20-turn poll did not observe the record. |
| 8. Operator how-to | ✅ Complete | `docs/howto/watch-buck-loop-activity.md:3-14` documents `tail -F`, lifecycle, and on-disk content. The command itself was not observed in this review. |

### Review Axes
- **Spec axis worst finding:** the live-boundary test failed the required unit gate; the exception terminal state also misses the plan contract.
- **Standards axis worst finding:** unbounded per-event Promise queue under text-delta pressure (`activity-log.ts:119-137`). This was a separate, sequential standards pass using the TypeScript and universal-quality guides plus diff-relevant code-smell definitions; no background sub-agent tool was available.
- Cross-axis ranking: none.

### Verification Status
- **Goal achieved:** partial. The writer and command fanout exist, but reliable pre-settlement observation was not established by the current full-suite run.
- **Scope:** planned files were changed; unrelated dirty Buck-model and loop files make the working-tree baseline noisy.
- **Guardrails verdict:** durable v2, **fail**. Unit: fail (1 of 1,010 tests, `wire.test.ts` live-drain test); complexity: fail on unrelated dirty `buck-models` files. Global ratchet: pass (87.2% versus 84%); patch: advisory; functional and lint: skipped.
- **Goal mode:** no active `goal` field was present in the inspected session file.

### Documentation Impact
The new runtime data flow is absent from the architecture narrative; consider `/b-docs` after the implementation passes. The operator how-to already covers the new action, so no further how-to is identified.

### Issue Classification
- **In-plan:** failing live-drain test, incorrect exception terminal state, unbounded writer queue, and duplicate-warning path. Fix proposals are staged in `.context/2026-09-24.buck-loop-streaming-log-drain/iterate-buck-loop-streaming-log-drain.md`.
- **Outside this plan:** required complexity failures in the unrelated dirty Buck-model files. They still block the deterministic completion gate; their owner must resolve them or obtain an explicit override.

### Verdict
**Needs work.** Route the staged iteration artifact to `/b-iterate`, then re-review the plan and rerun guardrails. No loop state was selected.
