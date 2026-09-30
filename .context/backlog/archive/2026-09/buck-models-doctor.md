---
title: Add `/buck-models --doctor`
status: completed
priority: medium
created: 2026-09-25
updated: 2026-09-30
completed: 2026-09-30
related:
  - .context/2026-09-25.buck-models-doctor/plan-buck-models-doctor.md
  - extensions/buck-models/index.ts
  - docs/howto/configure-buck-model-profiles.md
---

Add a read-only `/buck-models --doctor` mode that audits every saved project and user-global model selection against the live OMP registry, highlights the effective active profile, and presents a deterministic report.

## Acceptance

- Audits all configured profiles and stages without writing config.
- Uses exact live-registry `provider/id` availability.
- Highlights the effective active profile and reports unhealthy active selection.
- Documents registry-membership limits.
