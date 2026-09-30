---
date: 2026-09-30
domains: [tooling]
topics: [buck-models-doctor, model-registry]
subject: 2026-09-25.buck-models-doctor
artifacts: [plan-buck-models-doctor.md, iterate-buck-models-doctor.md, iterate-buck-models-doctor-read-once.md]
related: []
priority: medium
status: completed
---

`/buck-models --doctor` shipped in PR #51 (commit 76e722e; review fixes 7c9b4a7, a490963): `extensions/buck-models/doctor.ts` (380 lines) holds the pure inventory, active-profile precedence, severity selection, and report formatting; `doctor.test.ts` (336 lines) plus `index.test.ts` cover cross-scope inventory, exact `provider/id` matching, active highlighting, ordering, severity, and read/registry failure fail-closed behavior; `index.ts` routes `--doctor` before the interactive editor and awaits the doctor run.

The read-once iterate issue is verified fixed: `readDoctorLoad` reads each config path exactly once and parses the captured text via `parseBuckModelsOnce`; `runDoctor` calls `load(ctx.cwd)` once per command run. The vanishing-file false-healthy report can no longer occur.

Verification: focused tests pass (`doctor.test.ts`, `index.test.ts`); durable guardrails pass (second review); live OMP v18.3.2 smoke showed one available project id, one missing user-global id, the `*active*` marker, unchanged config SHA-256 hashes, and the no-argument scope picker. Review fixes: IO failures reported as `ERROR` ("could not be read"), throwing registry aborts, how-to severity spelling corrected to `INFO`/`WARNING`/`ERROR` (a490963).
