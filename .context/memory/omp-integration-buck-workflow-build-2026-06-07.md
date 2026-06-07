---
date: 2026-06-07
domains: [implementation, buck-workflow, omp, planning, docs]
topics: [omp, buck-workflow, goal-mode, orchestrate-keyword, workflow-keyword, slash-commands, eval-kernel, b-phase, b-plan, b-review, b-flow-deprecation, autonomous-loops]
related:
  - ./omp-integration-buck-workflow-2026-06-06.md
  - ../2026-06-06.omp-integration-buck-workflow/
  - ../2026-06-01.deprecate-b-flow/plan-deprecate-b-flow.md
status: completed
priority: high
subject: 2026-06-06.omp-integration-buck-workflow
artifacts:
  - ../2026-06-06.omp-integration-buck-workflow/research-omp-integration.md
  - ../2026-06-06.omp-integration-buck-workflow/follow-ups.md
  - ../2026-06-06.omp-integration-buck-workflow/index.md
  - ../../prompts/omp-orchestrate.md
  - ../../prompts/omp-workflow.md
  - ../../prompts/omp-goal.md
  - ../../prompts/b-phase.md
  - ../../docs/buck-workflow.md
  - ../../AGENTS.md
  - ../../skills/b-phase/SKILL.md
  - ../../skills/b-plan/SKILL.md
  - ../../skills/b-review/SKILL.md
---

# omp × buck-workflow build (2026-06-07)

## What I built

Implemented F1–F7 from the 2026-06-06 follow-ups:

- **F1 — Three slash-command stubs** (`prompts/omp-{orchestrate,workflow,goal}.md` + matching `commands/*.md` symlinks). Document each primitive's contract; the keyword itself is still user-driven.
- **F2 — `docs/buck-workflow.md` "OMP Autonomous Loops" section** (~100 lines) plus discoverability entries. Explains the three primitives, how buck-workflow surfaces them, what it does NOT do (no auto-insert of keywords), and four recommended workflow variations.
- **F3 — `AGENTS.md` OMP integration section** — one-liner with cross-references to docs, the b-flow deprecation, and the slash-command stubs.
- **F4 — `omp_execution` field on phase files** in `skills/b-phase/SKILL.md`. Added `omp_execution: none | orchestrate | workflow | goal` and `omp_goal_budget: <tokens>` to the phase file frontmatter template. New table in the Ralph Mini-Cycle Instructions describing the first-turn precondition per mode. New `omp_execution` column in the phases-overview summary table. New `prompts/b-phase.md` (so `/b-phase` is invokable as a slash command) and matching `commands/b-phase.md` symlink.
- **F5 — `b-plan` recommendation rules** in `skills/b-plan/SKILL.md`. New "OMP Execution Recommendation" section with a 5-row trigger table. First match wins; multiple matches prefer the strongest (goal > workflow > orchestrate > none). `omp_goal_budget` estimation: 4k per easy, 8k per medium, 16k per hard phase, summed and rounded to 5k.
- **F6 — Eval cell template for `workflow` plans** in `skills/b-plan/SKILL.md`. New "Eval Cell Template for `workflow` Plans" section with a 4382-byte starter `.py` cell that fans one `agent()` per phase, runs a barrier-stage `pipeline()` synthesis, judges via `llm()`, and surfaces the verdict through `log()`. Verified the template parses with `ast.parse`. The cell is a **deliverable artifact** (not a hint) for verifiability.
- **F7 — `b-review` 6-step completion-audit protocol** in `skills/b-review/SKILL.md`. New "Goal-Mode Completion-Audit Protocol" section mirroring `goal-continuation.md`. Tightened the per-step matrix rules: `✅ complete` requires file:line evidence; `🔄 partial` must name the missing piece; `❌ missing` pairs with a fix proposal; `⚠️ not-verifiable` must state the reason. Added a goal-mode-specific block for sessions with an active goal.

## Decisions made

- **All integration is prompt-level / skill-level.** No new Pi extensions, no new state machines. Lesson from the b-flow deprecation (`.context/2026-06-01.deprecate-b-flow/`) is cross-referenced in every new doc/skill.
- **`omp_execution: none` is the default — field is omitted from frontmatter.** Backward-compatible: existing phase files keep working.
- **`b-plan` recommends, never auto-sets.** The user confirms.
- **Python over JavaScript** for the eval cell — matches the workflow-notice examples and the agent's prior experience.
- **Default `omp_goal_budget` estimate** uses a 4k/8k/16k-per-phase rule, rounded to 5k.

## Verification

- `diff <(ls prompts/) <(ls commands/)` shows the two directories are in sync (14 → 17 entries).
- `package.json` validates with both `pi.*` and `omp.*` keys present.
- All 11 test files / 163 tests pass (`npx vitest run`).
- The eval cell template parses cleanly with `ast.parse` (4382 bytes extracted, 0 syntax errors).
- Fence counts in all three edited skills are even (b-phase: 16, b-plan: 16, b-review: 10) — no unclosed code blocks.
- `grep -c` confirms `omp_execution` (8×) and `omp_goal_budget` (4×) in b-phase; OMP Execution Recommendation in b-plan; Eval Cell Template in b-plan; Goal-Mode Completion-Audit Protocol in b-review.

## Diff summary

```
 .context/memory/index.md |   1 +
 AGENTS.md                |   4 ++
 docs/buck-workflow.md    | 108 +++++++++++++++++++++++++++-
 skills/b-phase/SKILL.md  |  49 ++++++++++---
 skills/b-plan/SKILL.md   | 182 +++++++++++++++++++++++++++++++++++++++++++++++
 skills/b-review/SKILL.md |  64 +++++++++++++++--
 6 files changed, 392 insertions(+), 16 deletions(-)
```

Plus 7 new files:

- `prompts/omp-orchestrate.md`, `prompts/omp-workflow.md`, `prompts/omp-goal.md` (F1)
- `prompts/b-phase.md` (F4 — new prompt)
- `commands/b-phase.md`, `commands/omp-orchestrate.md`, `commands/omp-workflow.md`, `commands/omp-goal.md` (F1 + F4 symlinks)

## Open follow-ups

F8 (`b-save` goal-budget-aware) and F9 (`b-grill*` feeding the workflow-kernel cell) remain from the original follow-ups list — both are noted as hardening work, not in this build's scope. The b-flow deprecation lesson is cross-referenced in all three new doc/skill locations to prevent re-introducing extension-based orchestration.

## Next step

User can:
1. Commit the changes with `/git-commit`.
2. Open a Ralph loop with the new phase field as the source: read the phases overview, find the first non-completed phase, follow the `omp_execution` precondition.
3. Try `/omp-orchestrate`, `/omp-workflow`, `/omp-goal` in an omp TUI session to confirm discoverability.
