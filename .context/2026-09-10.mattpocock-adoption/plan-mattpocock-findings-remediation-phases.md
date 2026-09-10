---
status: active
date: 2026-09-10
subject: 2026-09-10.mattpocock-adoption
topics: [phasing, mattpocock-skills, adoption, provenance, license, b-diagnose, b-review, skill-catalog]
source_plan: plan-mattpocock-findings-remediation.md
phases: 5
format: discrete
---

# Phased Plan: mattpocock/skills findings — remediation & adoption

> Derived from [plan-mattpocock-findings-remediation.md](plan-mattpocock-findings-remediation.md)

## Overview

- **Total phases**: 5
- **Rationale**: 12 deliverables, ~30 files, four dependency edges, ~21 h. Exceeds every `b-phase` threshold. The plan's own tier structure is the natural phase boundary: defects must ship before adoptions (policy gate), `codebase-design`'s vocabulary is a prerequisite for two later consumers, and the tracker chain (D2 → N3 → N4) is strictly sequential.
- **Estimated total effort**: ~21 h ≈ 5 agent sessions
- **Difficulty mix**: 3 medium, 2 hard
- **User goal (inherited by all phases)**: a buck-workflow user gets a debugging on-ramp that does not exist today (`/b-diagnose`), review that runs both the standards and spec axes without one masking the other, and a repo whose shipped skills do not read config files that were never written. Secondary beneficiary: downstream consumers of this public package, who currently receive MIT-licensed third-party text with no notice.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Live Defects | completed | medium | orchestrate | [phase-1-live-defects.md](phase-1-live-defects.md) |
| 2: Design Vocabulary & b-diagnose | completed | hard | none | [phase-2-design-vocabulary-and-diagnose.md](phase-2-design-vocabulary-and-diagnose.md) |
| 3: Loop Composition Patches | completed | medium | none | [phase-3-loop-composition-patches.md](phase-3-loop-composition-patches.md) |
| 4: Independent New Members | pending | medium | orchestrate | [phase-4-independent-new-members.md](phase-4-independent-new-members.md) |
| 5: Tracker Init & Triage | pending | hard | none | [phase-5-tracker-init-and-triage.md](phase-5-tracker-init-and-triage.md) |

**Tier → phase map**: Tier 0 (D1–D3) + Tier 4 backlog capture → Phase 1 · Tier 1 (A1, A2) → Phase 2 · Tier 2 (C1, C2) → Phase 3 · Tier 3 independent (N1, N2, N5) → Phase 4 · Tier 3 dependent (N3, N4) → Phase 5.

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | **Policy gate, not a build dependency.** The plan declares "defects ship first; nothing else starts until the repo is self-consistent". A1/A2 would technically compile without it. |
| Phase 1 → Phase 4 | HARD | Same policy gate. No technical coupling. |
| Phase 1 → Phase 5 | HARD | **Technical.** D2 hand-writes `docs/agents/{issue-tracker,triage-labels}.md`; N3 generalizes exactly that config shape into a producer, and must not clobber the hand-written files. |
| Phase 2 → Phase 3 | SOFT | C2's `seams.md` links to A1's seam definition. C2 can be authored before A1 lands, but must **not** inline the definitions as a workaround — that recreates the drift A1 exists to prevent. |
| Phase 4 → Phase 5 | SOFT | Shared catalog files only (`README.md`, `docs/buck-workflow.md`). No semantic dependency; serialize the table edits. |

## Dependency Diagram

