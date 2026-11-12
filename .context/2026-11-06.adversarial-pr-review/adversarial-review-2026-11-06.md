---
date: 2026-11-06
domains: [tooling, review]
topics: [adversarial-review, github-pr, inline-comments]
subject: 2026-11-06.adversarial-pr-review
artifacts: [grill-session-adversarial-pr-review.md, skills/adversarial-review/SKILL.md, prompts/adversarial-review.md]
related: []
priority: high
status: active
---

Added `/adversarial-review` as a new prove-it-fails PR review. It does not replace `code-review-universal`.

Locked contract:
- Input is a PR number, `#N`, `owner/repo#N`, or full PR URL. No local-diff mode.
- Ask Post vs Local every run and wait. OMP may use a selector. Other harnesses ask in chat. Do not default.
- Both modes write `review-pr-<N>.md` in `.context/YYYY-MM-DD.pr-<N>-adversarial-review/` via workflow_state.
- Post reuses `skills/code-review/scripts/pr-context.ts` and `submit-review.ts`. One atomic review. No Check Run. No commit status.
- Inline comments only on exact diff lines. Do not re-anchor. Unanchored items stay in the review body.
- `REQUEST_CHANGES` only when a Critical Failure is proven on a diff line. Otherwise `COMMENT`. Own PR is always `COMMENT`. Never `APPROVE`.
- Section 2 is up to 10 real edge cases. Never pad.
- Tone is blunt. No praise, insults, or sarcasm.
- `gh` must already be authenticated. Fail closed. Do not run `gh auth login`.
- `code-review-universal` description excludes adversarial reviews. Codex plugin copy is `plugins/buck-workflow/skills/adversarial-review/`.

Verification: `bun test scripts/codex-plugin.test.ts scripts/commands-mirror.test.ts` passed (10 tests). `npm run guardrails:check` failed because `vitest` is not installed (`unit gate: tool not found`), not because these tests failed.

Did not symlink `~/.agents/skills/adversarial-review`. That install path points at the main clone, not this worktree.
