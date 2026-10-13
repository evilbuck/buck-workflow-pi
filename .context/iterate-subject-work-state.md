---
status: completed
date: 2026-09-19
updated: 2026-09-19
subject: 2026-09-19.subject-work-state
topics: [review, iteration]
informs: []
addresses: plan-subject-work-state.md
completed: 2026-09-19
from_review: b-review
---

# Iteration: deterministic subject work-state

## Source
- Reviewed after: `/b-iterate`
- Plan: `plan-subject-work-state.md`
- Spec: none

## Critical Issues

### 1. `b-plan-update` still instructs callers to read raw subject status
- **File**: `skills/b-plan-update/SKILL.md:72`
- **Problem**: The update protocol says to read the subject `index.md` frontmatter for `status`, despite the same skill's lifecycle guard correctly using `inspect`. This leaves a repository-owned lifecycle reader outside the canonical authority and contradicts the plan's clean-cutover requirement that `b-plan-update` stop parsing raw status. It can also make future edits rely on the persisted compatibility scalar instead of `effectiveState` and malformed-provenance handling.
- **Proposed fix**: Replace the raw `index.md` status read with the already-obtained lifecycle inspection result. Read `index.md` only for non-lifecycle subject metadata if needed, and explicitly state that lifecycle fields must not be interpreted directly. Recopy the changed skill into the physical Codex bundle if it is a `canonicalCopies` entry, then rerun the lifecycle policy audit, focused tests/parity, and guardrails.
- **Resolution**: Updated the protocol to reuse the lifecycle inspection result for subject state. `index.md` may be read only for non-lifecycle metadata; callers are explicitly forbidden from interpreting `status` or `lifecycle_*` fields directly. `b-plan-update` is not present in the physical Codex bundle, so no distribution copy required an update.

## Warnings

None.

## Previously Resolved

### TypeScript policy audit identifier indirection
- Unique `const` initializers are now resolved for path, YAML/template content, and lifecycle-bearing object payloads.
- Negative fixtures report bound writer call lines while unrelated artifact status writes and lifecycle-shaped output remain clean.

### `/b-save-improved` lifecycle refusal reporting
- The extension surfaces refusal code/blockers and ends with `checkpoint written; subject not closed` while preserving successful checkpoint work.

## Verification

- Focused plan/lifecycle/caller suite: 8 files, 151 tests passed.
- Repository lifecycle audit: `{ "ok": true, "violations": [] }`.
- Canonical/Codex lifecycle authority and test copies: byte-identical.
- Durable guardrails v2: pass; unit and global coverage ratchet passed, complexity passed, coverage 81.5%, no new complexity violations; patch coverage advisory/unavailable and lint disabled by contract.
- Fourth iteration focused checks: lifecycle and Codex parity tests passed (22/22); repository audit returned `{ "ok": true, "violations": [] }`.
- Fourth iteration light unit gate: 59 Vitest files / 951 tests passed; Bun suite 70 passed. Lint is disabled by `guardrails.json`.
- Sequential standards pass used the TypeScript guide plus diff-relevant Long Method, Duplicate Code, and Shotgun Surgery guidance. No independent standards defect exceeded the acceptance-contract violation above.

## Recommended Workflow

Re-run `/b-review` against `plan-subject-work-state.md`.
The implementation iteration is complete; the supervisor owns the remaining review and `/b-save` loop states.
