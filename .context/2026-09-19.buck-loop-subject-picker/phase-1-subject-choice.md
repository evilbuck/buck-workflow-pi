---
status: pending
phase: 1
order: 1
plan: plan-buck-loop-subject-picker.md
phases_overview: plan-buck-loop-subject-picker-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Build the subject-choice module: candidate discovery, bounded evidence, Jev ranking, and probability validation with pure tests."
omp_execution: none
files:
  - extensions/buck-loop/subject-choice.ts
  - extensions/buck-loop/__tests__/subject-choice.test.ts
from_plan_steps: [1, 2, 3, 4, 7]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[ ] `SubjectCandidate` model with opaque id, folder basename, title/summary, and resolved plan/phase hint exists in subject-choice.ts."
  - "[ ] Candidate discovery starts from `listSubjectFolders(projectRoot)`, prefers active subjects (drafts only when no active candidates), and retains only `scan()` results classified `unphased` or `phased-incomplete`; sorted newest first and capped at 50."
  - "[ ] Bounded evidence reads only each candidate's index.md heading/first prose summary plus resolved plan/phase filenames, with per-field and aggregate character caps; conversation tail is at most the latest 8 user/assistant messages capped at 12,000 characters, excluding system/tool/custom entries."
  - "[ ] For 2+ candidates, one TypeSafe `choice` judgment is issued via `runJev(createTypeSafeEvaluator(), ...)` with opaque `candidate_N` labels; `choose()` is not used."
  - "[ ] Validation requires a legal chosen label, finite non-negative probability for every offered label, and no unknown labels; violations fail closed with no fallback."
  - "[ ] Ranking sorts descending with newest-first tie order and returns the first 10; a sole candidate returns synthetic 1.0 without calling Jev; zero candidates returns an actionable no-candidates result."
  - "[ ] `npx vitest run extensions/buck-loop/__tests__/subject-choice.test.ts` passes with injected evaluator/session fixtures covering: active+draft+completed+malformed+no-plan+multi-plan+phased-complete filtering, known-distribution ordering, recency tie-break, 12-candidate display cap of 10, unknown/missing/negative/NaN probability failures, and sole-candidate evaluator bypass."
completed_at: null
completed_by: null
---

# Phase 1: Subject-Choice Module

## Context

Parent plan User Goal: "When I run `/buck-loop` without a path, show me about ten likely subject folders ranked by probability; when I select one, start the loop on that subject."

This phase builds the pure, UI-free core: discovering runnable subjects, assembling bounded evidence, asking TypeSafe Jev for calibrated probabilities, validating the full distribution, and ranking. It exports contracts the wire layer (Phase 2) consumes. No command parsing, no `ui.select`, no kickoff.

## Implementation Details

From plan steps 1–4 (test work from step 7):

1. **Candidate model and discovery** — `SubjectCandidate` with opaque id, folder basename, title/summary, resolved plan/phase hint. Source: `listSubjectFolders(projectRoot)` → active statuses (drafts only when zero active), retain only `scan()` results with `unphased`/`phased-incomplete` facts. Newest first; judgment pool capped at 50.
2. **Bounded evidence** — Only each candidate's `index.md` heading/first-prose summary and resolved plan/phase filenames, per-field and aggregate caps. Conversation: latest 8 user/assistant messages, 12,000-char cap, excluding system/tool/custom entries.
3. **Native judgment** — 2+ candidates → one `choice` question via `runJev(createTypeSafeEvaluator(), ...)`. Labels `candidate_0…N`; values carry candidate metadata; instructions ask which subject best matches the operator's current conversation and require calibrated probabilities. Never `choose()` (its fallback violates the Jev-only contract).
4. **Validate and rank** — Legal chosen label required; finite, non-negative probability for every offered label; unknown labels rejected. Sort descending, newest-first on ties, return first 10. Sole candidate → synthetic 1.0 (no Jev call). Zero → actionable no-candidates result.
5. **Tests** — Pure tests with injected evaluator/session data; assert consumer-visible candidate order and kickoff-path mapping, not implementation text.

## Risks

- Jev probability shape drift → validate the complete distribution; fail closed.
- Stale lifecycle metadata → rely on lifecycle authority + `scan()`, never a second status parser.
- Large active sets → 50-candidate cap plus bounded summaries.

## Verification

- `npx vitest run extensions/buck-loop/__tests__/subject-choice.test.ts`
- Fixtures: active + draft + completed + malformed + no-plan + multi-plan + phased-complete.
- Jev fixtures: known distribution orders rows; equal values retain recency; 12 candidates → 10 displayed; unknown/missing/negative/NaN fails closed; sole candidate bypasses evaluator.
- `npm run guardrails:check` at the coherent post-edit checkpoint.
