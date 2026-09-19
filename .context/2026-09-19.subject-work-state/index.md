---
status: active
date: 2026-09-19
subject: 2026-09-19.subject-work-state
topics: [subjects, lifecycle, scan, buck-loop, closeout, reopen]
---

# Subject: deterministic subject work-state

Architecture so `/buck-loop` and `b-plan` do not treat a finished epic as the place for new work. Subject lifecycle transitions are centralized in one deterministic TypeScript intent authority across skills, active save flows, runtime extensions, and the byte-identical Codex bundle; enforcement is a dedicated PR policy audit, not a lifecycle hook or unit-test disguise.

## Artifacts

| File | Type | Description |
|---|---|---|
| `plan-subject-work-state.md` | Plan | Plan-scoped phases plus canonical lifecycle intents, complete caller cutover, active-save closeout, explicit reopen, bundle parity, and CI enforcement |
| `research-buck-loop-build-timeout.md` | Research | Diagnosis and correction for productive nested builds killed by the former fixed 15-minute wall-clock timeout |
