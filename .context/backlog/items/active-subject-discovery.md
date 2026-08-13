---
title: Make active-subject discovery deterministic, exhaustive, and resilient to stale state
status: active
priority: medium
created: 2026-08-12
updated: 2026-08-12
completed: null
related:
  - skills/_shared/subject-resolution.md
  - .context/2026-05-31.subject-selection-prompting/index.md
  - .context/2026-05-31.subject-selection-prompting/plan-subject-selection-prompting.md
  - .context/2026-06-05.current-session-json-design/index.md
  - .context/2026-06-05.current-session-json-design/plan-current-session-redesign.md
  - .context/2026-06-13.context-format-research/index.md
  - .context/2026-06-13.context-format-research/plan-hybrid-context-artifact-model.md
  - .context/2026-08-12.standalone-b-plan-bootstrap/index.md
  - .context/index/subjects.json
  - .context/workflow/current-session.json
---

# Active-subject discovery: deterministic, exhaustive, resilient to stale state

## Problem

The shared subject resolution protocol (`skills/_shared/subject-resolution.md`) is invoked by every `b-*` skill when arguments are absent. Today it depends on `.context/workflow/current-session.json` as the authority for "the active subject" and falls back to a one-shot scan of `.context/YYYY-MM-DD.<subject>/index.md` files. Three concrete failure modes make the protocol unreliable:

1. **Stale global state.** `.context/workflow/current-session.json` is a single, friable, frequently-rewritten file. It can point to a subject whose folder has been deleted, has been reclassified `completed`, or whose `memory_file` reference no longer matches a folder on disk. The current file (committed 2026-07-26) points to `b-init-guardrails-iteration-2026-07-26`, which is `completed` — the protocol's "fresh" branch locks onto a dead subject.

2. **Generated-machine-readable state can also be stale.** `.context/index/subjects.json` is a generated artifact from the hybrid context artifacts plan. It is convenient for `jq` queries, but it can lag behind in-flight edits (e.g., a mid-session `b-plan` that creates a new subject folder but has not yet regenerated the index). Treating it as authoritative without a freshness check reintroduces the same trap.

3. **Subject selection drops or truncates subjects.** The current "if multiple subjects, present menu" rule requires every active subject but does not define behavior when the host UI's option cap is smaller than the result set. There are 13 active subjects in this repo today while the current structured prompt accepts at most five choices. The resolver must not silently pick "the newest," truncate to a shortlist, or omit valid subjects.

## Desired outcome

Subject resolution becomes:

- **Authoritative when fresh.** When a machine-readable signal (per-subject `session.json` from the redesign plan, or `.context/index/subjects.json` with a known `generated_at`) is provably fresh for the current session *and* every referenced subject folder exists on disk, the resolver uses it.
- **Deterministic-fallback when stale or missing.** When authoritative state is stale, missing, or contradicts disk, the resolver performs a fast, complete scan of `.context/YYYY-MM-DD.<subject>/index.md` files. Reading only the `status:` line of each `index.md` is sufficient — no full plan/spec/phase reads.
- **Always exhaustive.** The menu lists **every** subject with `status: active` (or `draft` when no active subjects exist), sorted by `date` desc then subject slug. No newest-only shortcut, no truncation, no implicit shortlist.
- **Cap-aware.** When the result count exceeds the host UI's option cap, the resolver paginates with an explicit "N more — show next page / type to filter / provide a path" affordance. On plain prompts without structured-option limits, it serializes the full numbered list.
- **Authoritative stability helpers.** Subjects found via scan override stale references in `current-session.json` (or its per-subject successor): the resolver writes a brief "stale-replaced" note so subsequent phases/saves do not re-resolve to the dead subject.

## Scope

In scope:

- Redesign `skills/_shared/subject-resolution.md` to define authority, freshness, exact scan procedure, ordering, pagination, and plain-prompt handling.
- Update the freshness check for `.context/index/subjects.json` (either use a `generated_at` field with a budget, or pair it with an mtime check) so stale indexes are detected and regenerated or skipped in favor of the scan.
- Define host UI option limits as runtime-specific inputs, with a fallback to pagination when the result set exceeds the current harness's cap.
- Define the plain-prompt (no structured options) fallback: full numbered list, cap announcement, free-text narrowing.
- Add tests and fixtures covering:
  - Stale `current-session.json` referencing a deleted subject.
  - Stale `current-session.json` referencing a `completed` subject.
  - Fresh `current-session.json` (or per-subject successor) — authoritative path respected.
  - Fresh `.context/index/subjects.json` — used when in-scope.
  - Stale `.context/index/subjects.json` — scan overrides.
  - ≥ 30 active subjects — pagination triggers, no truncation.
  - Plain-prompt harness — full list serializes, cap is announced.
