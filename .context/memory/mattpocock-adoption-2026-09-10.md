---
date: 2026-09-10
subject: 2026-09-10.mattpocock-adoption
domains: [skill, buck-workflow, docs, license]
topics: [mattpocock-skills, adoption, phase-1, mit-notice, provenance, issue-tracker, triage-labels, b-research, backlog, guardrails]
status: in-progress
---

# mattpocock/skills remediation — phased execution (2026-09-10)

Executing `plan-mattpocock-findings-remediation-phases.md` (5 phases) end-to-end
on branch `feat/matt-pocock-adapt`. One commit per phase.

## Phase 1: Live Defects — COMPLETED 2026-09-10

Built via `/b-build` with 4-way fan-out (D1, D2, D3, Tier-4 backlog — disjoint file sets).

- **D1**: `THIRD-PARTY-NOTICES.md` at repo root (full upstream MIT text,
  `Copyright (c) 2026 Matt Pocock` verbatim); added to `package.json` `files:`
  (verified in `npm pack --dry-run`); provenance headers on
  `skills/b-grill-with-docs/{CONTEXT,ADR}-FORMAT.md` (header-only diffs, +2 lines
  each); origin note in `skills/b-grill-with-docs/SKILL.md`.
- **D2**: `docs/agents/issue-tracker.md` + `docs/agents/triage-labels.md` written
  (GitHub, evilbuck/buck-workflow-pi; live `gh label list` showed neither
  `ready-for-agent` nor `needs-triage` exists yet — documented with inspect-first
  rule). `b-issue-create` L37-39 reads now conditional (when present);
  `fix-pr` L247 cross-references triage-labels when-present.
- **D3**: `skills/b-research/SKILL.md` gained `## Dispatch (Default: Background
  Subagent)` — background subagent via OMP `task` is the default, portable
  fallback + foreground exception named. Side-by-side with
  `GLOBAL_OR_PROJECT-AGENTS.md` § b-research recorded in review: agree in intent.
- **Tier 4**: 8 backlog items created and linked from `todo.md`
  (`b-phase` ready-frontier, `b-prototype`, `b-grill` round-frontier,
  `b-auto-fix` frontier concurrency, `code-smells` depth axis + `b-blueprint`
  visuals, `b-which` router, `b-retro`, `wayfinder`).

## Guardrails verdict (Phase 1, code-touching: package.json)

`contract: durable`, version 2 — **the plan's "contract: none" note was stale**;
`guardrails.json` exists. unit_test_gate=pass (499/499), functional=skipped,
lint=skipped, global_ratchet=pass (72.91% > 54.9% baseline),
**patch_gate=FAIL 89% < 90%** — all 10 uncovered lines in
`scripts/serve-presentations.ts` from pre-existing commit `0d1dbf7` (zero
coverable lines from Phase 1). Classified out-of-plan → backlog item
`serve-presentations-patch-coverage.md`. Complexity: pre-existing drift vs
recorded baseline (`b-save-improved` CCN 48 unlisted; `parseArgs` 66→68) — no
new code this phase. Backlog item `run-b-init-guardrails-on-repo.md` closed as
completed (stale).

## Review

`review-phase-1.md`: **Pass with warnings** (reviewer subagent, confidence 0.94).
All 11 acceptance criteria verified with direct evidence; license text
byte-identical to upstream. One informational finding (stale contract note) —
amended in the phase file.

## Decisions

- `plugins/buck-workflow/skills/fix-pr/SKILL.md` is a stale mirror copy still
  carrying the old unconditional read — flagged by D2 agent, left untouched
  (out of phase scope; plugin mirror is a separate distribution concern).
- Upstream reference snapshots for porting phases live in `/tmp/mattpocock-ref/`
  (not committed).

## Files Modified (Phase 1)

- `THIRD-PARTY-NOTICES.md` (new), `package.json`
- `skills/b-grill-with-docs/{SKILL,CONTEXT-FORMAT,ADR-FORMAT}.md`
- `docs/agents/{issue-tracker,triage-labels}.md` (new)
- `skills/b-issue-create/SKILL.md`, `skills/fix-pr/SKILL.md`
- `skills/b-research/SKILL.md`
- `.context/backlog/items/` (8 new Tier-4 items + serve-presentations item),
  `.context/backlog/todo.md`, `mattpocock-audit-defects.md`,
  `run-b-init-guardrails-on-repo.md` (closed)
- `.context/2026-09-10.mattpocock-adoption/` (phase state, review-phase-1.md)

## Next

Phase 2: Design Vocabulary & b-diagnose (hard, `/b-build-hard`) — A1
`codebase-design` then A2 `b-diagnose`; catalog rows in README +
docs/buck-workflow.md (serialize, re-read tails).
