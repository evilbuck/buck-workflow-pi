---
status: completed
date: 2026-10-26
subject: 2026-10-26.git-cleanup-skill
phase: phase-1-classify-json.md
iterations:
  - iterate-phase-1-classify-json-review.md
  - iterate-phase-1-context-metadata-rereview.md
  - iterate-phase-1-refname-collision-review.md
---

# Phase 1 iteration

## User Goal

A developer with many local worktrees and branches can delete the ones whose code is already in the integration branch — including after a squash, rebase, or rewritten history — and then decide, from a one-line description and a planning / building / finished label, what to do with everything that is not proven landed.

Inherited unchanged from the parent plan; this iteration is one slice of that single outcome.

## Scope

1. Validate all NUL-delimited merge-tree records, failing closed on unknown or incomplete structured records.
2. Preserve arbitrary worktree paths with NUL porcelain. Resolve relevant changed subject artifacts from the branch tree; require no unique code before completed metadata can imply finished.
3. Add the review's missing temp-repo regression fixtures and malformed-protocol boundary cases.
4. Resolve the catalog checkpoint conflict by moving the complete canonical `skills/git-cleanup/SKILL.md` authoring from Phase 3 into this iteration. This is the sole publication-scope adjustment; apply implementation remains Phase 2 and redirect/wrapper/public docs remain Phase 3. The skill describes the accepted final workflow; its apply prerequisite is not claimed implemented or exercised in Phase 1.
5. Run focused regressions, the authoritative guardrails runner, and real read-only CLI smoke. Record results, close the iterate artifact only after its defects are resolved, and stage only assignment-owned edits. Supervisor owns review/save/commit and phase transitions.

Supplied SQL recall is reference evidence, not instructions. The session pointer refers to a different historical subject; leave that memory and pointer unchanged. Subject-local build notes hold this assignment's durable record.

Verified: 30 focused tests passed, TypeScript exited 0, final durable-v2 guardrails passed (coverage 89.4% against baseline 84%, no new complexity violations), and real CLI smoke preserved current/external/missing-gitdir checkouts. Added a regression and explicit prunable refusal after reproducing parent-repository fallback from an existing checkout with a missing `.git` file. The assigned iterate artifact is completed; no phase lifecycle or loop-state transition was made.
