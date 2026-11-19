---
title: Rewrite bootstrap/prompt references to point memory recall at workflow_state (Phase D)
status: active
priority: medium
created: 2026-11-18
updated: 2026-11-18
completed: null
related:
  - prompts/b-explore.md
  - prompts/b-research.md
  - prompts/code-review-universal.md
  - .context/2026-11-18.workflow-state-routing-audit/plan-workflow-state-routing.md
---

# Phase D: bootstrap + prompt reference rewrite

Every agent reads the OMP profile bootstrap before any skill loads, so its
instructions override the protocol headers in SKILL.md files. On 2026-11-18 this
document caused a full session of direct `.context/` hand-writes that bypassed
workflow_state entirely (discovered during the employ-context-engine postgres cutover).

## Sites

- `~/.omp/profiles/employ/agent/AGENTS.md` (outside this repo — the deploy target of
  this workflow's conventions): 12 `.context` references, including:
  - "Before starting ANY task: read `.context/memory/index.md`" (recall policy),
  - the `.context/` directory layout presented as canonical,
  - the "Memory Search Tool" section pointing non-OMP agents at `qmd`/
    `.claude/skills/memory-search`.
- `prompts/b-explore.md:2`, `prompts/b-research.md:2`, `prompts/code-review-universal.md:2`
  — descriptions still advertise "capture findings to .context/".

## Rewrite direction

- Recall: `workflow_state search` (text, optional kind/subjectId) as the primary
  memory-search mechanism; `artifact_search_text` is indexed on write.
- Durable memory: `workflow_state` `write` (kind memory) / `correct`.
- `.context/` named only as the repo-files projection/exports; legacy JSON quarantine
  (`migration-quarantine`) for unverified historical bodies.
- Note for the bootstrap: projects on repo-files keep today's behavior; projects on
  sqlite/postgres/external-files must not treat `.context/` as input.

## Effort

Easy — `/b-build`. Text-only; verify by running one save + one recall in both modes.
