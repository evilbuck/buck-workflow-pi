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

~~Phase 2: Design Vocabulary & b-diagnose~~ — DONE (see below). Next:
Phase 3: Loop Composition Patches (medium, `/b-build`) — C1 b-review parallel
standards axis, C2 b-build seams gate.

## Phase 2: Design Vocabulary & b-diagnose — COMPLETED 2026-09-10

Built via `/b-build-hard`, sequential A1 → A2.

- **A1** `skills/codebase-design/{SKILL,DEEPENING,DESIGN-IT-TWICE}.md` — ported
  from upstream, repo conventions, seven terms + deletion test +
  one-adapter rule. Skill-only (no wrapper; fix-pr precedent).
- **A2** `skills/b-diagnose/SKILL.md` + `prompts/b-diagnose.md` +
  `commands/b-diagnose.md` symlink. 6 phases; Phase-1 refusal gate preserved
  verbatim in intent ("No red-capable command, no Phase 2"). Exits wired to
  b-iterate / b-plan / code-smells. Seam language links to codebase-design.
- `THIRD-PARTY-NOTICES.md` extended with both ports.
- Catalog: README prompt-table + skills-table rows; docs/buck-workflow.md
  primitives + quick-reference rows + 2 full section bodies. **The catalog
  clobber hazard fired for real**: two edit-tool calls truncated README.md and
  docs/buck-workflow.md mid-session; both restored from git and reapplied via
  python with anchor-count assertions. Final diffs additive-only, tails
  byte-identical.
- Verification: behavioral fixture test (broken `average()` in
  /tmp/b-diagnose-fixture) — agent built red loop first, zero hypotheses
  before red, quoted the governing line. Installer dry-run
  (`node scripts/install.mjs --dry-run`) picks up both skills + the command;
  full reload-probe requires re-running the installer (recorded, not done).
- Review `review-phase-2.md`: **Pass with warnings** (13/14 criteria direct
  evidence; loader-reload criterion structurally verified via installer
  dry-run). Docs-only phase: guardrails contract skipped (no scripts/ or
  package.json changes).

## Phase 3: Loop Composition Patches — COMPLETED 2026-09-10

Built via `/b-build`.

- **C1** `skills/b-review/SKILL.md` gained "Two Review Axes (Parallel Standards
  Pass)" (+50 lines): standards axis = separate parallel `task` sub-agent
  seeded with `code-review-universal` guides + diff-scoped `code-smells`
  subset (with a named fallback for docs-only diffs); context isolation
  rationale; no-reranking rule (worst finding per axis, never merged); named
  portable sequential fallback. Report template gained a `### Review Axes`
  block.
- **C2** `skills/b-build/references/seams.md` (new) links to
  `codebase-design` for the seam definition (does not restate it); names the
  tautological-test anti-pattern with example. `skills/b-build/SKILL.md` TDD
  Plan step gained exactly one line requiring named, confirmed seams before
  the first RED.
- **Smoke test**: the Phase 3 review itself ran under the patched two-axis
  contract on a real diff — two agent outputs (spec axis mainline, standards
  axis parallel sub-agent), per-axis worst findings, no merged ranking.
  Fan-out cost measured: ~1m21s sub-agent wall time, ~10-15K tokens, 77% of
  the code-smells catalog skipped by diff-scoping.
- Review `review-phase-3.md`: **Pass** (confidence 0.92). 3 non-blocking
  polish findings; 2 applied immediately (name the anti-padding-rules source
  as "harness global bootstrap"; name the standards-seed fallback for
  no-matching-language diffs). Docs-only phase: guardrails skipped.

## Phase 4: Independent New Members — COMPLETED 2026-09-10

Built via `/b-build` with 3-way fan-out (N1, N2, N5 — disjoint skill bodies;
mainline owned README + docs/buck-workflow.md catalog rows serially).

- **N1** `skills/b-handoff/SKILL.md` + `prompts/b-handoff.md` +
  `commands/b-handoff.md` symlink — writes to OS temp dir (verified: wrote
  to `$TMPDIR`, confirmed outside the repo workspace, no secret-shaped
  strings), suggested-skills section, references artifacts by path/URL,
  redacts secrets. Routing table vs `b-recap`/`b-save`.
- **N2** `skills/writing-for-agents/SKILL.md` + `SKILL-MECHANICS.md` —
  model-invoked reference (no wrapper, confirmed no prompts/commands
  files). Covers all 6 required concepts (context vs cognitive load,
  information hierarchy, completion criteria, leading words, no-op test,
  prompt-the-positive).
- **N5** `skills/b-wizard/SKILL.md` (thin) + `template.sh` (206 lines, +x)
  + prompts/commands wrapper. Implements staged progress, WSL-aware URL
  open (wslview→explorer.exe→cmd.exe/c start→xdg-open→open), hidden secret
  entry, idempotent `.env` upsert, `gh secret`/`gh variable` write.
- **Catalog**: README prompt+skills rows for b-handoff/b-wizard, skills-only
  row for writing-for-agents; docs/buck-workflow.md primitives + quickref +
  3 full sections — all additive, tails verified intact.
- **Review round 1**: Needs work — 3 in-plan defects: (1)
  THIRD-PARTY-NOTICES.md missing the 2 new ports, (2) b-wizard SKILL.md
  overstated "confirms at every stage" vs template.sh's actual header-only
  `stage()`, (3) standards-axis worst finding: `write_env`'s `mktemp` not
  same-directory (cross-filesystem `mv` risk) plus unescaped grep-key
  interpolation (regex metacharacters could corrupt `.env`).
- **Fixes applied**: THIRD-PARTY-NOTICES.md extended with exactly the
  Phase 4 ports (caught and reverted an over-eager first pass that also
  added Phase 5's not-yet-committed b-init-tracker/b-triage — would have
  been a dangling reference); softened b-wizard's confirm-gate prose;
  `write_env`/`_existing` now use `mktemp "${ENV_FILE}.XXXXXX"` (atomic
  same-directory rename) and escape the key for all ERE metacharacters
  (`[][\.|$(){}?+*^]`) in both grep sites; `set_var` now pipes its value
  via stdin like `set_secret` instead of argv. Smoke-tested with
  `FOO.BAR` and `FOO+BAR` keys: no cross-contamination, clean
  replace-in-place both times.
- **Review round 2**: Pass (confidence 0.95). One non-blocking P3 note
  (BRE-vs-ERE metachar coverage) — the fix already covers the realistic
  class; not applied further.
- Guardrails: complexity_gate fail is pre-existing drift at e33b0a8 (6
  new-vs-baseline + 1 worsened hotspot, all untouched by this phase);
  unit 499/499 pass, ratchet pass (72.9% > 54.9%), template.sh complexity
  unmeasurable (lizard has no shell scope) — noted, not a gate failure.
