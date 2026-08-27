---
date: 2026-08-27
domains: [tooling, quality]
topics: [guardrails, complexity-gate, override, b-save-improved-parity]
related: [bsave-improved-parity-2026-08-27.md]
priority: high
status: completed
subject: 2026-08-26.deterministic-bsave
artifacts:
  - .context/backlog/items/complexity-burn-down.md
---

# Guardrails override — complexity gate (b-save-improved parity session)

**Failing gate**: `complexity_gate` (durable contract v2, `guardrails.json`).

**Override** (explicit user approval, 2026-08-27): proceed to
/b-review → /b-save → /b-commit despite the failing complexity gate.

**Reason**: all six remaining violations pre-date this session's diff —
verified with `git diff -U0` (session hunks touch only digest/classify/
assemblePayload in `extensions/b-save-improved/index.ts`, and preflight/
apply scripts). The flagged functions came from earlier commits:
`runBSaveImproved`/`parseArgs` from the 2026-08-26 deterministic-bsave
implementation (PR #10 work), `import-projects.ts parseArgs` worsened by
`a3db1fd`, `parseModelResponse`/`findPlanExit`/`isPlanArtifactEnabled`
from earlier sessions. Root cause: `baseline_complexity_inventory`
predates those additions.

Additionally, `parseArgs@48` is a lizard measurement artifact — reported
span `@32-677` glues the whole file into the function; real CCN ≈ 11.

**Session-attributable state**: every function this session touched was
refactored to ≤ 9 cyclomatic (buildDigest 8, collectPieces 5,
applySubjectIndex 9, validatePayload 1, helpers 2–7). Unit gates pass
(427 vitest + 70 bun), patch coverage 90.21% ≥ 90, coverage ratchet
54.9 → 70.01.

**Follow-up**: `.context/backlog/items/complexity-burn-down.md`.
