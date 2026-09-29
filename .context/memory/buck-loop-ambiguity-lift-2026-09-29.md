---
date: 2026-09-29
domains: [extensions, workflow]
topics: [buck-loop, ambiguity, jev, repair-lift]
related: [buck-loop-phase1-monitor-resume-2026-09-29.md]
priority: high
status: completed
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [../extensions/buck-loop/ambiguity.ts, ../extensions/buck-loop/loop.ts, ../extensions/buck-loop/run-step.ts, ../docs/buck-workflow.md]
---

# Ambiguous postconditions are diagnosed, then lifted

An ambiguous Buck-loop postcondition no longer asks a bare "can the supervisor fix this?" question. The supervisor first writes a diagnosis from the child report and the phase disk gap, then asks Jev to classify that diagnosis as light, medium, or heavy. Light and medium continue automatically once, and the diagnosis is handed to the next skill prompt. Heavy, or an illegal/failed lift call, stops and tells the operator the diagnosis. The saved Phase 2 run is still blocked; this change applies to the next process that loads the updated loop.
