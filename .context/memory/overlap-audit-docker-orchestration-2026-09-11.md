---
date: 2026-09-11
domains: [audit, agent-skills, docs]
topics: [overlap-audit, jz-skills, docker-orchestration, superpowers-lineage, methodology-comparison, html-report]
related: [".context/2026-09-11.resumator-docker-orchestration-overlap/research-overlap-findings.md"]
priority: high
status: completed
subject: 2026-09-11.resumator-docker-orchestration-overlap
artifacts:
  - .context/2026-09-11.resumator-docker-orchestration-overlap/research-overlap-notes.md
  - .context/2026-09-11.resumator-docker-orchestration-overlap/research-overlap-findings.md
  - .context/2026-09-11.resumator-docker-orchestration-overlap/research/*.md
  - presentations/2026-09-11.buck-vs-docker-orchestration-overlap/index.html
---

# Overlap audit — buck-workflow-pi vs resumator/docker-orchestration `.claude`

## What was asked
Evaluate overlap between this repo and `resumator/docker-orchestration/tree/master/.claude`; explore both,
catalogue and organise the skills, compare methodology; produce an HTML report for a junior-engineer /
product-manager audience with a right-sidebar TOC. Explicitly read-only on both repos.

## Pins
- LOCAL `f797174` (2026-09-09) — 53 skills (54 dirs, `_shared` is a protocol registry), 33 prompts, 37 commands.
- UPSTREAM `1fea15e` (2026-09-09) — INTERNAL visibility, 24 skills, 105 files under `.claude/`.
- Upstream is not public: `git clone` over HTTPS 404s; `gh repo clone` works with the existing token.

## Method
Seven read-only scouts catalogued the local suite in six disjoint clusters plus the upstream company tail;
the upstream workflow spine was read directly by the main agent (a peer library's value is a single rule
inside an otherwise-familiar skill, which does not survive summarisation). A scribe subagent turned the
persisted reports into the findings artifact while the main agent built the HTML.

## Outcome
- **Verdict:** same genre, opposite halves. buck is broad + artifact-centric; jz is narrow + gate-centric.
  No stage is a straight duplicate: 3 strong, 3 partial, 2 adjacent across the 8 lifecycle stages.
- **Biggest buck gap:** the build station — jz has `jz-plan-executor` (fresh implementer per task, per-task
  review gate, resumable on-disk ledger), an enforced TDD law, `jz-debug`, and a persistent restraint lens.
  buck has one builder skill and **no debugging skill**, while its bootstrap routes bug work to a
  "systematic-debugger" role — second independent audit to find this.
- **Biggest jz gap:** durable memory and meaning — its session record lives outside git and its rules ban
  rationale from repo files.
- **Shared ancestry:** 7 jz skills are declared MIT ports of `obra/superpowers` v6.1.0 (`f268f7c`), with
  `.claude/skills/ATTRIBUTION.md` carrying the full licence text and a per-skill port table. That file is a
  working template for buck's already-locked 2026-09-10 attribution remediation.
- **Three conventions worth copying on their own merits:** "iteration is a mode, never a name" (one read-only
  pass unless a caller passes an explicit greppable `loop` scope), `jz skill-lint check` in CI (name==dirname,
  every cited path resolves, every named sub-skill/command target exists), and a `skills/RETIRED` tombstone
  file without which an installer can never uninstall a renamed skill.

## Deliverable
`presentations/2026-09-11.buck-vs-docker-orchestration-overlap/index.html` — 12 sections, sticky
right-sidebar TOC with scrollspy, an 8-stage pipeline rail, a 30-row capability scorecard, 18 adoption
cards. Verified headlessly: zero dead anchors, zero horizontal overflow at 320/360/390/414/768/820/1024/
1100/1280/1440/1600 px, mobile TOC toggle functional.

## Notes for next time
- `minmax(330px,1fr)` in an `auto-fit` grid overflows below ~370px; use `minmax(min(330px,100%),1fr)`.
- An `overflow-x:auto` scroller only scrolls if every grid/flex ancestor has `min-width:0`; otherwise the
  page itself overflows.
- A single long `<code>` with `white-space:nowrap` is the most common source of mobile horizontal scroll.

## Check contract
Docs-only session — every changed path is under `.context/` or `presentations/`. Guardrails gate skipped
per the predicate in `AGENTS.md`.
