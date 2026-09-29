---
date: 2026-09-29
domains: [workflow, testing, docs]
topics: [buck-loop, ambiguous-postcondition, operator-stop, restart-gate]
related:
  - .context/2026-09-29.buck-loop-ambiguous-repair/plan-buck-loop-ambiguous-repair.md
priority: high
status: completed
subject: 2026-09-29.buck-loop-ambiguous-repair
artifacts:
  - plan-buck-loop-ambiguous-repair.md
  - iterate-buck-loop-ambiguous-repair.md
  - review-ambiguous-repair-final-2026-09-29.md
---

# Ambiguous Buck-loop repair

- The supervisor now completes a phase whose acceptance boxes are all checked without Jev. Otherwise native `noul` permits one retry only for a fixable issue at probability at least 0.8; missing/error answers stop. An operator-only prerequisite stops with the phase status, unchecked boxes, and execution checkpoint instead of continuing into a dirty-tree halt.
- Retry fingerprints files under `extensions/buck-loop/` before and after work. If the retry changes the running extension, it stops before review and preserves `Restart OMP before continuing`. A process-local gate refuses another `start`/`resume` until OMP restarts; `status`/`stop` remain available. Cross-state transitions reset retry facts.
- Review found same-process re-entry after a restart stop. The iteration added a failing integration test, implemented the gate, and final review approved with the live-restart verification boundary.
- Verification: focused Vitest 118/118 across three files; LSP diagnostics clean on touched implementation/test; `lizard -C 10 -w` found no violations; standalone temp-repo `handleLoop` smoke persisted the operator reason and held the restart reason across resume with build count 2; durable v2 guardrails verdict `pass` (required unit, global ratchet, complexity; patch pass; lint/functional skipped).
- Subject lifecycle `close-verified` refused this completed non-phased plan with `unphased plan remains open`; the canonical subject index remains `active` under its helper-owned state. Do not change lifecycle frontmatter by hand.
- The current OMP process still runs the extension loaded before this change. A fresh OMP process must exercise the SQL-memory subject with disposable URL unset to close the post-commit live check. That subject's Phase 1 has no disposable target; no SQL query or restricted child proof was performed. Its staged hold notes and other unrelated changes were left untouched.
