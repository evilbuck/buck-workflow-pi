---
date: 2026-08-25
domains: [omp, buck-workflow, extensions]
topics: [plan-mode, hooks, plan-artifact, context-artifacts, opt-in-extension]
related: [memory-search-agnostic-2026-08-23.md]
priority: medium
status: completed
subject: 2026-08-25.omp-plan-artifact-extension
artifacts: [plan-omp-plan-artifact-extension.md, iterate-omp-plan-artifact-extension.md, extensions/plan-artifact.ts, extensions/plan-artifact.test.ts, extensions/index.ts, docs/oh-my-pi.md]
---

# OMP plan-mode → durable `.context` artifact (opt-in extension)

## User goal

When finishing OMP plan mode, automatically persist the plan into the
buck-workflow `.context/` structure instead of leaving it only in the
session-scoped `local://` directory. Explicitly opt-in; user chose the
heuristic-extension approach after being told no native hook exists.

## Key finding: OMP has no plan-exit hook

Verified against `@oh-my-pi/pi-coding-agent` 18.0.4 (`dist/types/extensibility/hooks/types.d.ts`):

- Full hook surface: session lifecycle, `agent_start/end`, `turn_start/end`,
  `tool_call/result`, compaction, auto-retry, `ttsr_triggered`, `todo_reminder`.
- **No `mode_change` event, no `plan_approved`** — goal mode got `goal_updated`,
  plan mode got nothing.
- Plan-mode state is recorded only as session entries:
  `{"type":"mode_change","mode":"plan","data":{"planFilePath":"local://x-plan.md"}}`
  then `{"type":"mode_change","mode":"none"}` on exit (verified in real
  session `.jsonl` files).
- Compaction events carry no plan/reason field, so approval-compaction cannot
  be distinguished from ordinary compaction either.

## Implementation

`extensions/plan-artifact.ts` (wired via `extensions/index.ts`):

- On each `turn_end`, scan entries for the last `mode_change → "none"` whose
  preceding active mode (skipping `plan_paused`) was `plan` with
  `data.planFilePath`.
- Resolve `local://` → disk via `sessionManager.getArtifactsDir()` + `local/`
  (root composition confirmed from the bundled `resolveLocalRoot` impl).
- Copy to `.context/<YYYY-MM-DD>.<slug>/plan-<slug>.md` with b-plan frontmatter
  (`status/date/subject/source: omp-plan-mode/source_plan`) — `/b-build`
  subject resolution finds it.
- Stateless dedupe: a `plan-artifact` custom entry keyed by the exit entry id
  (reload-safe, no in-memory state).
- Opt-in default OFF: `{"buckPlanArtifact":{"enabled":true}}` in project
  `.pi`/`.omp` settings or global agent settings; `BUCK_PLAN_ARTIFACT=1|0`
  env override. Failure = silent no-op.

## Known limitations (surfaced to user before build)

- Fires at first `turn_end` after exit (post-approval), not at the approval instant.
- Cannot distinguish approval from abort; aborts without follow-up turns are naturally skipped.
- Depends on semi-internal `mode_change` entry shapes — re-verify on OMP upgrades.
- Tension with the deprecate-b-flow lesson ("no new extension-based
  orchestration") accepted: this is passive persistence, not orchestration.

## Verification

- `npx vitest run extensions/plan-artifact.test.ts` — 15 tests green,
  including one through the production `extensions/index.ts` default export.
- Full suite: 31 pre-existing infra failures (kamal/gh/worktree) unchanged
  before/after (git stash baseline comparison); zero new failures.
- LSP diagnostics clean on both files.
