---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, save-policy, provenance]
informs: []
addresses: phase-3-sql-save-truthful-completion.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Phase 3 immutable saves and phase provenance

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-3-sql-save-truthful-completion.md`
- Baseline: `7705adf` and the staged/unstaged Phase 3 tree; previous SQL cross-reference iteration is completed.

## Critical Issues

### 1. Save-stage SQL gate permits changing immutable memory content
- **Files**: `extensions/sql-memory/sql-gate.ts:40-53,80-88`; `extensions/sql-memory/sql-gate.test.ts:6-28`
- **Problem**: `checkSqlForRole` approves `UPDATE memories SET body = $1 WHERE id = $2` and `UPDATE memories SET category = $1 WHERE id = $2` in the save role. A save child has this raw SQL tool, so the immutable correction contract is a prompt convention, not enforced policy. A throwaway Bun call to the actual gate returned `{allowed:true}` for both statements. This is within the Phase 3 requirement that corrections update only `invalid_at`/`superseded_by`, never immutable content.
- **Proposed fix**: Restrict save-role `UPDATE memories` assignments to the correction columns and reject body, context, author, project, category, seq, or provenance updates; preferably force correction through the existing atomic `correct` operation, preserving the necessary project-scoped transactional update path. Test allowed correction statements and denied immutable-column updates through the same tool policy used by children.

### 2. SQL memory rows omit phase provenance
- **Files**: `extensions/buck-loop/sql-save.ts:79-91,202-215`; `extensions/sql-memory/index.ts:7-12`; `skills/b-save/SKILL.md:39-45` and its plugin copy
- **Problem**: The Phase 3 acceptance contract requires subject/phase/source context. The alternate save constructs only `{source_key, subject, source}` and the portable skill prescribes the same fields. The supervisor directive lacks the phase path; the portable correction schema models no phase. The stored row therefore cannot identify which phase produced the fact when the same subject runs several phases.
- **Proposed fix**: Include the active phase path (or explicit null for unphased work) in the supervisor save directive and `memories.context` for both portable and alternate save paths, including the atomic correction contract and plugin copy. Keep source-key retry identity stable; exercise a multi-phase subject and inspect the stored context.

## Warnings

- Phase 4 owns the deployed OMP child/full-loop proof; this review did not claim that proof from unit fixtures.

## Review baseline
- `npm run guardrails:check`: durable v2 pass; unit, global coverage ratchet, advisory patch and complexity pass; functional and lint skipped.
- `bun -e` call to `checkSqlForRole`: both immutable `UPDATE memories SET body/category` examples allowed in save role.
- Current-state inspection: `sql-save.ts:210` and portable `b-save/SKILL.md:43-44` specify no phase key.
- Standards pass was sequential because no background task tool is available; TypeScript/universal guides and duplicate-code, long-method, primitive-obsession subset were consulted independently of phase acceptance.

## Iteration resolution

- Save-stage `UPDATE memories` now accepts only correction assignments; direct immutable-field updates return a tool-policy error. The projected save attempt carries the active phase path (or explicit null), and both alternate inserts and portable atomic corrections store it in `context`.
- 121 focused tests passed (including disposable PostgreSQL multi-phase row inspection, phase-change retry identity, and save-tool denial); durable v2 guardrails passed (unit, global ratchet, complexity; lint/functional disabled). `npx tsc --noEmit` remains red with broad test/tooling errors, including unrelated loop-test callback signatures.

## Recommended Workflow

Run `/b-review` against Phase 3, then `/b-save` and `/b-commit` after review passes. The supervisor owns the next loop state.
