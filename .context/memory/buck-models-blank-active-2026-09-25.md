---
date: 2026-09-25
domains: [extensions, buck-loop, models]
topics: [buckModels, missing-active, error-message]
related: []
priority: high
status: completed
---

# Blank buckModels active stop

The 10:37 `/buck-loop` block was `buckModels active name "" is missing (stage "build")`, not a dirty tree. Project `.omp/config.yml` is absent. User-global `~/.omp/agent/config.yml` now has `active: Default`, but that file was written at 16:03, after the block.

A blank active name is no longer reported as `active name ""`. One configured profile is used. Zero or several profiles stop with the stage, the two config locations, the profile names, and `/buck-models`. Saving a profile while active is blank writes that profile name as active.

Focused tests: `extensions/omp-models.test.ts`, `extensions/buck-loop/__tests__/run-step.test.ts`, `extensions/index.test.ts` — 66 passed. Durable guardrails failed `complexity_gate` on pre-existing uncommitted `extensions/buck-models/model-picker.ts` `handleInput` (16) and `extensions/buck-models/index.ts` `runCommand` (11). Those files were already dirty and were not part of this fix.
