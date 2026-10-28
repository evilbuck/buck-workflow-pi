---
status: completed
date: 2026-10-27
updated: 2026-10-27
subject: 2026-10-26.git-cleanup-skill
topics: [review, iteration, git-cleanup, refname-collision]
informs: []
addresses: phase-1-classify-json.md
completed: 2026-10-27
from_review: b-review
---

# Iteration: Phase 1 branch identity protection

## Source

- Reviewed after: `/b-iterate`.
- Phase: `phase-1-classify-json.md`.
- Parent plan: `plan-git-cleanup.md`.
- Baseline: `5197bfde8a1e110286c5470ae00abd2bfeff7b7c`, plus current staged implementation and working-tree acceptance contract.
- Review-only assignment. Existing source, staged changes, lifecycle fields, and earlier artifacts were not modified. Supervisor-supplied recall was treated as reference; no SQL query was made.

## Critical Issues

## Warnings

None separate from the reproduced in-plan identity defect. The earlier workflow-metadata description regression now passes; it is not re-reported as unresolved.

## Plan Path Review: Phase 1 — Classifier JSON

### Plan Source

- File: `.context/2026-10-26.git-cleanup-skill/phase-1-classify-json.md`.
- Goal: classify every local branch and registered worktree as skip, auto-delete, or ask, deleting nothing.
- Baseline: HEAD `5197bfd`; source-state evidence for uncommitted classifier work, not commit-message or checkbox inference.
- Scope: Phase 1 only, including its recorded early canonical SKILL.md authoring. Apply, redirects, wrappers, and public docs remain later-phase work.

### Evidence Sources

- Initial Git status: staged new classifier, tests, canonical skill, and pre-existing context/backlog work; several context files also had unstaged changes and other subject artifacts were untracked. These pre-existing changes were left untouched.
- Recent commits: `5197bfd` merges fix/buck-loop-jev-halt; preceding `c8312e6` changes extension restart fingerprints. Neither proves classifier completion.
- Phase-declared files verified: `skills/git-cleanup/scripts/classify.ts:1–298`, `classify.test.ts:1–357`, `skills/git-cleanup/SKILL.md:1–47`.
- Parent assumptions and material risks read from `plan-git-cleanup.md:53–135`; prior review/build notes read as historical evidence only.
- Fresh focused command: `npx vitest run skills/git-cleanup/scripts/classify.test.ts` — **25 tests passed**, one file passed.
- Fresh required command: `npm run guardrails:check` — durable v2 **pass**, details below.
- Actual repository CLI: `bun skills/git-cleanup/scripts/classify.ts` completed successfully, fetch succeeded, base origin/HEAD SHA was `5197bfd`; current feat/git-cleanup-skill was skip/current and the primary checkout was skip/main-worktree. Displayed output was truncated; no total-inventory count is asserted.
- Disposable real-CLI scenarios: unsupported apply refused with unchanged local refs; tag/integration collision reproduced the unsafe classification above.

### Completion Matrix

| Deliverable | Status | Current-state evidence |
|---|---|---|
| One JSON document, exit 0, no delete path, unsupported apply refused | complete | Focused JSON fixture and actual repository CLI passed; disposable apply exited 1 with empty stdout and unchanged refs; flags rejected before Git at classify.ts:271–275. |
| Base origin/HEAD, then master, then main; no guess (A-1) | complete | classify.ts:43–49; precedence and no-base fixtures passed. Disposable collision scenario selected refs/heads/main correctly. |
| Fetch first through execFile argv; failure not remote-gone | complete | classify.ts:7–16,147–153,271–275; upstream failure fixture passed. No-upstream rows retain null per the phase JSON schema; tracked upstream becomes unknown after fetch failure. |
| A-2 structured containment, unknown/malformed/truncated records fail closed | complete | classify.ts:51–100; structured conflict and malformed-record fixtures passed. Human-readable message prose is not interpreted. |
| Cherry counts explanatory only; two-commit squash eligible | complete | classify.ts:175–181,225–229; squash fixture passed with two plus counts and auto-delete. |
| Unique .context and .context-only conflicts remain finished/ask (A-3) | complete | classify.ts:101–104,155–164,225–229; unique-context and context-only-conflict fixtures passed. |
| Source conflict never auto-delete | complete | src/app.ts conflict fixture passed with contained false and ask; conflict path boundary at classify.ts:98–99. |
| Dirty/untracked blocks auto-delete; ignored hidden | complete | classify.ts:167–173,225–229; dirty, untracked-only, and ignored-file fixtures passed. |
| Current checkout, integration branch, main worktree always skip | partial | Normal current/base fixture and live current/main-worktree skips pass; disposable tag main causes unoccupied integration branch main to be emitted as auto-delete under heads/main. Fix Critical Issue 1. |
| Every local branch and registered worktree inventoried consistently | partial | NUL inventory and external-path fixtures pass; shortened branch identities do not share the canonical namespace used for worktree deduplication. Fix Critical Issue 1. |
| External/newline paths and prunable missing gitdir classified safely (A-6) | complete | classify.ts:36–41,191–193,210–212,278; registered external/newline, removed-directory, and existing-directory/missing-gitdir fixtures passed. |
| Ask state and description fallback; unavailable gh null | complete | classify.ts:106–145,155–164; inherited-completion, plan-followed-by-code, and workflow-metadata regression fixtures passed. Output types constrain legal states/sources. |
| Forbidden deletion/GC/reflog/network-write paths absent | complete | Entire classifier inspected: Git inventory/proof plus fetch and gh PR read; no branch/worktree delete, prune, push, GC, or reflog-expiry path. |
| Required permanent fixture set | complete | 25 focused tests pass, including the phase-named history, conflicts, context, dirt, current, and prunable boundaries. The reproduced branch-identity boundary needs the regression proposed above. |
| Canonical skill integration | complete | SKILL.md:1–47 supplies complete procedure and explicit unavailable-apply refusal, consistent with the recorded Phase 1 adjustment; unit gate passes. |
| Required checkpoint | complete | Fresh authoritative durable-v2 guardrails pass. Does not override the independently reproduced skip failure. |
| Blocking/deferred assumptions | complete | Parent A-1–A-6 validated/non-blocking; no deferred assumption assigned here. This finding is implementation noncompliance with A-6 protection, not a reopened plan decision. |
| Phase-owned fallback/recovery remains available | complete | No delete path; disposable unsupported apply retained refs. Destructive recovery/apply race tests remain Phase 2; redirect rollback remains Phase 3. |

