---
date: 2026-09-10
status: completed
domains: [skills, workflow, tooling]
topics: [mattpocock-skills, skill-overlap, adoption-plan, provenance, buck-workflow]
subject: 2026-09-10.mattpocock-skills-overlap
informs: []
related:
  - presentations/2026-09-10.mattpocock-skills-overlap/index.html
priority: high
---

# Research — mattpocock/skills overlap with buck-workflow-pi

**Deliverable:** `presentations/2026-09-10.mattpocock-skills-overlap/index.html` (full report).
This file is the durable, greppable record of the findings.

## Sources

| What | Ref |
|---|---|
| Upstream | `github.com/mattpocock/skills` @ `3cca18b` (2026-09-04), 37 `SKILL.md` |
| Local | `buck-workflow-pi` @ `f797174` (2026-09-09), 54 canonical skills, 12,246 lines |

Read in full: all 18 `skills/engineering/*/SKILL.md`, plus `improve-codebase-architecture/HTML-REPORT.md`,
`codebase-design/DESIGN-IT-TWICE.md`, `triage/AGENT-BRIEF.md`, `domain-modeling/{CONTEXT,ADR}-FORMAT.md`,
four category READMEs; productivity `grilling` / `handoff` / `writing-for-agents` / `to-questionnaire`;
in-progress `implement-spec` / `retro` / `setup-ts-deep-modules`; misc `setup-pre-commit`.
Local side: four parallel read-only scouts produced contracts for 32 local skills.

## Provenance findings (action required, independent of adoption)

1. **Unattributed derivation.** `skills/b-grill-with-docs/CONTEXT-FORMAT.md` and `ADR-FORMAT.md` are
   near-verbatim copies of upstream `engineering/domain-modeling/`. `diff` shows only em-dash restyling
   plus three additive sections in CONTEXT-FORMAT (Relationships, Example dialogue, Flagged ambiguities);
   the ADR three-condition gate is verbatim. `grep -i 'mattpocock|aihero|total-typescript'` → no matches
   anywhere in the repo. The skill body self-describes as "`b-grill-me` plus doc awareness" and names no
   upstream. Add a provenance line to `SKILL.md` and both format files.

2. **Dangling config dependency.** `skills/b-issue-create/SKILL.md:37-39` reads
   `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`; `:177-191` and
   `skills/fix-pr/SKILL.md:247` use the `ready-for-agent` / `needs-triage` label vocabulary.
   Filesystem: `docs/agents/issue-tracker.md` MISSING, `docs/agents/triage-labels.md` MISSING,
   `docs/agents/domain.md` MISSING, `docs/adr/` MISSING, `CONTEXT.md` present.
   Upstream `setup-matt-pocock-skills` is the missing producer.

## Overlap summary

Buckets: duplicate / strong / partial / adjacent / none.

| upstream (engineering) | local counterpart | overlap | verdict |
|---|---|---|---|
| diagnosing-bugs | — | none | adopt P0 |
| code-review (2-axis parallel) | b-review + code-review-universal + code-smells | strong | patch b-review |
| tdd | b-build | strong | steal seams gate |
| domain-modeling | b-grill-with-docs + b-docs | duplicate | already ported (attribute) |
| grill-with-docs | b-grill-with-docs | duplicate | have it |
| research | b-research | strong (ours deeper) | fix background drift |
| resolving-merge-conflicts | b-fix-rebase-conflict | strong (ours deeper) | skip |
| implement | b-build | strong (ours deeper) | skip |
| to-spec | b-plan + b-nasa-prd + b-issue-create | strong | skip, steal 2 rules |
| to-tickets | b-phase | partial | steal ready frontier |
| improve-codebase-architecture | code-smells + b-blueprint | partial | merge idea |
| ask-matt | README + docs catalogs (not a skill) | partial | adopt adapted |
| triage | — (fix-pr / b-pr-review-2-issues are outbound) | none | adopt adapted |
| wizard | — | none | adopt |
| codebase-design | — | none | adopt as reference |
| prototype | design-brief / b-create-ux-guide (adjacent) | adjacent | adopt |
| wayfinder | b-phase / b-arch-qa | adjacent | evaluate later |
| setup-matt-pocock-skills | — (consumed by b-issue-create, fix-pr) | none | adopt trimmed P0 |

