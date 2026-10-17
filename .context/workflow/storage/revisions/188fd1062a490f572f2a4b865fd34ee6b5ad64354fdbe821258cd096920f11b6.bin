---
status: completed
date: 2026-09-26
updated: 2026-09-30
subject: 2026-09-25.buck-models-doctor
topics: [review, iteration, doctor, config-io]
informs: []
addresses: plan-buck-models-doctor.md
completed: 2026-09-30
from_review: b-review
memory: [buck-models-doctor-2026-09-30.md]
---

# Iteration: buck-models doctor — single-snapshot config loading

## Source
- Reviewed after: `/b-iterate`
- Plan: `plan-buck-models-doctor.md`
- Spec: none

## Critical Issues

### 1. Read each config once before classifying its models
- **File**: `extensions/buck-models/index.ts:249-281`
- **Problem**: `readDoctorLoad` gets nonempty content through `load(path)`, then discards it and calls `readBuckModelsFile(path)` for a second filesystem read. When the file disappears between reads, that helper returns `{ config: null, invalidPath: null }`; doctor reports `INFO: 0 configured` even though the first read contained a configured model. The same split read can classify a different revision of either scope than the one observed initially. An isolated reproduction with a `readText` hook that removes the file after returning its YAML produced exactly this false-healthy report. This violates plan steps 4–5 and the invalid/unreadable-config acceptance criterion.
- **Proposed fix**: Parse the text returned by the *single* read with an invalid-YAML-aware parser and retain a distinct missing-file outcome; do not reopen the path. A file that was present but cannot be loaded must yield an error, never an empty scope. Add a command-level regression test where the loader returns YAML then removes its source; the reported occurrence and missing-id status must come from that captured content.

## Warnings

### 1. Fix audit how-to severity spelling
- **File**: `docs/howto/configure-buck-model-profiles.md:25-27`
- **Problem**: The live OMP notification says `WARNING`, but the how-to instructs readers to look for `WARN`.
- **Suggested approach**: Align the prose with `INFO`/`WARNING`/`ERROR` when syncing docs. This documentation-only correction does not change the correctness verdict.

## Recommended Workflow

Run `/b-iterate` against this active artifact, then re-run `/b-review` against `plan-buck-models-doctor.md`. The live OMP smoke already observed the project available id, user-global missing id, active marker, unchanged checksums, and the no-argument scope picker; repeat after the fix if loader behavior changes.
