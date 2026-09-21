---
status: active
date: 2026-09-21
subject: 2026-09-21.skill-command-extension-audit
topics: [phasing, cleanup, extensions, b-save, code-review]
source_plan: plan-skill-surface-cleanup.md
phases: 2
format: discrete
---

# Phased Plan: Skill / Command / Extension Surface Cleanup

> Derived from [plan-skill-surface-cleanup.md](plan-skill-surface-cleanup.md)

## Overview

- **Total phases**: 2
- **Rationale**: Eight implementation steps across ~18 live files spanning extensions, grill skills, guardrails, docs, b-save, and code-review. Two audit slices; grill rewrite must share a batch with the deletes.
- **Estimated total effort**: two agent sessions (one per phase). Phases share no files and can run in parallel; recommended order is Phase 1 first so complexity/coverage fail fast.
- **Difficulty mix**: 2 medium
- **User goal (inherited by all phases)**: Agents and humans using this package stop executing dead unwired extension code, follow one `/b-save` procedure, and write code-review artifacts into `.context/` instead of a machine-specific Windows path.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Dead Unwired Extensions | completed | medium | none | [phase-1-dead-unwired-extensions.md](phase-1-dead-unwired-extensions.md) |
| 2: b-save Thin-Wrap and Code-Review Paths | pending | medium | none | [phase-2-bsave-and-code-review.md](phase-2-bsave-and-code-review.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | NONE | Disjoint files. No build-order or shared-state coupling. |

## Dependency Diagram

```
Phase 1 (dead extensions + grill docs)
Phase 2 (b-save + code-review paths)
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)
- No edge = NONE

**Dependency details:**
- Phase 2 does not need Phase 1 artifacts. Grill skills, `guardrails.json`, and extension deletes never touch `skills/b-save/` or `skills/code-review/`.

## Parallel Opportunities

> Phases with NO dependency between them can be executed in parallel by separate agents.

- **Phase 1 ∥ Phase 2**: independent file sets.
  - *Rationale*: Phase 1 owns `extensions/` deletes, grill SKILL.md, docs, guardrails, grill-auto backlog. Phase 2 owns `b-save` skill/prompt + Codex copy, `code-review` skill/prompt.
  - *Caveat*: both run `npm run guardrails:check` and `scripts/codex-plugin.test.ts` at the end — do not interleave mid-batch. If parallel, serialize the final guardrails run on a consistent tree. Prefer Phase 1 first: complexity inventory shrink and coverage after deleting `tmux-window-status.test.ts` are the fail-fast risks.

## Execution Order

1. Complete Phase 1, verify acceptance criteria.
2. Update that phase file: `status: completed`, check acceptance criteria.
3. Update this overview: change status to `completed` in the summary table.
4. Queue Phase 2, repeat.

`omp_execution` is omitted (`none`). Two slices, no HARD chain, not an eval-cell audit.

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. If the phase's `omp_execution` is `orchestrate | workflow`, drop the matching keyword on the first turn before the build command. If it is `goal`, run `/goal set "<plan User Goal>" --budget <omp_goal_budget>` first instead. Either way, see the phase file's "Per-Phase Execution Loop" for the precondition.
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
7. Run `/b-commit` to checkpoint durable state.
8. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit; run `/b-save` → `/b-commit` after each phase, before queueing the next.

## Execution Checklist

- [ ] Phase 1: Dead Unwired Extensions — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 2: b-save Thin-Wrap and Code-Review Paths — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes

- Parent plan already `status: active`. Slice 3 and README Prompt Templates catalog rows stay out of scope.
- Codex bundle: Phase 1 recopies `b-grill`, `b-grill-me`, `b-grill-with-docs`. Phase 2 recopies `b-save`. Never add bundled `b-grill-auto` or `code-review`.
- `prompts/` ↔ `commands/` is 43/43 symlinks. Phase 2 edits `prompts/b-save.md` only.
- Historical `.context/` subject folders that mention the deleted extensions stay as record.
- Do not restore `b-loop` / `b-flow`.
