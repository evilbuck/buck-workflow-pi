---
date: 2026-10-03
status: completed
domains: [workflow, analytics]
topics: [omp-sessions, skill-usage]
informs: []
---

# OMP skill usage, trailing six months

Request: rank the five most-used skills from `~/.omp/agent/sessions/` across projects.

Window: April 3, 2026 through the analysis snapshot on October 3, 2026 (local time, UTC−04:00). Filter message timestamps, not file modification times.

Method: explicit invocation evidence is primary; successful skill reads and distinct parent sessions are retained separately. Count native skill-prompt events, expanded wrappers, leading skill commands, explicit skill-load requests, and recognized historical save/commit prompt bodies. Normalize commit and hard-build aliases. Do not count incidental mentions, bootstrap catalogs or assistant recommendations. Use jq 1.8.2 with timestamp filtering and line-by-line JSON decoding; fold subagent activity into parent sessions and exclude this analysis.

Complete enumeration: 1,197 transcripts; 1,195 included after excluding this session and its advisor; 621 parent sessions, 574 subagent files, 60 project directories. Initial glob truncation was resolved by partitioning queries. Earliest available record is May 31, so the archive does not cover April 3–May 30. One malformed Unicode tool-result line without a skill path was skipped.

Results: 370 explicit invocations, 1,461 successful skill-read records, 167 ranked identifiers including every current repository skill. Top explicit invocation counts: b-review 50; b-save 44; b-build 42; git-commit 39; b-plan 38. Session-based ranking: b-plan 87; b-review 86; b-save 78; b-build 75; git-commit 67.

Durable deliverables:
- [Full ranked report and methodology](../../docs/skill-usage-2026-10-03.md)
- [Reusable aggregate JSON](../../docs/skill-usage-2026-10-03.json)

Verification: saved JSON rank ordering, unique identifiers, source totals, inventory coverage, invocation/read/session invariants and documented reuse queries pass jq assertions. The current-repository query returns all 64 skills. Raw transcripts and private prompt text are not persisted in the aggregate artifacts. Documentation-only investigation; no project source edits or deterministic project check requirement. Backlog priorities unchanged.
