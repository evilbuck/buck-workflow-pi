---
status: active
date: 2026-06-05
subject: 2026-06-05.current-session-json-design
topics: [session-state, design, merge-conflicts, git-tracking, papertrail, handoff, multi-machine, planning]
related: [2026-06-05.session-json-origin]
informs: []
artifacts: [research-current-session-json-design.md, plan-current-session-redesign.md]
---

# Subject: Redesign `.context/workflow/current-session.json` (handoff-aware)

User pain points:
1. The file is constantly causing merge conflicts.
2. The user wants to hand off an in-flight workflow to a different machine (the git repo is the sync layer).

Goal: move the session state into a per-subject file under the subject folder, commit it, derive the active subject from `git log -1 --format=%ct`. Apply the same pattern to `grill-session.json`.

## Resolved design choices

- **Active-subject resolution**: option (a) — `git log -1 --format=%ct -- <subject>/session.json`. Authoritative, no extra fields, no mtime-after-checkout issues.
- **Per-subject session.json**: commit the whole file (it IS the handoff payload).
- **Grill-session parallel**: same pattern (per-subject `grill-session.json`).
- **Bootstrap behavior**: preserve workflow state and history fields; reset per-pi-session flags (`started_at`, `implementation_happened`, `save_completed`); append `handoff: { from_started_at, received_at, machine }` audit metadata.

## Plan summary

The implementation is broken into 4 sequential phases (each with its own verification gate):

1. **Subject-scoped session helpers** — refactor `extensions/index.ts` core. New helpers: `subjectSessionPath`, `readSubjectSession`, `writeSubjectSession`, `bootstrapSubjectSession`, `scanActiveSubject`.
2. **Active-subject resolution** — implement `scanActiveSubject()` and update `skills/_shared/subject-resolution.md`.
3. **Migration + cleanup** — `git rm --cached` legacy file, update `.gitignore`, CHANGELOG, README. One-time state migration on first bootstrap.
4. **Grill-session parallel** — same treatment for `extensions/b-grill-auto/grill-state.ts` and `extensions/b-grill-auto/index.ts`.

Plan exceeds b-phase thresholds (4 phases, 9+ files, multi-layer). Run `/skill:b-phase` after this plan to break it into Ralph-ready units.

## Artifacts

- [research-current-session-json-design.md](research-current-session-json-design.md) — full audit, lifecycle table, handoff validation, 3 design options, recommended design, open questions
- [plan-current-session-redesign.md](plan-current-session-redesign.md) — implementation plan: goal, scope, affected files, 4 phases, verification, risks
