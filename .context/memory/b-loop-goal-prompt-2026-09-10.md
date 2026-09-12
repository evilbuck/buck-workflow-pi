---
date: 2026-09-10
domains: [workflow, prompts, omp]
topics: [b-kickoff, b-loop, goal-mode, phased-plans, unattended-execution]
subject: 2026-09-10.b-kickoff-goal-prompt
artifacts:
  - prompts/b-kickoff.md
  - skills/b-loop/SKILL.md
related:
  - prompts/b-kickoff.md
  - skills/b-loop/SKILL.md
  - .context/backlog/items/b-loop-skill-and-mirror.md
priority: medium
status: completed
---

# OMP goal prompt for autonomous Buck loops

Created then renamed the unattended execution objective to `prompts/b-kickoff.md`. It resolves a subject or plan, phases when advised, runs each phase from `b-build` through review and any required iteration/re-review, follows skill handoffs for docs/how-to/save/commit, advances through all phases, and audits the full plan before goal completion.

Start with:

```text
/goal set Run the Buck workflow loop in prompts/b-kickoff.md for <subject-or-plan>
```

The prompt documents the required `/goal set` invocation rather than claiming it can activate goal mode itself. OMP requires the user to invoke `/goal`; prompt expansion cannot synthetically toggle that runtime state.

The existing `b-loop` skill remains advisory/stamping-only. Surface docs distinguish that skill from the kickoff objective. No `commands/b-kickoff.md` or `commands/b-loop.md` symlink in this session.

## Verification

- `prompts/b-kickoff.md` exists; `prompts/b-loop.md` is absent.
- Frontmatter, `$ARGUMENTS`, and the `/goal set` invocation are present.
- Docs-only change: deterministic code guardrails do not apply.

## Backlog

`items/b-loop-skill-and-mirror.md` stays **active** (F1–F3). F1 is now a launcher-surface decision, not "add prompts/b-loop.md as a skill mirror."
