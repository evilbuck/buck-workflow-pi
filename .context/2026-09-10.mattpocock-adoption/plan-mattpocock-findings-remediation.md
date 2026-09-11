---
status: completed
date: 2026-09-10
subject: 2026-09-10.mattpocock-adoption
topics: [mattpocock-skills, adoption, provenance, license, b-diagnose, b-review, skill-catalog]
research: [../2026-09-10.mattpocock-skills-overlap/research-mattpocock-skills-overlap.md]
phases: plan-mattpocock-findings-remediation-phases.md
iterations: []
spec:
memory: []
---

# Plan: mattpocock/skills findings — remediation & adoption

## User Goal

A buck-workflow user gets a debugging on-ramp that does not exist today (`/b-diagnose`),
review that runs both the standards and spec axes without one masking the other, and a repo
whose shipped skills do not read config files that were never written. Secondary beneficiary:
downstream consumers of this public package, who currently receive MIT-licensed third-party
text with no notice.

## Goal

Close the three live defects the 2026-09-10 audit found, then adopt the upstream capabilities
this repo genuinely lacks — in defect-first, dependency-respecting priority order. Everything
the audit classified P2 is explicitly deferred to the backlog, not silently dropped.

## Context used / assumptions

- **Audit source**: `.context/2026-09-10.mattpocock-skills-overlap/research-mattpocock-skills-overlap.md`
  and `presentations/2026-09-10.mattpocock-skills-overlap/index.html` (37 upstream skills @ `3cca18b`
  vs 54 local @ `f797174`).
- **New finding, not in the report** — upstream `mattpocock/skills` ships **MIT © 2026 Matt Pocock**
  (`https://raw.githubusercontent.com/mattpocock/skills/main/LICENSE`, HTTP 200, verified 2026-09-10).
  MIT §"substantial portions" requires the copyright + permission notice travel with the copy.
  `skills/b-grill-with-docs/{CONTEXT,ADR}-FORMAT.md` are near-verbatim copies shipped in an
  npm-published package (`package.json` `files:` includes `skills`). This is a **license-compliance
  defect**, not a courtesy gap — the fix is a notice, not a "derived from" sentence.
- **Ordering deviates from the report** on two points, both justified below in the ledger:
  1. `b-research` background-dispatch drift is promoted from P1 to the defect tier (it is a live
     contradiction with always-on bootstrap policy, same class as the other two).
  2. The report's P0 #2 (`b-init-tracker`) is **split**: fixing the dangling read is a 30-minute
     repo-local fix; generalizing it into a new init skill is a separate, optional adoption. This
     also removes `b-init-tracker` from `b-triage`'s critical path as a blocker for the defect tier.
- **Verified repo state (2026-09-10):**
  - `grep -i 'mattpocock|aihero|total-typescript'` over `skills/ docs/ README.md AGENTS.md` → **no matches**.
  - `skills/b-issue-create/SKILL.md:37-39` lists `docs/agents/issue-tracker.md` and
    `docs/agents/triage-labels.md` under **"Inputs to gather"** — unconditional, no "if present" guard.
    Neither file exists. `SKILL.md:228` already guards the *label* half ("Do not assume `ready-for-agent`
    exists"), so only the doc reads are unguarded.
  - `skills/fix-pr/SKILL.md:247` uses the same label vocabulary.
  - `skills/b-research/SKILL.md` contains **zero** occurrences of `subagent|background|delegate|parallel|task(`.
- **Per-skill delivery surface in this repo** (drives the effort numbers): `skills/<n>/SKILL.md`
  + `prompts/<n>.md` + `commands/<n>.md` (symlink → `../prompts/<n>.md`) + 2 README catalog tables
  (slash-command ~L235, OMP mirror ~L269) + 3 `docs/buck-workflow.md` sites (primitives ~L28,
  quick-reference ~L397, full section body). Seven new skills = ~42 catalog touchpoints.
- **Adoption style assumption**: ported skills are *rewritten to this repo's conventions* (frontmatter,
  `_shared` protocols, subject-folder discipline, capability probe where relevant), not copy-pasted.
  Where upstream prose is lifted substantially, the notice from Tier 0 covers it.

## Priority ledger

Ordering rule: **live defects → largest capability hole → composition patches → new members → deferred**.
Within a tier, cheapest-first, dependencies respected.

