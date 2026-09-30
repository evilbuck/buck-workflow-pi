---
date: 2026-09-27
domains: [planning, extensions, workflow]
topics: [buck-loop, subject-ranking, jev, tui]
related: [buck-loop-streaming-log-drain-build-2026-09-25.md]
priority: medium
status: completed
subject: 2026-09-19.buck-loop-subject-picker
artifacts: [plan-buck-loop-subject-picker.md]
---

# Jev-ranked `/buck-loop` subject picker plan

Revised the existing subject-picker plan to match the operator-confirmed behavior: bare `/buck-loop` ranks runnable subject folders with TypeSafe Jev, presents up to ten probability-ordered rows, and starts only the subject the operator selects.

Current code still rejects empty arguments in `parseArgs("")`, emits `USAGE`, and never calls `handleLoop`. The plan preserves `scan()` as an explicit-path authority; candidate discovery uses lifecycle state plus `scan()` viability before judgment.

Key decisions:

- Jev receives a bounded user/assistant conversation tail and bounded subject metadata; opaque candidate IDs keep output closed-set.
- Up to 50 eligible subjects are judged, then up to 10 are shown by descending probability. A sole candidate is shown at 100% without an unnecessary Jev call.
- The TUI remains the authority: no subject auto-starts. Cancel, timeout, headless mode, missing credentials, TypeSafe failure, or malformed probabilities fail closed with no chat-model or recency fallback.
- The start log and supervisor are created only after selection, so both receive the exact chosen subject basename.

Artifact: `.context/2026-09-19.buck-loop-subject-picker/plan-buck-loop-subject-picker.md`. Lifecycle activation canonicalized the reused subject as `active`, revision 1. Planning changed only `.context/**`; deterministic code guardrails were not applicable.
