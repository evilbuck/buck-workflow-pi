---
date: 2026-05-17
domains: [buck-workflow, docs, refactor]
topics: [global-agents, buck-mode, ownership-split, plan-mode, docs]
subject: 2026-05-17.global-agents-buck-workflow-mode
artifacts: [plan-global-agents-buck-workflow-mode.md, ownership-split.md, draft-commit.md]
related: []
priority: high
status: active
---

## Context

Executing plan from `.context/2026-05-17.global-agents-buck-workflow-mode/plan-global-agents-buck-workflow-mode.md`. Plan has 10 steps; plan itself recommends phasing or b-build-hard. Running b-build standard, scoped to documentation-focused steps.

## Decisions Made

1. **Ownership split documented** — created `ownership-split.md` mapping content into: keep global, move to global reference docs, move to Buck docs, move to Buck runtime.
2. **Global AGENTS trimmed** — reduced from ~250 to ~120 lines by removing Memory Rules, Backlog Rules, Plans/Specs/Research templates, and Buck workflow routing labels.
3. **Replaced with compact sections** — new "Context Conventions" (shared `.context/` principle + reference) and "Buck Workflow" (direct recommendation).
4. **Plan mode docs corrected** — removed stale `.md`/`.txt` from allowed paths in `docs/buck-workflow.md` (code already blocks these since planning-mode-write-guards session).
5. **Buck Workflow Mode section added** — documents planned `/b-mode` command, narrow auto-enable, session latching, and implementation status table.
6. **README.md updated** — added "Global vs Package Ownership" section documenting the 3-layer split.
7. **Global context-workflow.md updated** — added `.context/workflow/` to directory layout.

## Implementation Notes

### Changed Files
- `/home/buckleyrobinson/.pi/agent/AGENTS.md` — 3 edits: trimmed Persistent Artifacts, replaced Memory/Backlog/Plans/Workflow sections with Context Conventions + Buck Workflow, updated References
- `/home/buckleyrobinson/.pi/agent/docs/context-workflow.md` — 1 edit: added `.context/workflow/` to directory layout
- `docs/buck-workflow.md` — 4 edits: fixed plan mode allowed paths (3 blocks), added Buck Workflow Mode section (~90 lines)
- `README.md` — 1 edit: added Global vs Package Ownership section

### Not Changed (Deferred)
- `extensions/index.ts` — runtime mode state, `/b-mode` command, auto-enable heuristics (rated b-build-hard per plan)
- Generic routing entrypoint (step 8) — deferred, documented in Buck-mode section
- Verification tests for mode behavior (step 10) — requires runtime implementation first

## Verification

- TypeScript compilation: pre-existing errors in `wire.test.ts` and `grill-me-dialog.ts`, unchanged by these edits
- No TS files were modified — only documentation and global AGENTS.md
- Global AGENTS.md verified: 120 lines, clean structure, no broken references
- Plan mode docs match actual code behavior (`.context/` + `docs/` only)

## Next Steps

- Run `/b-build-hard` or phase for: `/b-mode` command, session state model extension, narrow auto-enable heuristics
- Run `/b-review` to validate documentation changes
- Run `/b-save` to finalize session record