### Tier 0 — Live defects (repo is wrong today)

| # | Item | Why this rank | Depends on | Effort |
|---|---|---|---|---|
| D1 | MIT notice + provenance for `b-grill-with-docs/{CONTEXT,ADR}-FORMAT.md` | License condition on a **published** package. Cheapest item in the plan and the only one with a legal dimension. | — | 30 min |
| D2 | Write `docs/agents/{issue-tracker,triage-labels}.md`; guard the reads in `b-issue-create` | Two shipped skills gather config that does not exist. Users hit it on first `/b-issue-create`. | — | 45 min |
| D3 | `b-research` background/subagent dispatch | `GLOBAL_OR_PROJECT-AGENTS.md` mandates "always delegate to a subagent, run asynchronously"; the skill body describes a foreground procedure. Always-on policy contradicted by a shipped skill. | — | 30 min |

### Tier 1 — Largest capability hole

| # | Item | Why this rank | Depends on | Effort |
|---|---|---|---|---|
| A1 | `codebase-design` reference skill | Prerequisite vocabulary (module/interface/depth/**seam**/adapter/leverage/locality, deletion test) for A2 and for the Tier 2 seams gate. Cheap and unblocks two consumers. | — | 1 h |
| A2 | `b-diagnose` (port `diagnosing-bugs`) | The bootstrap task-routing table sends "reproducible bug, runtime error" to a *systematic-debugger* role **with no skill behind it**. `b-build` assumes you know what to build; `b-iterate` assumes the defect is already written down. Nothing owns "it's broken and we don't know why". | A1 (Phase-5 seam handoff) | 3–4 h |

### Tier 2 — Composition patches to existing loop skills

| # | Item | Why this rank | Depends on | Effort |
|---|---|---|---|---|
| C1 | `b-review`: parallel Standards axis + no-reranking rule | Both axes already exist locally (`b-review` = spec, `code-review-universal`/`code-smells` = standards); only composition is missing. Highest value per hour of the patch tier. | — | 2–3 h |
| C2 | `b-build`: pre-agreed **seams** gate + tautological-test anti-pattern | Turns "confirm behaviours" into "confirm seams"; names a failure the global bootstrap's anti-padding rule does not cover (assertion recomputes the expected value the way the code does). | A1 | 1–2 h |

### Tier 3 — New members and references

| # | Item | Why this rank | Depends on | Effort |
|---|---|---|---|---|
| N1 | `b-handoff` | Cheapest new member. Cross-harness/-directory/-machine seed doc; neither `b-recap` (chat-only) nor `b-save` (historical record) produces one. | — | 45 min |
| N2 | `writing-for-agents` reference | This repo's product *is* agent-consumed documents, and it has no authoring standard. Also serves the open bootstrap-consolidation work. | — | 1 h |
| N3 | `b-init-tracker` (trimmed `setup-matt-pocock-skills`, Sections A+B) | Generalizes D2 from "this repo" to "any repo". Same idempotent managed-block pattern as `b-init-guardrails`. | D2 (shape) | 1–2 h |
| N4 | `b-triage` | Only missing **inbound** stage — every issue-facing skill we own points outward. Produces the `ready-for-agent` state `b-auto-fix` requires as input. | N3 | 3–4 h |
| N5 | `b-wizard` + `template.sh` | Nothing local generates a runnable script for a **human** (credentials, dashboards, cutovers). Template does the work; skill is thin. | — | 1–2 h |

### Tier 4 — Deferred (backlog, not this plan)

`b-phase` ready-frontier + expand–contract · `b-prototype` · `b-grill` round-frontier mode ·
`b-auto-fix` frontier concurrency · `code-smells` depth axis + `b-blueprint` visuals ·
`b-which` router generated from the catalog · `b-retro` · `wayfinder` (gate on N4 proving the
tracker integration). Rejected outright (audit §08): `implement`, `to-spec`, `resolving-merge-conflicts`,
`setup-pre-commit`, `git-guardrails-claude-code`, `migrate-to-shoehorn`, `scaffold-exercises`,
`setup-ts-deep-modules`, `teach`, `wait-what`, `claude-handoff`, `loop-me`, `writing-beats/-fragments/-shape`,
`to-questionnaire`.

