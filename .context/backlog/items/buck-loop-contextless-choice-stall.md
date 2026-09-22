---
title: Fix buck-loop context-free choice stalls
status: active
priority: high
created: 2026-09-19
updated: 2026-09-22
completed: null
related:
  - .context/2026-09-19.buck-loop-stall-diagnosis/research-buck-loop-stall.md
  - .context/2026-09-22.buck-loop-block-warning-diagnosis/research-buck-loop-block-warning.md
  - extensions/buck-loop/choice.ts
  - extensions/buck-loop/scan.ts
  - extensions/buck-loop/loop.ts
---

# Fix buck-loop context-free choice stalls

A semantically clean `b-review` report used `##` impact headings, missed the scanner's exact `###` contract, and entered fallback choice. The chooser received only legal enum names, selected `block` because no task context was present, and stopped an otherwise successful run.

The defect recurred on 2026-09-22 after the first context improvement: a passing review omitted `### How-to Impact`, so the scanner again classified it as unparseable. The chooser received phase and boolean scan facts but still did not receive the report's Pass verdict or issue classification; it accepted `block` on attempt 1. The same report's `None. Stale ...` Documentation Impact sentence is also misclassified as positive impact.

## Acceptance

- Nested `b-review` output is validated for every routing field before the session is accepted; missing fields identify themselves instead of reaching an under-specified chooser.
- Realistic `##`/`###` headings, an omitted How-to section, and `None. ...` no-impact prose have explicit fail-closed behavior without false documentation routing.
- Review fallback choices receive bounded phase, ambiguity, report verdict, issue classification, and missing-field context.
- Public `handleLoop` coverage reproduces both recorded incidents and proves a semantically clean review reaches save instead of `accepted choice: block`.
- Both red scan commands recorded in the diagnosis artifacts turn green.
