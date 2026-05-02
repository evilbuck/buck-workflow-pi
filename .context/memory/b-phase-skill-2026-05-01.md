---
date: 2026-05-01
domains: [tooling, skills, buck-workflow, planning]
topics: [b-phase, plan-phasing, dependency-analysis, parallel-execution, skill-creation]
related: []
priority: medium
status: active
---

# Session: 2026-05-01 — Created b-phase Skill

## Context
User wanted a new Buck workflow skill (`b-phase`) that sits between `b-plan` and `b-build`. The skill analyzes a plan and breaks it into phases if it's too large for a single session. Key requirements:
- Manual trigger (`/skill:b-phase`) but `b-plan` should recommend it for large plans
- Model-driven judgment for "too large" (guidelines provided but not hard thresholds)
- Output: `plan-<topic>-phases.md` in the same directory as the source plan
- Must analyze and document dependencies between phases
- Should note parallel opportunities (phases with NO dependency)

## Decisions Made

1. **Skill location**: `skills/b-phase/SKILL.md` in the `buck-workflow-pi` package — already configured in `package.json` as a Pi package with `skills: ["./skills"]`

2. **7-step workflow**:
   - Step 1: Read the plan
   - Step 2: Assess size (model judgment with guidelines)
   - Step 3: **Identify dependencies** — map HARD/SOFT/NONE dependencies with specific reasons
   - Step 4: **Design phases** — using dependency map, flag parallel opportunities
   - Step 5: Write `plan-*-phases.md`
   - Step 6: Update backlog (Phase 1 active, rest queued)
   - Step 7: Summarize

3. **Dependency types defined**:
   - **HARD**: Phase N cannot start until Phase N-1 completes (blocking)
   - **SOFT**: Phase N can start with stubs/mocks, but needs Phase N-1 for full integration
   - **NONE**: Phases are independent and could be done in parallel

4. **Dependency sources documented**: data/schema, API contracts, shared state, build order, test infrastructure, feature flags

5. **Parallel opportunities**: New "Parallel Opportunities" section in output template. Uses `∥` notation. Notes that while not currently parallelized, this documents future potential.

6. **SKIP vs PHASE**: If plan is small enough, skill tells user "No phasing needed" and exits.

## Files Created

- `skills/b-phase/SKILL.md` — the skill itself (new directory + file)

## Key Sections in the Skill

- **When to Phase a Plan**: ~8 steps, ~5 files, multi-domain, high-risk, unknowns, verification burden
- **Dependency Matrix**: Markdown table with From→To, Type, Reason
- **Dependency Diagram**: ASCII art with legend (──→ HARD, - -→ SOFT, │ shared)
- **Parallel Opportunities**: Explicit section for NO-dependency phases
- **Integration with Buck Workflow**: Notes that `b-plan` should recommend `b-phase`, `b-build` should respect phases file

## Completed Tasks

- [x] Created `skills/b-phase/SKILL.md` with 7-step workflow, dependency analysis, and parallel opportunities
- [x] Updated `prompts/b-plan.md` to recommend `b-phase` when plans exceed ~8 steps, ~5 files, or multiple domains
- [x] Updated `docs/buck-workflow.md`:
  - Added `b-phase` to Quick Reference Table
  - Added `b-phase` to all mermaid diagrams (Complete Flow, Command-Only Flow, Pi Implementation Matrix)
  - Added detailed `/skill:b-phase` section under Planning Phase
  - Added "Large Plan (Multi-Session)" workflow example
  - Updated Discoverability section
  - Updated version date to 2026-05-01
- [x] Created `skills/b-grill-me/SKILL.md` — replaced symlink to global grill-me with buck-specific version that includes:
  - Metadata tracking (question count, decision domains, question types, resolutions)
  - Configurable phasing threshold (default 20 questions)
  - Model-driven break point identification based on decision tree shape
  - Session file output (`grill-session-<topic>.md`) with frontmatter metadata
  - Integration with b-phase (metadata consumed as phasing signal)
- [x] Created `skills/b-grill-with-docs/SKILL.md` — replaced symlink to global grill-with-docs with buck-specific version that includes:
  - All b-grill-me complexity tracking features
  - Domain model awareness (CONTEXT.md, ADRs, glossary checks)
  - Inline documentation updates during grilling
  - Additional session file section for documentation decisions
  - Copied CONTEXT-FORMAT.md and ADR-FORMAT.md supporting files
- [x] Updated `skills/b-phase/SKILL.md` — added Step 2b to read grill session metadata as additional sizing signal
- [x] Updated `docs/buck-workflow.md` — added b-grill-me and b-grill-with-docs to Quick Reference Table, detailed sections, mermaid diagrams, and Discoverability

## Next Steps

- [ ] Test the skills by creating a large plan and running `/skill:b-grill-me` then `/skill:b-phase`
- [ ] Consider if b-plan should also recommend `/skill:b-grill-me` for pre-planning stress testing
