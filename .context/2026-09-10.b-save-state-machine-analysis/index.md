---
status: active
date: 2026-09-10
subject: 2026-09-10.b-save-state-machine-analysis
topics: [b-save, state-machine, determinism, llm-boundaries]
---

# b-save state-machine analysis

Research-only decomposition of the twelve `/b-save` responsibilities and an interactive architecture Q&A defining deterministic, LLM, user-policy, and external-effect boundaries.

## Artifacts

- [Research summary](research-b-save-state-machine.md)
- [OMP SDK source notes](research/sources-omp-sdk.md)
- [Hindsight guarded-retain result](research/hindsight-guarded-retain-result.md)
- [Rolling notes](research/notes-b-save-state-machine.md)
- [Architecture Q&A](../discussions/b-save-state-machine.md)
- [Implementation plan](plan-b-save-state-machine.md)
- [Phased plan overview](plan-b-save-state-machine-phases.md)
- [Frozen command contract](spec-b-save-command-contract.md)

## Outcome

Research completed and implementation planning is active. Phase 1 locked Hindsight delivery as `unsupported` on `@oh-my-pi/pi-coding-agent@18.1.17`: a restricted session can inject a caller-owned custom tool, but cannot expand an opaque token into native retain. The durable `.context` checkpoint remains valid. The frozen command contract is `/b-save` (engine after parity) + `/deprecated-b-save` (prompt fallback), with `/b-save-improved` removed only after cutover.
