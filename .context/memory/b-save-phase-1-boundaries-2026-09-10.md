---
date: 2026-09-10
domains: [workflow, architecture, extensions]
topics: [b-save, hindsight, omp-sdk, command-contract, phase-1]
related:
  - .context/2026-09-10.b-save-state-machine-analysis/phase-1-boundaries-and-contract.md
  - .context/2026-09-10.b-save-state-machine-analysis/spec-b-save-command-contract.md
  - .context/2026-09-10.b-save-state-machine-analysis/research/hindsight-guarded-retain-result.md
  - extensions/b-save/experiments/hindsight-guarded-retain.ts
priority: high
status: completed
subject: 2026-09-10.b-save-state-machine-analysis
artifacts:
  - .context/2026-09-10.b-save-state-machine-analysis/spec-b-save-command-contract.md
  - .context/2026-09-10.b-save-state-machine-analysis/research/hindsight-guarded-retain-result.md
  - extensions/b-save/experiments/hindsight-guarded-retain.ts
---

# Phase 1: b-save boundaries and contract freeze

## Goal

Prove or refute a public-SDK guarded Hindsight retain, and freeze `/b-save` + `/deprecated-b-save`.

## What happened

Ran the bounded experiment against `@oh-my-pi/pi-coding-agent@18.1.17` matching `omp/18.1.17`. Restricted `createAgentSession` can inject a caller-owned custom tool (`allowRestrictedCustomTools`), but `restrictToolNames` leaves `createMemoryTools` undefined, so native `retain` never exists for `ctx.invokeTool`. `hindsightBackend` still has no `save()`. Decision locked: **`unsupported`**.

Froze `spec-b-save-command-contract.md`: engine flags, `--run-id` resume, headless recovery, inferred-completion policy. Recorded optional peer `@oh-my-pi/pi-coding-agent@18.1.17`; packaging stays Phase 6.

## Decisions

- Phase 5 Hindsight adapter is `unsupported`. Local/Mnemopi still use `ctx.memory.save()`. Durable `.context` checkpoint is unaffected.
- Do not expose raw `retain`, patch OMP, or treat `tool_execution_end` as integrity.
- `/b-save-improved` stays until Phase 6 parity. Engine code must not register as `/b-save` before then.

## Verification

- `npx vitest run extensions/b-save/experiments/hindsight-guarded-retain.test.ts` — 3 passed
- Live experiment: `decision: unsupported` on packed 18.1.17
- `lizard -C 10` on the experiment file — no function > 10
- `bun scripts/context-artifacts.ts validate` — 0 errors (pre-existing warnings only)

## Risks

- Experiment inspects published SDK sources rather than prompting a nested model. The gate is a construction-time fact (`createMemoryTools` skipped). A future OMP revision that instantiates memory tools under `restrictToolNames` would need a re-run.
- Lizard mis-parses TypeScript regexes and `): Interface {` return types as huge functions; keep experiment helpers includes-based and split.

## Leftovers

Phase 2: run model and deterministic snapshot. Hard-depends on this frozen contract.