## Scope

- Tier 0 (D1–D3), Tier 1 (A1–A2), Tier 2 (C1–C2), Tier 3 (N1–N5): 12 deliverables.
- Full wrapper + catalog wiring for every new skill (prompt, command symlink, 2 README rows,
  3 `docs/buck-workflow.md` sites).
- Backlog items for Tier 4, one per deliverable, so nothing is lost.

## Out of scope

- Tier 4 items themselves — backlogged, not built.
- Re-litigating the audit's overlap classifications or the rejected list.
- Porting the upstream **workflow spine** (`grill → to-spec → to-tickets → implement → code-review`);
  the audit's finding is that ours is deeper at every station.
- Rewriting `CONTEXT-FORMAT.md`/`ADR-FORMAT.md` to remove the derivation. The notice makes the copy
  compliant; a rewrite would lose reviewed content for no benefit.
- Relicensing this repo (already MIT; compatible).

## Affected files

**Tier 0**
- `THIRD-PARTY-NOTICES.md` (new, repo root; add to `package.json` `files:`)
- `skills/b-grill-with-docs/{SKILL.md,CONTEXT-FORMAT.md,ADR-FORMAT.md}`
- `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md` (new)
- `skills/b-issue-create/SKILL.md` (L37-39 guard), `skills/fix-pr/SKILL.md` (L247 cross-ref)
- `skills/b-research/SKILL.md`

**Tier 1–3 (per new skill: 6 surfaces)**
- `skills/{codebase-design,b-diagnose,b-handoff,writing-for-agents,b-init-tracker,b-triage,b-wizard}/SKILL.md`
- `skills/b-wizard/template.sh`, `skills/b-build/references/seams.md`
- `prompts/<n>.md` + `commands/<n>.md` symlinks for the four slash-invoked members
  (`b-diagnose`, `b-handoff`, `b-init-tracker`, `b-triage`, `b-wizard`); `codebase-design` and
  `writing-for-agents` are model-invoked references with **no** wrapper (precedent: `fix-pr`)
- `skills/b-review/SKILL.md`, `skills/b-build/SKILL.md`
- `README.md` (slash-command table, OMP mirror table), `docs/buck-workflow.md` (3 sites each)
- `.context/backlog/items/*.md`, `.context/backlog/todo.md`

## Implementation steps

1. **D1** — Add `THIRD-PARTY-NOTICES.md` with the upstream MIT text and copyright line; add a
   provenance header to both format files and a one-line origin note in
   `skills/b-grill-with-docs/SKILL.md`; add the notice file to `package.json` `files:`.
2. **D2** — Write `docs/agents/issue-tracker.md` (GitHub, `evilbuck/buck-workflow-pi`) and
   `docs/agents/triage-labels.md` (label vocabulary incl. `ready-for-agent`/`needs-triage` and what
   each gates). Change `b-issue-create/SKILL.md:37-39` to read them **when present**; cross-reference
   from `fix-pr/SKILL.md:247`.
3. **D3** — Add a dispatch section to `skills/b-research/SKILL.md`: delegate to a background subagent
   by default, name the OMP (`task`) and portable fallbacks, state the foreground exception.
4. **A1** — Port `codebase-design` as a model-invoked reference: the seven terms, depth-as-leverage,
   deletion test, "one adapter is hypothetical, two is real", `DESIGN-IT-TWICE.md` fan-out.
5. **A2** — Port `b-diagnose`: 6 phases with Phase 1 (tight red-capable loop before any hypothesis)
   as the gate; 10 ranked loop constructions; 3–5 falsifiable hypotheses; instrument; regression test;
   clean up tagged logs. Wire exits → `b-iterate` (fix in place), `b-plan` (architectural),
   `code-smells` (Phase 5 "no correct seam exists" is itself the finding).
6. **C1** — Patch `b-review`: run the standards pass as a parallel `task` sub-agent seeded with
   `code-review-universal` guides and a **diff-scoped** subset of the `code-smells` catalog, so it
   cannot pollute the acceptance-contract context; add the no-reranking rule (report per-axis worst
   finding, never a single merged ranking).
7. **C2** — Add `skills/b-build/references/seams.md` and one line to the TDD Plan step: name and
   confirm the seams under test before the first RED; lift the tautological-test anti-pattern.
