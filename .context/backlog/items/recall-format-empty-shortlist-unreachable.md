---
title: formatRecall's "no relevant candidates" branch is unreachable, and the fail-open is undocumented
status: active
priority: low
created: 2026-10-03
updated: 2026-10-03
completed: null
related:
  - extensions/buck-loop/project-memory.ts
  - extensions/buck-loop/__tests__/project-memory.test.ts
---

# formatRecall's "no relevant candidates" branch is unreachable, and the fail-open is undocumented

`judgeShortlist()` (`extensions/buck-loop/project-memory.ts`) ends with
`return ranked.length === 0 ? shortlist : ranked`. So when every Jev score falls
below `RELEVANCE_THRESHOLD` (0.7), `filterAndResolve()` returns an **empty**
ranking and the caller substitutes the **full deterministic shortlist**.

Consequence: a `success-rows` outcome can never carry zero rows through this
path, so `formatRecall()`'s `context || "Jev selected no relevant candidates."`
fallback is dead code from `recallProjectMemories`. Verified 2026-10-03 by
reading both sites; the branch is only reachable if `formatRecall` is called
directly with a hand-built empty outcome.

That raises the real question, which is currently undocumented: when the judge
says **none of these memories are relevant**, the loop injects **all of them**
into the parent chat. Fail-open is a defensible choice for a recall path that
must not silently drop a prior decision, but it is the opposite of what the
branch name implies, and nothing states the intent.

Two coherent resolutions; the second is smaller:

1. Make the fail-open explicit and drop the dead branch — `formatRecall` always
   receives at least one row, and the comment on `judgeShortlist` records that
   a low-confidence judgment is deliberately treated as "no usable ranking".
2. Distinguish "the judge said none are relevant" from "the ranking was
   unusable", returning an empty row set for the former so the fallback message
   becomes reachable and the operator sees that nothing was retrieved.

Do **not** change the threshold, and do not treat this as a correctness bug: no
data is lost and nothing crashes. It is a legibility and intent problem.

## Test that pins the current behavior

Call `formatRecall()` directly with a `success-rows` outcome carrying `rows: []`
and assert the "Jev selected no relevant candidates." text, with a comment that
this path is not reachable through `recallProjectMemories`. If resolution (2) is
chosen instead, invert this test to assert the empty-rows path *is* reachable
and add a matching case to `recallProjectMemories`.
