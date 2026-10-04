---
title: repairCheckedPhase rewrites a body status line outside the frontmatter
status: completed
priority: medium
created: 2026-10-03
updated: 2026-10-03
completed: 2026-10-03
related:
  - extensions/buck-loop/ambiguity.ts
  - extensions/buck-loop/__tests__/ambiguity.test.ts
  - .context/2026-10-03.buck-loop-iterate-closeout/plan-iterate-closeout.md
---

# repairCheckedPhase rewrites a body status line outside the frontmatter

`repairCheckedPhase()` (`extensions/buck-loop/ambiguity.ts`) rewrites status with
`text.replace(/^status:\s*.+$/m, "status: completed")` over the **whole document**.
Under the `m` flag, `^` and `$` match at every line boundary, so the first line
that starts with `status:` wins — and that line need not be inside the frontmatter.

A phase file whose frontmatter has no `status:` line but whose body contains one —
a fenced code block, a status table, a quoted example — gets its **body** edited
while the frontmatter is left without a status. The phase then still reads as
not-completed, and the damage is in prose a human wrote.

Verified 2026-10-03 by direct execution against the current checkout:

```
input:  ---\nphase: 1\nacceptance_criteria:\n  - "[x] done"\n---\n\n# Phase\n\n```\nstatus: pending\n```
result: repairCheckedPhase(...) === true, and the fenced block became "status: completed"
```

Every other lifecycle write in this module is span-bounded:
`phase-completion.ts` `markPhaseCompleted()` uses `frontmatterSpan()` and rewrites
`fm.body` only. `repairCheckedPhase()` is the outlier.

Related defect in the same function, same fix site: `completed_at` receives
whatever `at` the caller passes. `loop.ts` `resolveAmbiguity()` passes
`deps.now()`, a full ISO timestamp, so the field is written as
`completed_at: 2026-10-03T00:00:00.000Z`. Every other path
(`syncCheckedPhasesAt`, and `closeSingleUnfinishedIterate`) writes `YYYY-MM-DD`.
Verified: `repairCheckedPhase(p, "2026-10-03T00:00:00.000Z")` produces
`completed_at: 2026-10-03T00:00:00.000Z`.

## Fix

Bound the rewrite to the frontmatter span and normalize the date, mirroring
`markPhaseCompleted()`: slice `fm.body`, apply the replacement there, reassemble
`text.slice(0, fm.start) + next + text.slice(fm.end)`, and derive `completed_at`
from `at.slice(0, 10)`.

## Tests that must fail before the fix

1. A phase with `acceptance_criteria` all checked, **no** `status:` key in
   frontmatter, and a fenced `status: pending` block in the body. Assert the
   function returns false or writes nothing to the body, and that the fenced
   text is byte-identical afterwards.
2. `repairCheckedPhase(abs, "2026-10-03T00:00:00.000Z")` on a fully checked
   phase. Assert `completed_at: 2026-10-03` exactly, with no time component.

Both are pure unit tests over a temp file; no supervisor, model, or database
required.

## Resolution (2026-10-03)

Fixed as prescribed: `repairCheckedPhase()` now bounds the rewrite to
`frontmatterSpan()` (exported from `phase-completion.ts`, imported into
`ambiguity.ts`), mirrors `markPhaseCompleted()`'s insert-or-replace logic, and
derives `completed_at` from `at.slice(0, 10)`. Both mandated tests added to
`extensions/buck-loop/__tests__/ambiguity.test.ts` (red before the fix, green
after); full suite 1565 passed; tsc clean on touched files; guardrails
`status: pass`.
