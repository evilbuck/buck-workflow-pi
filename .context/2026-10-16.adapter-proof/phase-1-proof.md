---
status: pending
phase: 1
order: 1
plan: plan.md
difficulty: easy
buck_hint: /b-build
goal: "Write proof.txt containing the single line ok, then check this phase's box and set status completed."
files:
  - proof.txt
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[ ] proof.txt exists and its only line is ok"
---
# Phase 1
Write `proof.txt` with exactly `ok` and no extra lines. Check the box. Set status completed. Do not do anything else.
