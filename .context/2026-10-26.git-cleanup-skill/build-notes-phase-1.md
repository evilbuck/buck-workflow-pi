---
date: 2026-10-26
domains: [git, testing]
topics: [git-cleanup, classifier, containment]
related: [phase-1-classify-json.md]
priority: high
status: completed
subject: 2026-10-26.git-cleanup-skill
artifacts: [skills/git-cleanup/scripts/classify.ts, skills/git-cleanup/scripts/classify.test.ts, skills/git-cleanup/SKILL.md]
---

# Phase 1 build notes

## Implementation

The classifier remains read-only: argv-only `execFile` Git calls, fetch first, base selection, registered-worktree/local-branch inventory, and no deletion path. Full merge-tree NUL parsing validates unmerged entries and every structured information record; unknown types, malformed counts, missing fields, and truncated records refuse containment. Stable short types are allowlisted; opaque human-readable prose is never interpreted. Structured conflict paths participate in the `.context/` boundary check, even without unmerged index entries.

Worktree inventory uses `--porcelain -z`, preserving newline pathnames. Relevant subject artifacts come from the branch tree, selected from changed date-prefixed subject directories only; `.context/workflow` metadata cannot displace a feature plan title. Selection uses branch-wide artifacts rather than only the final commit's files. Only frontmatter status is read. Containment implies finished; otherwise unique code blocks the completed-subject alternative. Plan H1 precedes commit subject even after a later code commit.

## Scope adjustment

The root-skill catalog requires every direct skill directory to contain a canonical skill. The complete `skills/git-cleanup/SKILL.md` procedure was moved forward from Phase 3; it documents final preview/apply/ask semantics and stops if the bundled apply prerequisite is unavailable. Apply implementation remains Phase 2; wrappers, redirect, public docs, and validation against the landed apply interface remain Phase 3. No placeholder, test exemption, or weakened enforcement was added. The Phase 1 declared file scope includes the skill.

## Retained finding (below the iteration waterline)

The 2026-10-28 phase review reproduced one in-plan safety defect that the ranking placed below the waterline, so it was retained rather than iterated: `skills/git-cleanup/scripts/classify.ts` used `%(refname:short)` as canonical branch identity. A disposable repository with a tag named `main` and a branch named `main` made Git emit the branch as `heads/main`; the classifier then skipped the integration-branch check and emitted `{"name":"heads/main","disposition":"auto-delete","skip_reason":null,"contained":true}`. The same short-name ambiguity separated worktree-deduplication identity from branch-inventory identity.

That defect is now fixed: `parseBranches` reads full `%(refname)` values and strips exactly `refs/heads/`, and a regression fixture creates a `main` tag while checking out `feature`, proving the integration branch is emitted once as a `branch` row with `disposition: skip` and `skip_reason: integration`. It is tracked as completed in `.context/backlog/archive/2026-10/phase-1-refname-collision.md` and no longer blocks Phase 2 `--apply`.

## Files modified in iteration

- `skills/git-cleanup/scripts/classify.ts`
- `skills/git-cleanup/scripts/classify.test.ts`
- `skills/git-cleanup/SKILL.md` (new)
- Subject-local phase acceptance evidence/file scope, iteration plan, iterate closeout, build notes, and draft commit.

## Verification

- Focused Vitest: 25 classifier tests passed, including a regression where a changed `.context/workflow` file coexists with a feature plan and source commit; the feature plan H1 remains the user-facing description.
- Targeted TypeScript check: `npx tsc --ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node skills/git-cleanup/scripts/classify.ts skills/git-cleanup/scripts/classify.test.ts` exited 0.
- Isolated pre-fix countercheck: current regression tests against the original staged classifier produced 8 expected failures (newline inventory, historical-completion/plan-title metadata, five malformed records, structured conflict paths). The temporary checker itself exited 1 because its expected-count assertion said 7; the captured Vitest output proves 8 real assertion failures. No live source was mutated.
- Actual repository CLI produced one JSON document with 15 items, successful fetch, and the current branch `skip` with `skip_reason: current`. No apply invoked.
- Separate actual-CLI temp-repo smoke: registered newline-path checkout outside the main repository's parent returned the exact path, contained true, clean, and `auto-delete`; branch and checkout remained intact. Fetch failed with no origin, without blocking containment proof.
- Missing-gitdir actual CLI smoke reproduced an ignored nested checkout being marked `auto-delete` through parent-repository fallback despite being prunable. The new regression failed before the fix and passed after. All prunable registrations now refuse containment; post-fix CLI smoke returned `contained: false`, `disposition: ask`, with the branch retained.
- Final authoritative `npm run guardrails:check`: durable v2 **pass**, exit 0; unit, global ratchet, patch, and complexity gates passed. Coverage 89.4% versus 84% baseline; 30 existing complexity hotspots, no new violations. Lint and functional gates skipped/disabled. Patch percentage null, not a measured coverage claim. The initial run was cancelled before the gitdir fix; this verdict is post-fix. No baseline or enforcement changed.
- Node also executed the classifier successfully (15 items; current branch protected). Apply usage smoke from `/tmp`, outside this repository, exited 1 with the Phase 1 usage error before Git operations.

## Abandoned approaches

- Stopping at the unmerged-entry separator: discarded structured records and could falsely authorize deletion.
- Treating any historical completed document as branch lifecycle: mislabeled unique implementation finished.
- Adding a placeholder skill or weakening catalog enforcement: rejected; complete procedure authoring moved forward instead.

The historical session pointer refers to another subject and is unchanged. Supervisor-provided SQL recall is reference evidence only; supervisor owns review, SQL save, commit, and phase lifecycle transitions.
