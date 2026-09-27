---
date: 2026-09-25
domains: [planning, extensions, models, docs]
topics: [buck-models, doctor, model-registry, diagnostics]
related: [buck-models-blank-active-2026-09-25.md, buck-model-config-phase-6-build-2026-09-24.md]
priority: medium
status: completed
subject: 2026-09-25.buck-models-doctor
artifacts: [plan-buck-models-doctor.md]
---

# `/buck-models --doctor` plan

Planned a read-only doctor mode that audits every saved project and user-global model selection against the live OMP registry. The user chose all-profile coverage with the effective active profile highlighted.

The plan keeps the existing no-argument editor unchanged, uses exact `provider/id` membership, reports config/registry failures without false health, preserves each scope/profile/stage location, and explicitly excludes provider connectivity or inference probes.

Artifact: `.context/2026-09-25.buck-models-doctor/plan-buck-models-doctor.md`. Subject lifecycle inspection returned canonical `active` revision 2. The work is a bounded non-phased `/b-build` unit. Planning changed only `.context/**`, so the code guardrails gate was not applicable.
