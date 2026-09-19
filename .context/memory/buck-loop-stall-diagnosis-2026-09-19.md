---
date: 2026-09-19
domains: [extensions, diagnosis, testing]
topics: [buck-loop, review-parser, closed-set-choice, todo-test]
related:
  - ../2026-09-19.buck-loop-stall-diagnosis/research-buck-loop-stall.md
  - ../backlog/items/buck-loop-contextless-choice-stall.md
priority: high
status: completed
subject: 2026-09-19.buck-loop-stall-diagnosis
artifacts:
  - research-buck-loop-stall.md
  - ../backlog/items/buck-loop-contextless-choice-stall.md
---

# buck-loop stall diagnosis

`../todo-test` Phase 3 stopped by accepted legal choice `block`, not a crash. A clean review emitted `##` impact headings while the scanner required exact `###`, making the report unparseable. The recovery chooser then received only enum names—not phase or review context—and rationally reported that no task was specified.

The two persisted review copies are byte-identical, no iterate artifact existed, and the chooser JSON was valid. A minimal harness proved heading depth was the parser trigger; a runtime prompt probe proved the chooser had no task, phase, review, or artifact context.

Follow-up: tolerate realistic impact heading levels and provide bounded ambiguity context to closed-set choice. Public-seam regression should replay the incident and route the clean review to save.