Other buckets: `writing-for-agents` (none → adopt), `handoff` (adjacent → adopt small),
`implement-spec` (partial vs b-auto-fix → steal frontier fan-out), `retro` (adjacent → adopt idea),
`to-questionnaire` (none → optional). Skipped: grilling/grill-me (duplicate), setup-pre-commit,
git-guardrails-claude-code, migrate-to-shoehorn, scaffold-exercises, setup-ts-deep-modules, teach,
wait-what, claude-handoff, loop-me, writing-beats/-fragments/-shape.

## Load-bearing differences (not cosmetic)

- **code-review**: upstream runs Standards and Spec as *parallel sub-agents* and forbids re-ranking
  across axes. We own both axes but in separate skills that never run together. `b-review` is
  single-agent with no fan-out.
- **tdd**: upstream gates on *pre-agreed seams* ("no test is written at an unconfirmed seam") and names
  the **tautological test** anti-pattern (assertion recomputes the expected value the way the code does).
  `b-build` confirms *behaviours*, not seams, and keeps refactor inside the loop.
- **grilling**: upstream asks *the whole frontier per round*, numbered, each with a recommended answer,
  and dispatches sub-agents for environment facts without blocking the rest of the frontier.
  `b-grill*` asks one question at a time (richer metadata, decision domains, threshold assessment,
  auto-mode RPC divergence — all things upstream lacks).
- **to-tickets / implement-spec**: `b-phase` already types dependencies HARD/SOFT/NONE and writes a
  matrix, then discards the parallelism by executing phase N → N+1. `b-auto-fix` runs one issue per
  worktree sequentially. Upstream works a ready frontier concurrently and merges into one PR.
  Upstream also has an expand–contract recipe for wide refactors that we have no equivalent for.
- **research**: bootstrap says "always delegate b-research to a subagent, run asynchronously";
  `skills/b-research/SKILL.md` describes no background dispatch. Live drift, not a porting need.

## Adoption plan (value ÷ effort)

P0:
1. Attribution note in `b-grill-with-docs` (10 min).
2. `b-init-tracker` — trimmed `setup-matt-pocock-skills`, Sections A+B only (1–2 h).
3. `b-diagnose` — port `diagnosing-bugs` (3–4 h).

P1:
4. `b-review` two-axis parallel + no-reranking + diff-scoped Fowler baseline (2–3 h).
5. `b-research` background dispatch (30 min).
6. `b-build` seams gate + tautological anti-pattern reference (1–2 h).
7. `codebase-design` reference skill (1 h).
8. `writing-for-agents` reference skill (1 h).
9. `b-handoff` (45 min).
10. `b-triage` — needs #2 first (3–4 h).
11. `b-wizard` + `template.sh` (1–2 h).

P2: `b-phase` ready frontier + expand–contract; `b-prototype`; `b-grill` round-frontier mode;
`b-auto-fix` frontier concurrency; `code-smells` depth axis + b-blueprint visuals; `b-which` router
generated from the catalog; `b-retro`; `wayfinder` (gate on b-triage success).

## Integration classification

- **Fold into existing skills**: b-review, b-build, b-research, b-grill*, b-phase, b-auto-fix.
- **New loop members**: b-diagnose (on-ramp), b-triage (inbound on-ramp), b-prototype (intake detour),
  b-handoff (session boundary), b-init-tracker (one-shot init beside b-init-guardrails).
- **Standalone references, no loop position**: codebase-design, writing-for-agents, b-wizard, b-retro.

## Suggested first slice

Three P0s + `b-research` dispatch + `b-handoff` = one session. Removes two live inconsistencies
(unattributed copy, dangling config) and adds the largest missing capability (debugging).
