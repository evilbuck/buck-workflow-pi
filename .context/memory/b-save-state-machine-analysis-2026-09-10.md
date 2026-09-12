---
date: 2026-09-10
domains: [workflow, architecture, security]
topics: [b-save, state-machine, deterministic-workflows, omp-sdk, prompt-injection]
related:
  - .context/2026-09-10.b-save-state-machine-analysis/research-b-save-state-machine.md
  - .context/2026-09-10.b-save-state-machine-analysis/research/sources-omp-sdk.md
  - .context/discussions/b-save-state-machine.md
priority: high
status: completed
subject: 2026-09-10.b-save-state-machine-analysis
artifacts:
  - research-b-save-state-machine.md
  - research/sources-omp-sdk.md
  - research/notes-b-save-state-machine.md
---

# b-save state-machine analysis

Completed a research-only decomposition of all twelve `/b-save` responsibilities and an interactive architecture Q&A.

## Decisions

- Use a deterministic, journaled state-machine shell around bounded semantic roles rather than translating the twelve prompt steps one-for-one.
- Only typed expected judgment failures invoke an SDK LLM; schema, path, I/O, stale-snapshot, and programmer errors stay deterministic.
- LLMs return typed evidence-bound proposals and never mutate files. Scribe, auditor, and goal-classifier sessions have zero tools and no ambient skills, rules, context files, extensions, MCP, LSP, or IRC.
- Explicit policy gates remain user decisions. Machine uncertainty routes to bounded LLM adjudication.
- OMP is the primary target. `ctx.memory.save()` handles local and Mnemopi directly.
- Hard constraint: only OMP's shipped public API interfaces may be used. OMP source changes, patches, forks, and required upstream additions are prohibited.
- Hindsight delivery may use the requested SDK-agent fallback only behind a trusted pre-execution retain capability. The model receives an opaque token; trusted code owns the validated payload before native `retain` runs. Raw built-in `retain` and post-execution checks are insufficient.
- The exact guarded Hindsight capability is not proven against the researched OMP SDK revision. This is a blocking feasibility prerequisite for implementation; failure to provide it must record the external effect as unsupported/failed without invalidating the durable `.context` checkpoint.
- Replace `/b-save` with the engine and retire `/b-save-improved` only after parity.

## Verification

- Research contains twelve responsibility sections and the discussion contains twelve matching Step Q&A entries.
- Marksman diagnostics passed for the research summary, OMP SDK source notes, discussion, and subject index.
- No application code was changed; deterministic code guardrails were not applicable.

Backlog unchanged: implementation was not authorized in this research-only session.
