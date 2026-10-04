---
date: 2026-10-02
domains: [buck-loop, sql-memory]
topics: [save-receipt, subject, saveDirective]
related: []
priority: high
status: active
subject: 2026-10-02.buck-loop-save-receipt-subject
artifacts: [plan-receipt-subject-contract.md, draft-commit.md]
---

# Receipt subject contract

`saveDirective()` now emits `subject: ${attempt.subject}` after `runId`. `skills/b-save/SKILL.md` and the byte-identical plugin copy require that value for the receipt `subject` and `op: "remember"` `subject`.

Verification: focused vitest 18 passed / 1 skipped; guardrails durable v2 pass (coverage 88.2 vs baseline 84, patch advisory). Pre-existing `tsc` diagnostic `sql-save.ts` `MigrationPool.end` is outside this change. Throwaway proof: directive subject line matched the attempt; conformant receipt verified; inflated subject stayed unverified.

Next: `/b-review`, then `/b-save`, then `/b-commit`.