```
                 ┌──→ Phase 2 - -→ Phase 3
Phase 1 ─────────┤
                 ├──→ Phase 4 - -→ Phase 5
                 └────────────────────↑
                     (HARD: D2 shape)
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/defer)
- Phases 2/3 and 4/5 share `README.md` + `docs/buck-workflow.md`

**Dependency details:**
- Phase 1 → Phase 2 (HARD, policy): plan § Execution Instructions declares the Tier-0 gate. Honour it — the license defect is the one item with a legal dimension and it is 30 minutes of work.
- Phase 1 → Phase 4 (HARD, policy): same gate.
- Phase 1 → Phase 5 (HARD, technical): N3's whole purpose is generalizing D2. Building N3 before D2 means guessing at the config shape the plan already fixed.
- Phase 2 → Phase 3 (SOFT): only C2 is affected; C1 (`b-review`) is fully independent of Phase 2. If Phase 2 slips, C1 can ship alone.
- Phase 4 → Phase 5 (SOFT): file contention only.

## Parallel Opportunities

> Phases with no dependency between them can be executed in parallel by separate agents.

- **Phase 2 ∥ Phase 4** — no semantic dependency; different skills, different directories.
  - *Caveat*: both add rows to `README.md` and `docs/buck-workflow.md`. Those two files are the irreducibly shared mutation boundary. If run in parallel, **one integration owner applies all catalog rows serially**; the parallel agents write skill bodies, prompts, and command symlinks only.
- **Phase 3 (C1 half) ∥ Phase 2** — `b-review` patching has no dependency on `codebase-design`. Only C2 waits on A1.
- **Within Phase 1** — D1, D2, D3, and the Tier-4 backlog capture touch four disjoint file sets. This is why Phase 1 is stamped `omp_execution: orchestrate`.
- **Within Phase 4** — N1, N2, N5 are independent skill bodies. Stamped `orchestrate` with a serialized catalog owner.
- **Not parallelizable**: Phase 2 internally (A1 → A2), Phase 5 internally (N3 → N4 with an exercise-against-this-repo step between them).

## Execution Order

1. Phase 1 — Live Defects (medium) — `/b-build`, `orchestrate`
2. Phase 2 — Design Vocabulary & b-diagnose (hard) — `/b-build-hard`
3. Phase 3 — Loop Composition Patches (medium) — `/b-build`
4. Phase 4 — Independent New Members (medium) — `/b-build`, `orchestrate`
5. Phase 5 — Tracker Init & Triage (hard) — `/b-build-hard`

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:

1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. If the phase's `omp_execution` is `orchestrate`, type the `orchestrate` keyword on the first turn before the build command. See the phase file's "Per-Phase Execution Loop" for the precondition and the fan-out shape.
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
7. Run `/b-commit` to checkpoint durable state.
8. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit.

## Execution Checklist

- [x] Phase 1: Live Defects — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 2: Design Vocabulary & b-diagnose — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [x] Phase 3: Loop Composition Patches — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 4: Independent New Members — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 5: Tracker Init & Triage — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes for Implementing Agents

- **`omp_execution` deviates from the plan's blanket recommendation.** The plan's HTML comment recommends `orchestrate` for the whole plan. Per-phase, `orchestrate` only pays where a phase holds ≥ 2 genuinely disjoint work units: Phases 1 and 4. Phases 2 and 5 are internally sequential; Phase 3 has two careful edits to core loop skills where fan-out buys nothing. Stamped accordingly.
- **The catalog is the recurring hazard, not the skills.** Seven new skills × 6 delivery surfaces ≈ 42 touchpoints across two long markdown tables with a documented clobber history (2026-09-04: a `b-recap` insert deleted the README tail). **Re-read the file tail after every table edit and byte-compare unrelated sections against `HEAD`.**
- **Plan correction — README table names.** The plan describes "2 README catalog tables (slash-command ~L235, OMP mirror ~L269)". Verified: the tables are `### Prompt Templates (/b-* commands)` (~L216-237) and `### Skills` (~L251-284). `### OMP Command Mirror` (~L239) is a prose paragraph about symlinks — it has no table and no row to add.
- **Model-invoked references get no wrapper.** `codebase-design` (Phase 2) and `writing-for-agents` (Phase 4) ship as skills only: no `prompts/`, no `commands/`, and no row in the README slash-command table. Precedent: `fix-pr` (`docs/buck-workflow.md:31`, `:1108`).
- **Two phases are code-touching.** Phase 1 edits `package.json`; Phase 4 adds `skills/b-wizard/template.sh`. Both make the deterministic check contract **blocking**. The repo currently resolves `contract: "none"` (open item `run-b-init-guardrails-on-repo.md`) — record the verdict, do not silently pass. Phases 2, 3, and 5 are docs-only and skip the gate with one line of explanation.
- **Phase 3 changes the review skill later phases run on themselves.** Treat the first `/b-review` after Phase 3 as C1's smoke test, and distinguish "the phase has a defect" from "the review patch has a defect".
- **Port fidelity is the acceptance criterion, not the port.** Each ported skill's phase file names the specific load-bearing rule that must survive: `b-diagnose`'s Phase-1 refusal, `b-triage`'s no-file-paths brief, `b-handoff`'s temp-dir output, `b-wizard`'s idempotent `.env` upsert.
- **Loader resolution ≠ readable file.** Every new-skill acceptance criterion requires resolution **by name in a reloaded session**. A `SKILL.md` that exists on disk is not evidence it loaded.
- **Do not rewrite `CONTEXT-FORMAT.md` / `ADR-FORMAT.md`.** The MIT notice makes the copy compliant. A rewrite discards reviewed content and re-introduces upstream drift (plan Light Grill Q1, resolved).
- **Promote `b-which` if Phase 4 lands.** The repo reaches ~61 skills with no in-agent router. Tier 4's catalog-generated router would make the 42-touchpoint risk structural rather than per-edit. Revisit at Phase 4's `/b-save`.

