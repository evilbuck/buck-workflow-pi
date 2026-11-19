---
title: Rewrite SKILL.md bodies that instruct direct .context writes (Phase C)
status: active
priority: high
created: 2026-11-18
updated: 2026-11-18
completed: null
related:
  - skills/fix-pr/SKILL.md
  - skills/b-issue-create/SKILL.md
  - skills/code-review-universal/SKILL.md
  - skills/code-smells/SKILL.md
  - skills/b-graph/SKILL.md
  - skills/b-create-styleguide/SKILL.md
  - skills/b-eval-upstream-prs/SKILL.md
  - skills/b-pr-review-2-issues/SKILL.md
  - skills/b-plan-update/SKILL.md
  - .context/2026-11-18.workflow-state-routing-audit/plan-workflow-state-routing.md
---

# Phase C: skill instruction sweep — route writes through workflow_state

2026-11-18 audit found ~20 skills whose operative instructions bypass workflow_state.

## Cleanest violations (no protocol header, direct write instructions)

- `skills/fix-pr/SKILL.md:442-443,60,524` — "Always write `.context/memory/fix-pr-<pr>-…`
  and update `.context/memory/index.md`" — re-creates a second canonical store. Worst.
- `skills/b-issue-create/SKILL.md:43-47,69,82` — subject `items/<slug>.md`,
  `backlog/items/<slug>.md`, session memory + `memory/index.md`, all direct.
- `skills/code-review-universal/SKILL.md:58,180-185,314` — direct report artifacts
  (sibling `code-review/SKILL.md:144` routes through `workflow_state write` — make the pair consistent).
- `skills/code-smells/SKILL.md:66,196,248,285`; `skills/b-graph/SKILL.md:126`;
  `skills/b-create-styleguide/SKILL.md:86,309-310`; `skills/b-eval-upstream-prs/SKILL.md:18,63,228-229`;
  `skills/b-pr-review-2-issues/SKILL.md:11,64,66,94-95`; `skills/b-plan-update/SKILL.md:14,18-19`.

## Hybrid (protocol header present, operative steps still direct)

`b-backlog` (`:14,33-34,121`), `b-brainstorm` (`:12-14,55,103-107`), `b-plan`
(`:67-71,81`), `b-phase` (`:389-396,436`), `b-capture` (`:16,50,70-90`),
`b-explore` (`:20-21,31,72`), `b-research` (`:35-36,46,113`), `b-grill`
(`:135,277,413,481`), `b-recap` (reads only), `git-commit` (`:45-49` reads drafts).

## Fix pattern

Follow `skills/b-save/SKILL.md:38-42` and `skills/_shared/workflow-state-access.md`:
writes via `workflow_state` `write`/`correct`, lifecycle via `transition`;
`.context/<subject>/<logicalName>` named only as the optional repo-files projection;
mirrors/exports marked non-authoritative. Also apply the same edits to the packaged
duplicate under `plugins/buck-workflow/skills/` (or regenerate it via the sync script).

## Effort

Medium — `/b-build`. Mechanical once Phase A/B establish the patterns; no runtime code.
