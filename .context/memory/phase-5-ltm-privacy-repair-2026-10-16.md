---
date: 2026-10-16
domains: [storage, privacy, memory]
topics: [phase-5, ltm-handoff, publication]
related: [../2026-10-10.durable-storage-adapters/iterate-phase-5-current-state-2026-10-15.md]
priority: high
status: active
subject: 2026-10-10.durable-storage-adapters
artifacts:
  - extensions/b-save-improved/index.ts
  - extensions/b-save-improved/__tests__/wire.test.ts
  - skills/b-save-improved/SKILL.md
  - .context/2026-10-10.durable-storage-adapters/implementation-notes-phase-5.md
---

# Phase 5 standalone save LTM privacy repair

`buildRetainInstruction()` previously embedded scribe `retain_facts` directly into an unscoped harness-LTM instruction. The save handoff has no publication-proven adapter revision input, so the safe behavior is to withhold all facts and skip `retain`/`learn` rather than infer publication from scribe prose. A regression test failed before the change by observing a private fact in the message and passed after it (wire suite 22/22). The user-facing b-save-improved procedure documents this fail-closed boundary.

This closes the private LTM handoff finding only. Other active Phase-5 defects in `iterate-phase-5-current-state-2026-10-15.md` remain unresolved.