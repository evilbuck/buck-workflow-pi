---
status: completed
date: 2026-07-26
subject: 2026-07-26.b-init-guardrails
topics: [phasing, guardrails, coverage, cyclomatic-complexity, ratchet, brownfield]
source_plan: plan-b-init-guardrails.md
phases: 5
format: discrete
---

# Phased Plan: b-init-guardrails

> Derived from [plan-b-init-guardrails.md](plan-b-init-guardrails.md)

## Overview

- **Total phases**: 5
- **Rationale**: 9 steps, 11 files, two architectural layers (skill authoring + cross-harness registration). The `guardrails.json` schema is a hard dependency for the protocol doc, both SKILL.md files, and the detection script — phase ordering is load-bearing.
- **Estimated total effort**: 4–5 agent sessions
- **Difficulty mix**: 2 easy, 3 medium

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
| 1: Schema & Protocol | completed | easy | none | [phase-1-schema-protocol.md](phase-1-schema-protocol.md) |
| 2: Tooling & Detection | completed | medium | none | [phase-2-tooling-detection.md](phase-2-tooling-detection.md) |
| 3: Init Skill | completed | medium | none | [phase-3-init-skill.md](phase-3-init-skill.md) |
| 4: Check Skill | completed | medium | none | [phase-4-check-skill.md](phase-4-check-skill.md) |
| 5: Registration | completed | easy | none | [phase-5-registration.md](phase-5-registration.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | SOFT | Detection script writes into the schema shape but is pure; schema file is the contract it targets |
| Phase 1 → Phase 3 | HARD | Init skill references schema fields and ratchet semantics verbatim |
| Phase 1 → Phase 4 | HARD | Check skill implements the gate logic defined by the ratchet protocol |
| Phase 2 → Phase 3 | HARD | Init skill invokes detect-stack.ts as Phase 1 of its own flow |
| Phase 3 → Phase 5 | HARD | Registration wires prompts that load the init skill by path |
| Phase 4 → Phase 5 | HARD | Registration wires prompts that load the check skill by path |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 5
  │                          ↑            ↑
  └──────────────────────────→ Phase 4 ───┘
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)

**Dependency details:**
- Phase 1 → Phase 2 (SOFT): `detect-stack.ts` is pure manifest-globbing; it targets the schema shape but doesn't read the protocol doc at runtime.
- Phase 1 → Phase 3 (HARD): Init SKILL.md embeds schema field names, ratchet update rules, and threshold values from the protocol doc.
- Phase 1 → Phase 4 (HARD): Check SKILL.md defines gate comparisons and verdict format directly from the ratchet protocol.
- Phase 2 → Phase 3 (HARD): Init skill's Phase 1 calls `detect-stack.ts` and must match its actual JSON output shape.
- Phase 3 → Phase 5 (HARD): Prompt files load the init skill by `../skills/b-init-guardrails/SKILL.md`.
- Phase 4 → Phase 5 (HARD): Prompt files load the check skill by `../skills/b-guardrails-check/SKILL.md`.

## Parallel Opportunities

None. The dependency chain is linear with Phase 4 and Phase 3 converging at Phase 5. Phase 1 must complete first; after that, Phase 2 could theoretically run alongside a schema-only draft of Phase 4, but the file overlap (both reference schema fields) makes serial execution safer.

## Execution Order

1. Phase 1 — Schema & Protocol (easy) — `/b-build`
2. Phase 2 — Tooling & Detection (medium) — `/b-build`
3. Phase 3 — Init Skill (medium) — `/b-build`
4. Phase 4 — Check Skill (medium) — `/b-build`
5. Phase 5 — Registration (easy) — `/b-build`

## Notes for Implementing Agents

- **Schema is the load-bearing artifact.** Every later phase references field names, gate semantics, and threshold values from `ratchet-protocol.md`. Do not rename fields after Phase 1 without updating all downstream phase files.
- **Tooling matrix must preserve `[UNVERIFIED]` markers.** The three research files used explicit markers where claims were not source-verified; the consolidated matrix must carry them forward.
- **`lizard`, not `scc`, for complexity.** scc's COMPLEXITY column is keyword-count approximation, not McCabe. This is a non-negotiable conclusion from the research.
- **`detect-stack.ts` is pure and deterministic.** No network, no writes, no model inference. Manifest glob → ecosystem list → per-ecosystem tool presence → JSON on stdout.
- **Managed `AGENTS.md` block is the ongoing enforcement home.** No new extension or hook. The block dispatches `b-guardrails-check`; the check skill is the standalone contract.
- **Skill authoring follows the `b-pr` precedent**: `SKILL.md` with frontmatter (`name`, `description`), `scripts/` for deterministic code, `docs/` for reference material.

## Risks Carried from Parent Plan

| Risk | Mitigation |
|---|---|
| `guardrails.json` grows unusable | `complexity_baseline_file` pointer field from day one; split escape hatch at ~200 entries |
| False failures from tree contention | Coherent-point dispatch only; re-verify before escalating |
| Baseline becomes debt suppression | Report baseline size every run; goal is zero; no auto-add on normal check |
| Tool detection wrong | Deterministic script over manifests; every proposed command shown before recording |
| `lizard` gaps (no Shell/Elixir) | Matrix marks explicitly; Shell is complexity-unsupported, Elixir uses native `credo` |

## Acceptance Criteria (Overall)

- [ ] All 5 phases completed and marked `status: completed`
- [ ] `guardrails.json` schema defined and documented
- [ ] `detect-stack.ts` passes polyglot smoke test
- [ ] Both skills loadable via `skill://` URIs
- [ ] Both prompt wrappers resolve and load the correct skill
- [ ] Command symlinks resolve correctly
- [ ] `docs/buck-workflow.md` updated with both skills
- [ ] Eval-kernel doc-gap backlog item filed