### Review Axes

- Spec axis worst finding: **High — integration branch can be classified auto-delete when a tag collides with its name**, Critical Issue 1.
- Standards axis worst finding: **High — ambiguous external short ref presentation is used as canonical identity across skip/deduplication boundaries**, same reproduced defect. No separate actionable style finding established.
- Standards execution: separate, explicitly scoped **sequential fallback pass** after acceptance inspection; no sub-agent dispatch tool is available, and no independent-agent result is claimed.
- Standards seeds: TypeScript guide (type narrowing, async/errors, testing/checklist), Universal Quality guide (reuse, string identities, broad reads, TOCTOU), and only the diff-relevant Long Method and Primitive Obsession smell definitions. Small helper/parameter choices did not justify speculative refactoring. Descriptive find plus literal grep across skills/_shared and scripts found no existing merge-tree/NUL-worktree parser to reuse in that scope.
- Cross-axis ranking: none; worst finding retained separately per axis.

### Verification Status

- Goal achieved: **partial**. Read-only proof/inventory works on exercised ordinary cases, but a protected integration branch can enter the auto-delete set.
- User goal: **partially met within Phase 1**; safe classification is incomplete. No deletion implementation is claimed.
- Scope adhered: yes; no out-of-scope implementation changes introduced by this review.
- Fresh focused fixtures: 25/25 pass. Fresh authoritative guardrails: pass. Both lack the tag-collision regression and do not erase its observed failure.

### Guardrails Verdict

- Contract: **durable**, version **2**, runner **1.0.0**.
- Status: **pass**.
- Gates: unit_test_gate=pass, functional_test_gate=skipped, lint_gate=skipped, patch_gate=pass, global_ratchet=pass, complexity_gate=pass.
- Coverage: **89.4%**, baseline **84%**, target **90%**. Patch percentage null; no measured patch percentage claimed.
- Complexity: 30 hotspots, baseline 30, no new or hard-ceiling violations.
- Unit, ratchet, complexity required; patch advisory; functional/lint disabled. No gate, baseline, or enforcement modified. Proposed ratchet raise not applied by read-only review.

### User Goal Analysis

- Goal: identify landed local work despite rewritten history, then describe and label the rest for the user's decision.
- Met: no-delete interface, containment/squash evidence, context/dirt preservation, external worktree inventory, corrected workflow-metadata description.
- Partial: safety of the classified proven set; integration protection fails the concrete legal-ref collision.
- Missing: Critical Issue 1 normalization and consumer-visible regression. Apply and publication remain intentional later-phase scope, not missing Phase 1 work.
- Verdict: partially met.

### Documentation Impact

No additional living-documentation impact beyond the already accepted Phase 3 publication work. Fix branch identity inside the existing deterministic boundary; no new convention or architecture decision is required. Later phases must reconcile the canonical skill with their actual apply interface.

### How-to Impact

No additional how-to impact for this internal classifier checkpoint. The existing skill procedure and planned Phase 3 publication cover the accepted user-facing action.

### Issue Classification

- In-plan issues: **1**, Critical Issue 1; directly violates the explicit integration skip criterion and concerns a phase-declared file. Route to `/b-iterate`.
- Out-of-plan issues: **none**.
- The previous workflow-metadata description defect has current passing regression evidence; it is not carried forward as an unresolved issue.

### Verdict

**Needs work** — one reproduced High in-plan safety defect, despite passing guardrails.

### Completion Audit

Objective restated as inventory/proof/no-delete; every phase criterion mapped to current source and executable evidence. The authoritative deterministic contract passed. Actual repository CLI and isolated boundary scenarios were exercised. The observed failure is partial, not complete; phase checkboxes and SQL memory claims were not treated as proof. Discovered current-session.json has no non-null goal, so goal-mode extras do not apply. No implementation, lifecycle, or next-loop-state decision was made by this reviewer.

## Recommended Workflow

Run `/b-iterate` for Critical Issue 1, then re-run `/b-review` against `phase-1-classify-json.md`. In an OMP execution session, iteration completes this artifact after fixing and verifying it, before returning for re-review. After a passing review, supervisor owns save/commit and phase/loop transitions. This review changes no historical Markdown memory or receipt and does not substitute a receipt for acceptance proof.
