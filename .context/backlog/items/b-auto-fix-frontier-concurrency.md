---
title: b-auto-fix frontier concurrency
status: active
priority: low
created: 2026-09-10
updated: 2026-09-10
completed: null
related:
  - .context/2026-09-10.mattpocock-adoption/plan-mattpocock-findings-remediation.md
  - .context/2026-09-10.mattpocock-adoption/plan-mattpocock-findings-remediation-phases.md
---

# b-auto-fix frontier concurrency

Run `b-auto-fix` across multiple ready issues concurrently, working the frontier of `ready-for-agent` items in parallel rather than one issue at a time.

Deferred from the 2026-09-10 mattpocock/skills adoption plan ([plan-mattpocock-findings-remediation.md](../../2026-09-10.mattpocock-adoption/plan-mattpocock-findings-remediation.md), Tier 4): sequential auto-fix delivers the core value first, and concurrency interacts with tracker state (`b-triage` output) that is itself still landing — parallelize only after the single-issue path is proven. Not on the audit's rejected list.
