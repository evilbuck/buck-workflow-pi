---
status: completed
phase: 3
order: 3
plan: plan-b-pr-manager.md
phases_overview: plan-b-pr-manager-phases.md
difficulty: medium
model_hint: capable general model; pagination and snapshot reduction, no live GitHub
buck_hint: /b-build
goal: "Implement deterministic GitHub inventory: paginated feedback, fingerprints, check/review/merge snapshots, and mutation calls that never bypass protections."
files:
  - extensions/b-pr-manager/github.ts
  - extensions/b-pr-manager/__tests__/github.test.ts
  - extensions/b-pr-manager/__tests__/fixtures/gh-payloads.ts
from_plan_steps: [3]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] Paginated REST covers reviews, inline comments, and conversation comments; GraphQL covers review-thread resolution state"
  - "[x] Each item normalizes to the Phase 1 feedback-version schema with a stable fingerprint (id + timestamp/content digest)"
  - "[x] Edited comments produce a new version; resolved/outdated/duplicate state is explicit"
  - "[x] Snapshot helpers reduce required checks, `reviewDecision`, mergeability, repository merge methods, auto-merge, and GitHub `state`"
  - "[x] Read snapshots are separate functions from mutations (`gh pr merge --auto`, never `--admin`)"
  - "[x] Mutation helpers are idempotent given the same head OID / merge method"
  - "[x] A comment arriving between push and gate is visible to an immediate refresh using fixtures"
  - "[x] No real network in tests; all cases use Phase 1 fixtures plus added pagination/gate fixtures"
completed_at: 2026-09-10
completed_by: b-build
---

# Phase 3: Deterministic GitHub inventory

## Context

Parent user goal: a developer can run one OMP command on an open pull request and have valid review feedback fixed, verified, rebased, pushed, and merged without babysitting.

Builds on Phase 1 schemas. Independent of Phase 2 git extraction. No command UX, no persistence, no model roles.

## Implementation Details

1. Implement `extensions/b-pr-manager/github.ts` as a `gh` transport:
   - Resolve PR by number, URL, or current-branch `gh pr view`; zero/multiple matches return a typed error with a concrete rerun command.
   - Capture number, URL, base/head refs, draft, head OID, push permission, repo merge capabilities.
   - Paginate all feedback sources; normalize IDs, node IDs, authors, URLs, timestamps, resolution/outdated, path/line, original commit.
   - Fingerprint = stable ID + updated timestamp + content digest. Delta vs previously seen versions is deterministic.
   - Reduce required checks to GitHub's required-check semantics (pending vs terminal-success vs hard failure).
   - Capture `reviewDecision` without inventing extra approvals.
   - `enableAutoMerge(method)` maps to `gh pr merge --auto` with the resolved method; reject `--admin` at the type/function boundary.
   - `readMergedState()` requires GitHub `state=MERGED` plus merge commit OID.
2. Keep reads and mutations in separate exports so every mutation can be preceded by a fresh snapshot.
3. Tests in `github.test.ts` using fixtures:
   - Pagination across all sources; resolved threads; outdated inline comments; edited comments; duplicate semantics.
   - Review-decision changes; required-check rollups; mergeability; auto-merge enabled; final MERGED.
   - Immediate post-push refresh detects a new comment.
   - Assert argv never includes `--admin`.
4. Do not enable auto-merge from a machine actor yet (Phase 6). Do not call live GitHub.

## Risks

- ID-only dedupe misses edited comments. Fingerprint must include content/timestamp.
- Check reduction that treats pending as success. Pending returns a pending snapshot, never a pass.
- Accidental admin merge flag. Type-level omission plus test.

## Verification

- `vitest` `extensions/b-pr-manager/__tests__/github.test.ts`.
- `rg -- '--admin' extensions/b-pr-manager/github.ts` finds no production flag.
- Phase 1 machine tests still pass.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues go to a separate `/b-plan` → `/b-build`; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress`.

`omp_execution` is omitted (`none`). No first-turn keyword or `/goal set`.
