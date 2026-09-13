# Local-only isolated review loop with a structured `review_exec` trust boundary

The Reviewer → Fixer → fresh-Reviewer loop in `extensions/code-review-iteration/loop.ts` could have ingested GitHub PR state and given the Reviewer a general shell. We keep the loop local-only, and we run Reviewer reproduction through policy-bounded `review_exec` in `extensions/code-review-iteration/policy.ts`, so GitHub lifecycle stays in `fix-pr` / `b-pr-manager` and Reviewer commands stay a small, auditable surface.

## Local-only GitHub boundary

The extension never discovers PRs, ingests review feedback, posts comments, or merges. It operates on the current local checkout: fetch/rebase onto `origin/<base>`, a disposable detached Reviewer worktree per pass (`review-wt-NN` under the run dir, removed after the pass), and Fixer edits on the live checkout. `runReviewLoop` never pushes; `prepareBaseAndCheckpoint` / `runFixerPass` create a checkpoint commit only after deterministic checks pass. Remote-team PR ergonomics are the cost of not coupling isolated iteration to GitHub state that `fix-pr` and `b-pr-manager` already own.

## `review_exec` trust boundary

The Reviewer has no `edit`, `write`, or general `bash`. Reproduction is a command id + full argv + repo-relative cwd (`ReviewExecRequest`). `runReviewCommand` matches structurally against `extensions/code-review-iteration/review-exec-policy.md` plus read-only git and check-contract commands; it never invokes a shell, sanitizes the environment, caps time and output, and records denials instead of throwing (no unrestricted fallback). Spawned commands use host network with credentials stripped; `network_exposed` on the command record is the actual exposure (`allow_network` in the policy file documents intent only). This is not a full sandbox: an allowed binary with host network can still affect things beyond its cwd. The allowlist and sanitized env *are* the trust boundary.

## Considered Options

- Fold PR discovery, comments, and merge into this loop: rejected because it would couple local iteration to GitHub lifecycle already owned elsewhere.
- Unrestricted Reviewer `bash`, or a full VM/container sandbox: rejected because the former is an unbounded trust surface and the latter is a large runtime for a bounded reproduction need.

## Consequences

- Team review on GitHub remains a separate command (`fix-pr` / `b-pr-manager`).
- Edits to `review-exec-policy.md` change what the Reviewer can run; host-network effects of allowed binaries remain the operator's responsibility.
