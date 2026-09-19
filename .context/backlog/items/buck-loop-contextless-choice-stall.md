---
title: Fix buck-loop context-free choice stalls
status: active
priority: high
created: 2026-09-19
updated: 2026-09-19
completed: null
related:
  - .context/2026-09-19.buck-loop-stall-diagnosis/research-buck-loop-stall.md
  - extensions/buck-loop/choice.ts
  - extensions/buck-loop/scan.ts
  - extensions/buck-loop/loop.ts
---

# Fix buck-loop context-free choice stalls

A semantically clean `b-review` report used `##` impact headings, missed the scanner's exact `###` contract, and entered fallback choice. The chooser received only legal enum names, selected `block` because no task context was present, and stopped an otherwise successful run.

## Acceptance

- Realistic `##` and canonical `###` review impact sections produce the same review facts.
- Review fallback choices receive bounded phase, ambiguity, and artifact context.
- Public `handleLoop` coverage reproduces the `../todo-test` incident and proves the clean-review path reaches save instead of block.
- The original red scan command recorded in the diagnosis turns green.