8. **N1** — `b-handoff`: writes to the OS temp dir (not the workspace), "suggested skills" section,
   references artifacts by path/URL instead of duplicating, redacts secrets.
9. **N2** — `writing-for-agents`: context load vs cognitive load, information hierarchy, completion
   criteria, leading words, the no-op test, prompt-the-positive.
10. **N3** — `b-init-tracker`: Sections A (tracker) + B (labels) only; idempotent managed block
    mirroring `b-init-guardrails`. Section C (domain docs) is already `b-docs` + `CONTEXT.md`.
11. **N4** — `b-triage`: redundancy/prior-rejection check → verify the claim (reproduce/checkout) →
    grill → durable behavioural agent brief (no file paths/line numbers) → `.out-of-scope/` KB.
12. **N5** — `b-wizard` + `template.sh`: staged progress, confirmation gates, cross-platform URL open
    (incl. WSL), hidden secret entry, idempotent `.env` upsert, `gh secret` write. Verify statically.
13. **Catalog wiring** — for each new slash-invoked skill: prompt, command symlink, 2 README rows,
    3 `docs/buck-workflow.md` sites. Re-read the README tail after each table insert (known
    clobber hazard on this repo's long tables).
14. **Backlog** — one item per Tier 4 deliverable in `.context/backlog/items/`, linked from `todo.md`.

## Acceptance criteria

- [x] `grep -ri 'mattpocock' .` returns matches in `THIRD-PARTY-NOTICES.md`, both format files, and
      `skills/b-grill-with-docs/SKILL.md`; the upstream MIT copyright line is present verbatim.
- [x] `npm pack --dry-run` lists `THIRD-PARTY-NOTICES.md`.
- [x] `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` exist; `b-issue-create` reads
      them conditionally; no skill references a path that does not exist.
- [x] `skills/b-research/SKILL.md` states background-subagent dispatch as the default and matches
      `GLOBAL_OR_PROJECT-AGENTS.md` § b-research verbatim in intent.
- [x] `/b-diagnose` resolves in a reloaded session and refuses to hypothesize before a named command
      has gone red on the reported bug.
- [x] `b-review` spawns the standards axis as a separate agent and reports per-axis findings with no
      cross-axis ranking.
- [x] `b-build`'s TDD Plan step requires named, confirmed seams before the first RED.
- [x] Every new skill resolves by name in a reloaded session and appears in both README tables and
      all three `docs/buck-workflow.md` sites.
- [x] `README.md` and `docs/buck-workflow.md` tails are intact after every table edit (byte-compare
      against `HEAD` for unrelated sections).
- [x] Tier 4 has one backlog item per deliverable, each linked from `todo.md`.
- [x] `/b-guardrails-check` verdict recorded (durable v2 contract — the "none" premise was stale;
      recorded verbatim for Phases 1 and 4, see session memory).

## Verification

- **D1**: `grep`; `npm pack --dry-run | grep THIRD-PARTY`; visual diff of both format files vs upstream
  showing only the added header.
- **D2**: `grep -o 'docs/agents/[a-z-]*\.md' skills/**/*.md | sort -u` — every hit resolves on disk.
- **D3**: side-by-side of the bootstrap paragraph and the new skill section.
- **New skills**: reload the session and probe each by exact name (loader-native resolution, not a
  filesystem read — a readable `SKILL.md` is not evidence it loaded); drive `/b-diagnose` against a
  deliberately broken fixture and confirm it blocks at Phase 1 without a red command.
- **C1**: run `b-review` on a real diff; confirm two agent outputs and no merged ranking.
- **Catalogs**: `git diff --stat` on `README.md`/`docs/buck-workflow.md` shows only additive hunks.
- Docs-only tiers skip the code gate; any tier touching `scripts/` or `package.json` runs
  `/b-guardrails-check` before close.

## Execution Instructions

This plan exceeds every `b-phase` threshold (12 deliverables, 30+ files, 4 dependency edges,
~20 h). **Phased on 2026-09-10 → [plan-mattpocock-findings-remediation-phases.md](plan-mattpocock-findings-remediation-phases.md).**
Read the overview, not this section, before building. The split below is what was produced,
one phase per tier:

| Phase | Contents | Gate | omp_execution | File |
|---|---|---|---|---|
| 1 | D1, D2, D3 + Tier-4 backlog | HARD — defects ship first; nothing else starts until the repo is self-consistent | `orchestrate` | [phase-1-live-defects.md](phase-1-live-defects.md) |
| 2 | A1, A2 | HARD on A1 → A2 | none | [phase-2-design-vocabulary-and-diagnose.md](phase-2-design-vocabulary-and-diagnose.md) |
| 3 | C1, C2 | SOFT on Phase 2 (C2 wants A1's vocabulary) | none | [phase-3-loop-composition-patches.md](phase-3-loop-composition-patches.md) |
| 4 | N1, N2, N5 | NONE — independent, parallelizable | `orchestrate` | [phase-4-independent-new-members.md](phase-4-independent-new-members.md) |
| 5 | N3, N4 | HARD N3 → N4; also HARD on Phase 1 (D2 defines N3's config shape) | none | [phase-5-tracker-init-and-triage.md](phase-5-tracker-init-and-triage.md) |

Two deviations from this section's original sketch, both recorded in the overview's Notes:
1. **Tier-4 backlog capture (step 14) folded into Phase 1**, so the deferred list survives if
   execution stops after the defects — which is this plan's own Q4 default recommendation.
2. **`orchestrate` is stamped per-phase, not plan-wide.** It only pays where a phase holds ≥ 2
   disjoint work units: Phases 1 and 4. Phases 2 and 5 are internally sequential; Phase 3 is two
   careful edits to core loop skills where fan-out buys nothing.

Per phase: `/b-build` → `/b-review` → `/b-iterate` (in-plan only) → `/b-docs` if doc impact →
`/b-save` → `/b-commit`. Out-of-plan findings spawn a separate `/b-plan`, they do not block.

## Light Grill

- Q1: Is the license finding enough to reclassify D1, or is a rewrite of the two format files
  preferred? → **resolved (decision recorded):** notice, not rewrite. MIT permits the copy with
  notice; a rewrite discards reviewed content and re-introduces drift from upstream.
- Q2: Fix the dangling config by writing repo-local docs, or by porting `b-init-tracker`?
  → **resolved:** both, split across tiers. The defect is repo-local and cheap (D2); the generalized
  producer is an optional adoption (N3). Splitting removes `b-init-tracker` from the defect critical
  path and from `b-triage`'s blocker chain.
- Q3: Should `codebase-design` / `writing-for-agents` get slash wrappers? → **resolved:** no.
  Model-invoked references with no loop position; `fix-pr` is the precedent for skill-only delivery.
- Q4: How much of the plan is one execution envelope? → **deferred to user.** Default recommendation:
  Phase 1 alone this session (3 defects, ~2 h, closes both live inconsistencies), then reassess.

## Risks

- **Catalog churn is the real cost.** Seven new skills × 6 surfaces ≈ 42 touchpoints across two long
  markdown tables with a documented clobber history (2026-09-04 `b-recap` insert deleted the README
  tail). Mitigation: re-read the file tail after every table edit; byte-compare unrelated sections.
  This is the strongest argument for pulling Tier 4's `b-which` (catalog-generated router) forward —
  if the catalog were generated, this risk would be structural rather than per-edit.
- **Skill-count inflation.** 54 → 61 skills with no in-agent router makes discovery worse before it
  gets better. `b-which` is deferred; if Phase 4 lands, promote it.
- **`b-triage` is tracker-coupled.** It assumes GitHub labels exist and are writable. If N3's config
  shape is wrong, N4 is rework. Mitigation: N3 ships and is used against this repo before N4 starts.
- **`b-review` fan-out cost.** A parallel standards agent doubles review token spend on every run.
  Mitigation: diff-scoped catalog subset, not the full 23 smells; measure on a real diff before
  making it the default.
- **Port fidelity.** Rewriting upstream skills into this repo's conventions can silently drop the
  load-bearing rule (e.g. `b-diagnose`'s Phase-1 refusal). Mitigation: each port's acceptance
  criterion names the specific rule that must survive.
- **No durable check contract.** The repo still returns `contract: "none"` (open backlog item
  `run-b-init-guardrails-on-repo.md`). Mostly-docs work makes this tolerable, but `b-wizard`'s
  `template.sh` and any `scripts/` change land unverified.
