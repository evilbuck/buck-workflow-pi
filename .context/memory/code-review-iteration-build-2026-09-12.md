---
date: 2026-09-12
domains: [extensions, review, workflow, testing]
topics: [code-review-iteration, omp, isolated-sessions, reviewer-fixer-loop, guardrails]
related: ["../2026-09-12.code-review-iteration-extension/index.md"]
priority: high
status: active
subject: 2026-09-12.code-review-iteration-extension
artifacts:
  - extensions/code-review-iteration/
  - extensions/omp-models.ts
  - extensions/index.ts
  - .context/2026-09-12.code-review-iteration-extension/draft-commit.md
---

# Code Review Iteration Build

Implemented `/code-review` as a bounded, local-only Reviewer → Fixer → fresh Reviewer loop. Reviewer sessions run in disposable detached worktrees with read/search tools plus policy-gated `review_exec`; Fixers operate in the review checkout. The command creates verified checkpoint commits, durable git-common run state and pass artifacts, `.context` terminal reports, resume validation, and explicit `--prune` cleanup.

Model selection uses editable extension-owned catalog and persona markdown, intersected at runtime with OMP `ModelRegistry.getAvailable()`. Ratings and fix hardness are independently validated; Fixers select the lowest sufficient available tier and avoid the Reviewer selector when an alternative exists. Reviewer temperature is passed into the actual OMP stream call.

Validation:
- `npx vitest run` — 653 tests passed.
- `npx vitest run --coverage --coverage.reporter=lcov && diff-cover coverage/lcov.info --compare-branch=origin/master --fail-under=90` — 653 tests passed; patch coverage 100%.
- `npx vitest run --coverage --coverage.reporter=text-summary` — line coverage 78.68%, above the 54.9% ratchet baseline and 75% target.
- `lizard -C 10 -w extensions/code-review-iteration` — no new extension hotspot above CCN 10; full configured lizard command completed.
- Real temporary-git command smoke with a deliberately unavailable model proved command registration, interactive untracked exclusion, durable failed runtime/report, and `--prune` cleanup without consuming model credentials.

The coverage runner created transient `coverage/` files in temporary checkout fixtures; the fixture now carries the repository-standard `coverage/` ignore so resume fingerprint tests exercise user worktree state rather than runner artifacts.

`/b-review` found in-plan defects; `/b-iterate` addressed them. Live `review_exec` now calls `opts.onCommand` (evidence ids + `commands.jsonl`). Unknown `reproduced` citations are dropped. `resolveRequestCwd` realpaths and rejects symlink escape. Stream capture is capped with incremental hashes. Command records set `network_exposed` (host network is not a sandbox). Catalog thinking levels reach Reviewer/Fixer sessions. Resume runs an incomplete Fixer when `review.json` exists without `fixer.json`. Clean outcomes commit the terminal `.context` report when it is inside the repo. Explicit `--fixer-model` below required hardness is warned.

Iterate verification: `npx vitest run extensions/code-review-iteration extensions/omp-models.test.ts` — 131 passed.

Next: re-run `/b-review` against this subject before `/b-save` and `/b-commit`.
