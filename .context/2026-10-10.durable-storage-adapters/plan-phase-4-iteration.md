---
status: completed
date: 2026-10-12
subject: 2026-10-10.durable-storage-adapters
addresses: iterate-phase-4-native-access-review.md
---
# Phase 4 iteration

## User Goal

Users get one trustworthy durable access surface: they can choose durable storage
per project, resume reliably, and keep unmerged work invisible on other branches.
This iteration repairs the in-plan Phase 4 findings so the native role is actually
enforced rather than advisory — a restricted child must not reach another project's
private bodies or write outside its checkout.

Repair the ten in-plan review findings: preserve trusted backend selection; serialize identity registration; enforce child execution restrictions; enable ordinary CLI lifecycle/correction/receipts and token reads; resolve visible published references; retain bridge-returned tokens; move PostgreSQL dependencies into the portable shared tree; preserve recalled revision identity; throw native execution failures; keep immutable repo authority outside Git.

Verify real canonical and isolated bundled CLI operations, native denial/store failures, published overlays/private token denial, concurrent process identity stability, plan bridge readback, and recall/correction. Run the durable check contract without weakening gates. Stage only this assignment's modifications; leave all initial unrelated and prior implementation changes untouched.

Security decision: unrestricted host execution cannot enforce the native role. Nested stages receive Linux Bubblewrap-isolated `workflow_exec`, never host bash. Commands retain build/test/smoke capability without host configuration, stores, credentials or network. Git metadata is read-only except in the commit checkpoint stage; staging remains supervisor-owned. Missing isolation fails closed. Native visibility permissions remain unchanged, including at commit.

Verification: final durable guardrails pass at 88.8% (baseline 84%); focused
surface regressions 87/87; actual native/CLI/isolated-bundle, receipt, private
manifest and isolated worktree-commit smokes passed. Evidence and limitations
are recorded in `research-phase-4-iteration-verification.md`.