- Wire the per-subject-session-redesign's `scanActiveSubject()` (from `.context/2026-06-05.current-session-json-design/`) as the canonical authority helper — this item does not duplicate that logic, but defines the deterministic fallback and presentation contract that wraps it.

Out of scope:

- Replacing `.context/workflow/current-session.json` with per-subject `session.json` files (handled by the current-session-json redesign subject).
- Re-designing the hybrid JSON index format or the `scripts/context-artifacts.mjs` scanner (handled by the context-format-research subject).
- Re-implementing the standalone B-Plan bootstrap path its own way (handled by `.context/2026-08-12.standalone-b-plan-bootstrap/`).

## Acceptance criteria

- [ ] `skills/_shared/subject-resolution.md` defines an explicit authority chain: per-subject `session.json` (when implemented) → `.context/index/subjects.json` (with freshness check) → `current-session.json` (legacy) → full scan. Each step declares the freshness rule that lets it succeed and the rule that demotes it to scan.
- [ ] A `current-session.json` is authoritative only when (a) its `started_at` is within the current pi / omp session, (b) the referenced subject folder exists on disk, (c) the referenced subject's `index.md` `status:` is `active` or `draft`. Otherwise the resolver falls through to the scan. A reference to a `completed` or deleted subject is resolved as stale, not as "active".
- [ ] `.context/index/subjects.json` is authoritative only when (a) it has a `generated_at` field (or equivalent) within the freshness budget (default 5 minutes) and (b) every row references a folder that still exists on disk. Otherwise the resolver regenerates the index or falls through to the scan.
- [ ] The fallback scan reads **only** the `status:` line of each `.context/YYYY-MM-DD.<subject>/index.md` (no full-file, plan, or spec reads), using one folder glob plus targeted native file reads.
- [ ] The menu presents **every** subject with `status: active` (falling back to `draft` if zero active), sorted by `date` desc then subject slug. Subjects are never truncated to a newest-only shortlist, even when the count exceeds the host UI cap.
- [ ] When the count exceeds the current host UI's option cap, the resolver paginates with a labeled "next page" affordance and a free-text narrowing path. The user can always provide a path or substring to filter.
- [ ] On a plain-prompt harness (no structured option list), the resolver emits the full numbered list, declares the cap behavior, and accepts a `more` command, a filter substring, or a path as the next user input.
- [ ] Tests/fixtures cover at minimum: stale `current-session.json` → deleted subject; stale → `completed` subject; fresh `current-session.json` (or per-subject successor) → authoritative; fresh `.context/index/subjects.json` → authoritative; stale `.context/index/subjects.json` → scan overrides; ≥ 30 active subjects → pagination triggers and nothing is dropped; plain-prompt harness → full list serializes and cap is announced.
- [ ] The per-subject-session-redesign's `scanActiveSubject()` is the canonical authority helper once that subject lands; this item's protocol reads from it when implemented and degrades to `current-session.json` + scan while the redesign is in flight.
- [ ] No change to output of the existing single-subject resolution path (one active subject → auto-select silently) or zero-subject path (no menu, proceed fresh).

## Notes

- This item is intentionally separated from (a) the active `.context/2026-08-12.standalone-b-plan-bootstrap/` work, which addresses what B-Plan does when only itself is installed; and (b) `.context/2026-06-05.current-session-json-design/`, which addresses the global-state authority for the active subject. Both feed into this item's acceptance criteria but neither replaces it.
- The current protocol's "Step 4: Scan Subject Folders" already encodes the efficient-scan pattern; the missing pieces are the authoritative-vs-stale rules, the exhaustive-vs-truncated rule, and the cap handling.
- The "13 active subjects today" snapshot is just an example count; the design must hold for repos with single-digit and multi-dozen active subjects without changing behavior.
- The current `.context/workflow/current-session.json` references a completed subject (`b-init-guardrails-iteration-2026-07-26`) — a concrete instance of the stale-authority case this item is meant to prevent.
