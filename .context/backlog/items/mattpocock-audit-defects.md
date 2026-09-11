---
title: Fix 3 live defects found by the mattpocock/skills audit
status: completed
priority: high
created: 2026-09-10
updated: 2026-09-10
completed: 2026-09-10
related:
  - .context/2026-09-10.mattpocock-adoption/plan-mattpocock-findings-remediation.md
  - .context/2026-09-10.mattpocock-adoption/plan-mattpocock-findings-remediation-phases.md
  - .context/2026-09-10.mattpocock-adoption/phase-1-live-defects.md
  - .context/2026-09-10.mattpocock-skills-overlap/research-mattpocock-skills-overlap.md
  - skills/b-grill-with-docs/CONTEXT-FORMAT.md
  - skills/b-issue-create/SKILL.md
  - skills/b-research/SKILL.md
---

# Fix 3 live defects found by the mattpocock/skills audit

Tier 0 of `plan-mattpocock-findings-remediation.md`, phased 2026-09-10 as **Phase 1**
(`phase-1-live-defects.md` — executable scope, acceptance criteria, `omp_execution: orchestrate`).
All three are "the repo is wrong today", independent of any adoption decision. ~2 h, plus the
Tier-4 backlog capture folded in so the deferred list survives if execution stops here.

- **D1 — MIT notice missing.** `skills/b-grill-with-docs/{CONTEXT,ADR}-FORMAT.md` are near-verbatim
  copies of `mattpocock/skills` `engineering/domain-modeling/`, which is **MIT © 2026 Matt Pocock**.
  The package publishes `skills/` to npm, so the copyright + permission notice must travel with it.
  Fix: `THIRD-PARTY-NOTICES.md` at root (added to `package.json` `files:`), provenance header in both
  format files, origin line in `SKILL.md`.
- **D2 — Dangling tracker config.** `skills/b-issue-create/SKILL.md:37-39` gathers
  `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`; neither exists and no skill
  writes them. `skills/fix-pr/SKILL.md:247` shares the label vocabulary. Fix: write both docs for
  this repo, make the reads conditional.
- **D3 — b-research dispatch drift.** `GLOBAL_OR_PROJECT-AGENTS.md` mandates always delegating
  `b-research` to a background subagent; `skills/b-research/SKILL.md` contains no dispatch language
  at all (`grep` for `subagent|background|delegate|parallel|task(` → 0 hits). Fix: add the dispatch
  section.

Acceptance: every `docs/agents/*.md` path referenced by a skill resolves on disk;
`npm pack --dry-run` lists `THIRD-PARTY-NOTICES.md`; the b-research skill body and the bootstrap
paragraph agree.
