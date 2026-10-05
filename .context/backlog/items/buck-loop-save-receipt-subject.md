---
title: Fix buck-loop SQL-save receipt subject mismatch
status: active
priority: high
created: 2026-10-02
updated: 2026-10-02
completed: null
related:
  - .context/2026-09-30.buck-loop-tui-preview/research-choice-protocol-error.md
  - .context/2026-09-30.buck-loop-tui-preview/research-buck-loop-stopping-point.md
  - .context/2026-10-02.buck-loop-save-receipt-subject/plan-receipt-subject-contract.md
  - extensions/buck-loop/sql-save.ts
  - extensions/buck-loop/scan.ts
---

# Fix buck-loop SQL-save receipt subject mismatch

`saveDirective()` (extensions/buck-loop/sql-save.ts) emits attempt/run/project/phase/receipt but omits `subject`, so a save child can write a receipt under a different subject string than the canonical one in `.context/workflow/sql-save-attempt.json`. `sameAttempt()` requires an exact subject match, so `receiptShape()` returns `unverified` and `scan.ts` leaves the save postcondition ambiguous even though the child reported `completed: true` with real memory ids.

Observed 2026-10-02: the attempt names `2026-09-30.buck-loop-tui-preview`; the receipt names `2026-09-30.buck-loop-tui-preview stacked-cards live integration`. Attempt and run ids match, `completed: true`, ids `["01a0fabb-5cc9-7654-962b-001683230c81"]`. That run ended `saving → blocked` at 03:50:20Z and never reached commit.

Distinct from [buck-loop-save-commit-handoff](buck-loop-save-commit-handoff.md), which covers teardown-vs-work failure classification and commit staging scope. This item is the receipt identity contract only.