## Risks Carried from Parent Plan

| Risk | Mitigation | Owning phase |
|---|---|---|
| Catalog churn / README tail clobber | Re-read tail after every table edit; byte-compare unrelated sections | 2, 4, 5 |
| Skill-count inflation with no router | Promote `b-which` from Tier 4 if Phase 4 lands | 4, 5 |
| `b-triage` tracker coupling → rework | N3 ships **and is exercised against this repo** before N4 starts | 5 |
| `b-review` fan-out doubles review cost | Diff-scoped catalog subset; measure on a real diff before defaulting | 3 |
| Port fidelity — load-bearing rule dropped | Each port's acceptance criterion names the specific rule | 2, 4, 5 |
| No durable check contract (`contract: "none"`) | Record the verdict; `template.sh` verified statically (`bash -n`, shellcheck) | 1, 4 |
| N3 clobbering Phase 1's hand-written `docs/agents/*` | Run twice, second run must produce an empty `git diff` | 5 |

## Acceptance Criteria (Overall)

- [ ] All 5 phases `status: completed` with their acceptance criteria checked
- [ ] `grep -ri 'mattpocock' .` returns matches in `THIRD-PARTY-NOTICES.md`, both format files, and `skills/b-grill-with-docs/SKILL.md`; upstream MIT copyright line verbatim
- [ ] `npm pack --dry-run` lists `THIRD-PARTY-NOTICES.md`
- [ ] No skill references a `docs/agents/*.md` path that does not exist
- [ ] `skills/b-research/SKILL.md` matches `GLOBAL_OR_PROJECT-AGENTS.md` § b-research in intent
- [ ] `/b-diagnose` resolves in a reloaded session and refuses to hypothesize before a named command has gone red
- [ ] `b-review` spawns the standards axis as a separate agent and reports per-axis findings with no cross-axis ranking
- [ ] `b-build`'s TDD Plan step requires named, confirmed seams before the first RED
- [ ] All 7 new skills resolve by name in a reloaded session and appear in every catalog site their delivery shape requires
- [ ] `README.md` and `docs/buck-workflow.md` tails intact (byte-compare unrelated sections against `HEAD`)
- [ ] Tier 4 has one backlog item per deliverable, each linked from `todo.md`
- [ ] `/b-guardrails-check` verdict recorded for Phases 1 and 4
