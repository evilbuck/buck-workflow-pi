---
date: 2026-09-29
domains: [docs, workflow, extensions]
topics: [sql-memory, bootstrap, recall, agent-discovery]
related:
  - GLOBAL_OR_PROJECT-AGENTS.md
  - extensions/sql-memory/index.ts
  - skills/_shared/recall-project-memories.md
  - plugins/buck-workflow/skills/_shared/recall-project-memories.md
  - docs/sql-memory.md
  - docs/howto/recall-project-memories.md
  - docs/CHANGELOG.md
priority: medium
status: completed
subject: 2026-09-29.sql-memory-discovery
artifacts: [plan-sql-memory-discovery.md]
---

# SQL memory discovery outside Buck skills

## Outcome

Added an always-loaded SQL recall policy to the installable bootstrap. Recall is relevant for explicit prior-work questions or tasks that could depend on project decisions, conventions, pitfalls, or previous attempts. Self-contained tasks and already-supplied relevant supervisor recall skip redundant queries. The bootstrap points to the installed shared recall protocol, including OMP's `skill://_shared/recall-project-memories.md` and other harnesses' installed skills directories.

Aligned the shared protocol and its physical Codex copy. Tool description and prompt snippet now explain recall purpose and triggers. Updated canonical SQL docs, recall how-to, and changelog. Kept existing project identity, bounded parameterized SQL, stage permissions, supervisor routing, and save behavior unchanged. Ordinary lookup requires no Jev approval; no new automated query/skip gate was implemented.

## Verification

- Actual `wire()` registration smoke printed the new description/snippet and passed policy checks. Registration used an unused URL in a throwaway process; no database connection or query occurred.
- Loaded the updated protocol through `skill://_shared/recall-project-memories.md`.
- Extracted the protocol's SQL and passed it through the production `checkSqlStatement` gate. Canonical/Codex byte parity and updated documentation link targets passed.
- Focused existing suites: `extensions/sql-memory/index.test.ts`, `extensions/sql-memory/sql-gate.test.ts`, `scripts/codex-plugin.test.ts`, and `scripts/skill-frontmatter.test.ts`: 4 files passed; 69 tests passed, 1 skipped.
- `npm run guardrails:check`: durable v2 pass. Required unit, global ratchet, and complexity gates passed. Coverage 87 versus baseline 84; 30 existing complexity hotspots, no new or hard-ceiling violations. Lint/functional disabled and skipped; patch advisory with no numeric result. Baselines were not changed.
- Inline acceptance and standards review: installed-protocol pointer is explicit; no new SQL execution, schema, permissions, runtime allocations, or mandatory judgment dependency; unavailable/failed tooling remains distinct from empty results. Verification covers policy exposure and protocol compatibility, not a guarantee that every model follows the instructions.

## Availability and deployment

SQL/Jev and harness memory devices are unmounted in this session, so this is a file-mode save. No attempt was made to query or write the shared database through another mechanism.

The installed OMP global bootstrap resolves to `/home/buckleyrobinson/.pi/agent/AGENTS.md`, not this repository's bootstrap. Repository changes do not update that separate copy; personal dotfiles were intentionally left untouched. The installed bootstrap needs syncing to activate this policy outside projects that load the updated source.

Backlog intentionally unchanged: no existing item was completed by this direct request and no new required implementation work was identified. The optional Jev pre-query router remains outside scope. Changes remain unstaged; the git-commit skill prohibits automatic staging.
