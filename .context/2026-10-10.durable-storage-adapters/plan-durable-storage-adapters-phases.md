---
status: active
date: 2026-10-10
subject: 2026-10-10.durable-storage-adapters
topics: [phasing, storage-adapters, configuration, branch-isolation, sqlite, postgresql]
source_plan: plan-durable-storage-adapters.md
phases: 8
format: discrete
sql_memory_ids:
  - 01a132bf-ba55-7008-acbb-78c3429e4d98
---

# Phased Plan: Configurable durable workflow storage

> Derived from [plan-durable-storage-adapters.md](plan-durable-storage-adapters.md)

## User Goal

Users can choose durable storage per project, resume reliably, and keep unmerged
work invisible on other branches. The parent user goal is:
"users can choose durable storage per project and keep unmerged work invisible on
other branches." This overview sequences the parent plan into eight phases.

## Overview

- **Total phases**: 8
- **Rationale**: The plan spans config, four backends, domain semantics, tool/CLI surface, every durable consumer, Git publication policy, data cutover, and final proof — impossible in one session and gated by assumption A-4 (SQLite runtime capability).
- **Estimated total effort**: 8+ sessions; most are `/b-build-hard`.
- **Difficulty mix**: 1 easy, 3 medium, 4 hard

**User Goal (inherited by every phase):** Buck Workflow users can choose where their durable workflow state lives, resume it reliably across sessions and worktrees, and keep unmerged work out of unrelated branches' ordinary retrieval.

## Phase Summary

| Phase | Status | Difficulty | File |
|-------|--------|------------|------|
| 1: Contract, Config, Identity & A-4 | completed | hard | [phase-1-contract-config-identity.md](phase-1-contract-config-identity.md) |
| 2: Four Storage Adapters | completed | hard | [phase-2-four-adapters.md](phase-2-four-adapters.md) |
| 3: Domain Semantics | completed | hard | [phase-3-domain-semantics.md](phase-3-domain-semantics.md) |
| 4: Native Tool, CLI & Skill Cutover | completed | hard | [phase-4-native-access.md](phase-4-native-access.md) |
| 5: Remaining Durable Consumers | pending | medium | [phase-5-remaining-consumers.md](phase-5-remaining-consumers.md) |
| 6: Publication, Reconciliation & Recovery | pending | hard | [phase-6-publication-recovery.md](phase-6-publication-recovery.md) |
| 7: Existing-Data Cutover | pending | hard | [phase-7-data-cutover.md](phase-7-data-cutover.md) |
| 8: End-to-End Proof, Docs & Packaging | pending | easy | [phase-8-proof-docs-package.md](phase-8-proof-docs-package.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| 1 → 2 | HARD | Adapters implement the typed contract/config/identity from Phase 1; conformance fixtures define adapter acceptance. |
| 2 → 3 | HARD | Domain semantics (lifecycle, corrections, save receipts) run through the store API built in Phase 2. |
| 3 → 4 | HARD | workflow_state/CLI expose the domain operations; skill cutovers need working artifact references. |
| 3 → 6 | HARD | Publication/recovery requires immutable revisions, checkpoint sealing, and branch identity from Phases 2–3. |
| 4 → 5 | HARD | Remaining consumers migrate onto the native/CLI access surface built in Phase 4. |
| 4 → 6 | SOFT | Phase 6's recovery inspection prefers the CLI/tool surface but can be exercised via the store API. |
| 6 → 7 | HARD | Cutover must preserve publication/visibility evidence and import ambiguous provenance per Phase 6 rules. |
| 7 → 8 | HARD | Final proof requires migrated callers, real cutover, and no dual stores. |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
                         │                       │
                         └──→ Phase 6 ──→ Phase 7 ──→ Phase 8
```

**Legend:** `──→` = HARD (blocking); `- -→` = SOFT; `│` = shared contract.

**Dependency details:**
- Phase 5 and Phase 6 are the only near-parallel pair (5 after 4; 6 after 3 with SOFT 4). They touch overlapping consumer files, so sequential execution is the safe default.
- A-4 (deferred): validated in Phase 1; the SQLite adapter slice of Phase 2 is HARD-blocked on a passing A-4 result.

## Parallel Opportunities

- **Phase 5 ∥ Phase 6** (conditional): Phase 6 needs only Phases 2–3 plus recovery inspection; Phase 5 needs the Phase 4 surface. If run in parallel, coordinate on `extensions/buck-loop/` and `extensions/b-save-improved/` — default to sequential.

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. Run `/b-review` against the phase file after implementation.
4. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
5. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
6. Run `/b-commit` to checkpoint durable state.
7. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit; run `/b-save` → `/b-commit` after each phase, before queueing the next.

**omp_execution**: none on all phases — the plan explicitly defers OMP execution-mode choice to the actual phase graph; work the phases sequentially.

## Execution Checklist

- [x] Phase 1: Contract, Config, Identity & A-4 — build → review → iterate if in-plan issues → docs if doc impact → save → commit (done 2026-10-10, 065b776)
- [x] Phase 2: Four Storage Adapters — build → review → iterate if in-plan issues → docs if doc impact → save → commit (done 2026-10-12, 849ef5a)
- [x] Phase 3: Domain Semantics — build → review → iterate if in-plan issues → docs if doc impact → save → commit (done 2026-10-12)
- [ ] Phase 4: Native Tool, CLI & Skill Cutover — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 5: Remaining Durable Consumers — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 6: Publication, Reconciliation & Recovery — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 7: Existing-Data Cutover — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 8: End-to-End Proof, Docs & Packaging — build → review → iterate if in-plan issues → docs if doc impact → save → commit
