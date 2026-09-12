---
date: 2026-09-12
domains: [extensions, review, workflow]
topics: [omp, isolated-sessions, review-loop, model-routing, reviewer-personas, worktrees]
related:
  - ../2026-09-12.code-review-iteration-extension/index.md
priority: high
status: completed
subject: 2026-09-12.code-review-iteration-extension
artifacts:
  - brainstorm-code-review-iteration-extension.md
  - brainstorm-state-code-review-iteration-extension.json
---

# Isolated code-review iteration extension brainstorm

## Outcome

Completed intake for an OMP extension that owns a bounded Reviewer → Fixer → fresh Reviewer loop without adding the child sessions to the user's main context. The user accepted the brainstorm draft as sufficient; no formal plan was started.

## Locked decisions

- Two isolated roles only. Reviewer is read-only; Fixer independently verifies findings before editing. One Fixer handles each pass at the maximum blocking `fix_hardness`.
- Reviewer runs in a disposable detached worktree at committed HEAD. Reproduction uses a structured, extension-allowlisted command runner with host network, stripped credentials, bounded/redacted output, hashes, and explicit execution records.
- Medium/high/critical findings block; advisory/low findings remain report-only. Maximum three Reviewer passes. Criticality uses `2I + L + B`; fix hardness remains a separate `easy | medium | hard` field.
- Fetch `origin/<base>` and auto-rebase before review. A hard Fixer handles conflicts; failed continuation aborts and restores pre-run state. Dirty starting state is checkpointed before review, and each successful Fixer pass gets a check-gated commit.
- Resumable runtime and immutable pass artifacts live under the git common directory. Every terminal result writes a `.context` report. Only an extension-created clean worktree is removed after success.
- Model routing uses exact provider/model Markdown entries intersected with OMP runtime availability. `family` prevents treating the same model through another provider as independent. Routing prefers the lowest sufficient capability, excludes the Reviewer family when possible, then prefers provider diversity and stable priority.
- User-calibrated Fixer tiers: hard = GLM-5.3, GPT-5.6-Sol, Grok 4.6, Claude Opus 5, Kimi K3; medium = GPT-5.6-Terra, Claude Sonnet 5, GLM-5.3-Flash, Muse Spark 1.3, Qwen3.7 Plus; easy = GPT-5.6-Luna, MiniMax M3.
- Seed neutral reviewer persona launchers for Terra, GLM-5.3, Sonnet 5, Grok 4.6, and Kimi K3 at `:high` and temperature `0.2`. Their prompt bodies remain evidence-first and equivalent until calibration justifies model-specific adaptations.
- GitHub behavior is entirely out of scope. `fix-pr` and `b-pr-manager` retain PR feedback and merge ownership.

## Verification

Validated requested model families against the live OMP catalog and recorded canonical selectors. This session changed `.context` Markdown/JSON only, so the deterministic code guardrail gate did not apply.
