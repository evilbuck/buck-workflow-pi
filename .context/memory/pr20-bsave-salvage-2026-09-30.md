---
date: 2026-09-30
domains: [tooling]
topics: [pr20-bsave-salvage, b-save]
subject: 2026-09-20.pr20-b-save-salvage
artifacts: [plan-retain-b-save-remove-kickoff.md]
related: []
priority: medium
status: completed
---
Superseded outcome: the plan's goal (retain b-save engine, remove b-kickoff) is moot-complete,
not implemented as written. PR #20's separate `extensions/b-save/` XState engine was never
landed; instead `extensions/b-save-improved/` became the live wired engine
(`extensions/index.ts` wires `wireBSaveImproved` at imports/wiring), and PR #20 was merged
with record alignment in de19a90.
Verification: `prompts/b-kickoff.md` absent from repo; no `b-kickoff` extension, skill, or
prompt surface remains; `extensions/b-save-improved/` present and registered in
`extensions/index.ts` (import line 7, wiring line 24).
Historical `.context` records for b-kickoff remain untouched, honoring the plan's
history-preservation constraint.
