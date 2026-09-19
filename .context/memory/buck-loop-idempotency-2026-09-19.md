---
date: 2026-09-19
domains: [buck-loop, extensions]
topics: [idempotency, state-machine, retries]
related: []
priority: medium
status: active
subject: 2026-09-19.ideas-questions
artifacts: [research-buck-loop-idempotency.md]
---

# buck-loop idempotency (docs/ideas.md Q7)

PARTIALLY IDEMPOTENT. State machine + resume + choice/scan: idempotent. Two gaps: (1) non-atomic projection write (`persist.ts:103-104` plain `writeFileSync`, corrupt JSON → idle, bookmark lost); (2) step retry re-fires identical worker prompt with no pre-edit checkpoint — partial build landings get duplicate edits; only `builtPhaseLanded()` and `git status` detect prior success. Bounded: one retry/step, iterate ceiling 3, tick ceiling 64. Research: `.context/2026-09-19.ideas-questions/research-buck-loop-idempotency.md`. Remediation candidates: tmp+rename persist, pre-edit hash snapshot, chooser scan context.
