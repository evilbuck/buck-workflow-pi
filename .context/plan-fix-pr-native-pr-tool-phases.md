---
status: active
date: 2026-09-28
subject: 2026-09-28.fix-pr-native-pr-tool
topics: [phasing, fix-pr, github, agent-tool, portable-skill]
source_plan: plan-fix-pr-native-pr-tool.md
phases: 4
format: discrete
---

# Phased Plan: fix-pr native PR tool

> Derived from [plan-fix-pr-native-pr-tool.md](plan-fix-pr-native-pr-tool.md)

## Overview

- **Total phases**: 4
- **Rationale**: The contract is compact but crosses extension, skill, Codex copy, docs, and walkthrough surfaces; tool implementation and documentation verification benefit from separate sessions.
- **Estimated total effort**: ~3 build sessions + 1 verification session
- **Difficulty mix**: 1 easy, 2 medium, 1 hard

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Tool Contract + Adapter Extension | completed | hard | none | [phase-1-tool-contract-adapter.md](phase-1-tool-contract-adapter.md) |
| 2: Skill + Codex Copy Sync | in-progress | medium | none | [phase-2-skill-and-codex-copy.md](phase-2-skill-and-codex-copy.md) |
| 3: Docs + Walkthrough Sync | pending | easy | none | [phase-3-docs-and-walkthrough.md](phase-3-docs-and-walkthrough.md) |
| 4: End-to-End Verification | pending | medium | none | [phase-4-verification.md](phase-4-verification.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | SKILL.md references the registered tool surface (`fix_pr_feedback`); it can't document availability-probing before the tool exists. |
| Phase 2 → Phase 3 | HARD | Docs/walkthrough describe the canonical SKILL.md contract; must match the Phase 2 wording. |
| Phase 1 → Phase 4 | HARD | Verification exercises the live tool. |
| Phases 2,3 → Phase 4 | HARD | Verification confirms parity of skill/Codex/docs claims. |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
    │                                 ↑
    └─────────────────────────────────┘
```

**Legend:**
- `──→` = HARD dependency (blocking)

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: the skill's tool-preference section names the actual registered tool and its availability probe.
- Phase 3 HARD-depends on Phase 2: docs and walkthrough must mirror the finalized skill contract verbatim in substance.
- Phase 4 HARD-depends on Phases 1–3: end-to-end equivalence, fallback, and failure-path checks require everything landed.

## Notes for executing agents
- The CLI (`skills/fix-pr/scripts/fetch-feedback.ts`) is the only exhaustive ingest backend; the adapter must not reimplement pagination/normalization, and `pr://` never substitutes for settlement evidence.
- Concurrent tool calls may collide on the CLI's fixed inventory filename — fix at the CLI boundary (unique private path, JSON schema unchanged) only if actually possible.
- Codex copy is byte-parity enforced by `scripts/codex-plugin.test.ts`; run it immediately after any SKILL.md edit.
- Phase 4 smoke is read-only against GitHub: no commit, push, issue, or review post.
- Each phase runs the standard loop: build → `/b-review` → `/b-save` → `/b-commit`.
