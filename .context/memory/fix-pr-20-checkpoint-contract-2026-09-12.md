---
date: 2026-09-12
domains: [review, workflow, extensions, testing]
topics: [fix-pr, pr-20, b-save, checkpoint, persistence, citations]
related: [extensions/b-save/index.ts, extensions/b-save/evaluate.ts, extensions/b-save/apply.ts]
priority: high
status: completed
subject: 2026-09-10.b-save-state-machine-analysis
artifacts: [extensions/b-save/index.ts, extensions/b-save/evaluate.ts, extensions/b-save/apply.ts]
---

# PR #20 checkpoint contract repair

Restored the Phase 4 persistence contract for `/b-save` review findings:

- Model claims and audit verdicts now carry quoted snapshot citations; the command rejects non-verbatim citations before evaluation.
- Snapshots include backlog item and loose-artifact source files. Evaluation composes memory/index updates, cross-references, subject completion state, backlog archive/create operations, and loose-artifact moves into journaled patch operations.
- Journaled apply supports source deletion and safe rollback of partial archive operations.
- Persistence composition is split into small helpers; changed-module complexity stays below the configured threshold.

Verification:

- `vitest run`: 34 files, 486 tests passed.
- `vitest run --coverage --coverage.reporter=lcov`: passed; global line coverage 73.98%, above the 54.9% ratchet baseline.
- `diff-cover coverage/lcov.info --compare-branch=origin/master --fail-under=90`: 91% patch coverage.
- `npx vitest run extensions/b-save/__tests__`: 8 files, 49 tests passed.
- Scoped `tsc` diagnostics are clean for changed b-save source files. Repository-wide `tsc` retains unrelated pre-existing diagnostics in other skills and experiment files.

Backlog: no PR #20 item existed to archive or add.

PR settlement: pushed as `f785ff6`. Immediate post-push feedback fetch found no independent submitted resolving review after this commit; settlement awaits an external reviewer.