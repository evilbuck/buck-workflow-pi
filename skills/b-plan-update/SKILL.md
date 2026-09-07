---
name: b-plan-update
description: Apply new context, new prompts, and new artifacts (mockups, screenshots, research) to an existing plan in place — interweaving additions, removing features with warning and review when implicit, and appending a revision log. Use when the user wants to update, revise, or refine an existing plan-*.md.
---

# b-plan-update: In-Place Plan Revision

Update an existing `plan-*.md` in place rather than replacing it. Interweave new content into the plan's existing sections, gate implicit removals behind user review, and append a revision log entry. Flag phase drift so the user knows when `/skill:b-phase` should be re-run.

This skill is an **auxiliary companion to `/b-plan`** — it never creates a new plan and never edits phase files. If no plan exists, it stops and points the user at `/b-plan`.

## Write Boundary

- You may write to `.context/**` and temporary scratch locations using native file tools (write/edit).
- Update the target `plan-*.md` in place. The filename never changes; history lives in git plus the in-file `## Revision Log`.
- Do not modify source files outside `.context/`.
- Do not modify phase files (`plan-*-phases.md`, `phase-N-*.md`) — flag drift instead.
- **Allowed**: Native directory, listing, read, write, and edit tools for relevant `.context/**` artifacts and temporary scratch files.
- **Blocked**: Bash redirects (`>`) and file modifications outside `.context/**`.

## Subject Resolution

Follow the shared protocol at `skills/_shared/subject-resolution.md` verbatim. If the protocol resolves a subject, use it for all downstream artifact discovery. If the protocol finds no subject, work from the user's inline description.

After subject resolution, read the subject's `index.md` and verify its `status:` field. This skill operates on plans belonging to subjects whose status is `active` or `draft`.

## Plan Target Selection

Scan the resolved subject folder for `plan-*.md` files. Apply these rules in order:

1. **Exclude** `plan-*-phases.md` — that file is owned by `b-phase` and is never a target.
2. **Prefer** formal plans over `plan-draft-*.md` when both exist (formal = exact pattern `plan-*.md` minus `-draft-` and `-phases`).
3. **Exactly one candidate** → use it silently.
4. **Multiple candidates** → STOP and present a numbered menu. WAIT for user input.
5. **Zero candidates** → STOP with:

```text
No plan to update in this subject. Run `/b-plan` to create one.
```

**Status guard:**

- If `index.md` `status:` is `active` or `draft` → proceed.
- If `index.md` `status:` is `completed` → STOP and ask. Only on explicit user confirmation, set `index.md` back to `status: active` and record the reopen in the revision log under `## Revision Log` with an `Added:` entry noting "subject reopened for update".

## Input Intake

Three input channels, used together:

1. **Explicit instructions** from the current request and `$ARGUMENTS` — the user's stated edits, additions, removals, and clarifications.
2. **Established session context** — prior decisions, constraints, and discussion already in the conversation or in session memory.
3. **New artifacts** the user provides — mockups, screenshots, design briefs, research notes, screenshots of error states, etc.

**Artifact placement rule:**

- Artifacts living **outside** the subject folder are **copied in**:
  - Binaries (PNG/JPG/SVG/PDF/etc.) → `.context/<subject>/assets/` with a descriptive filename (`mockup-v2.png`, `error-state.png`).
  - Markdown / text → the subject folder root.
  - Then referenced from the plan by relative path (`assets/mockup-v2.png`).
- Artifacts already inside the subject folder are referenced in place.
- **Unfetchable URLs** (network blocked, link broken): reference the URL and note it in `## Revision Log` under `Inputs:` so a future session can resolve it.

Do not block on a missing artifact — proceed with what is available and note the gap.

## Update Protocol

This is the core procedure. Follow in order:

### 1. Read fully before editing

- Read the target plan end-to-end (no partial reads — section boundaries matter).
- Read the subject `index.md` frontmatter (status, subject name).
- Read any artifact listed under `research:` in the plan's frontmatter that the user has just superseded or amended.

### 2. Build the change set

Classify every change into one of four buckets:

- **Additions** — new sections, new implementation steps, new acceptance criteria, new artifacts being referenced.
- **Modifications** — rewordings, scope narrowing, acceptance criteria sharpening, step re-orderings.
- **Explicit removals** — the user directly said "drop X", "remove Y", or equivalent. Remove immediately, log under `## Revision Log` as `Removed: … (explicit)`.
- **Implicit removals** — new information makes an existing feature/section incompatible, obsolete, or conflicting with new context. **Never remove silently.** Present a numbered removal-review list (one round, `ask`-style menu — mirror b-plan's Clarification Interview with a recommended answer):

```text
Implicit removals to review:

1. <feature/section name> — <why incompatible> — evidence: <input that triggered this>
2. <feature/section name> — <why incompatible> — evidence: <input that triggered this>

Recommended action: confirm both (most conservative when new info clearly supersedes the old).

  [1] Confirm all
  [2] Confirm #1 only
  [3] Confirm #2 only
  [4] Reject all — keep features, record tension under assumptions
  [5] Other
```

Per-removal outcomes:
- **Confirmed** → remove from the plan, log `Removed: … (reviewed: confirmed)`.
- **Rejected** → keep the feature, record the tension under `## Context used / assumptions` or an explicit "Open Questions" section, and append `Removed: … (reviewed: rejected — kept; tension recorded)`.
- **Deferred** → mark the feature inline with `⚠️ pending removal review — <reason>` AND log `Removed: … (reviewed: deferred — flagged inline)`. Never leave an implicit removal un-recorded.

### 3. Apply edits by interweaving

- **Interweave** Additions and Modifications into the plan's existing sections — never append a separate "delta" or "changes" section.
- Match the plan's heading style (it may use `# Plan:`, `## User Goal`, `## Goal`, `## Scope`, `## Out of scope`, `## Affected files`, `## Implementation steps`, `## Acceptance criteria`, `## Verification`, `## Risks`, `## Context used / assumptions`, etc.). Preserve casing, level, and emoji-free style.
- **Renumber implementation steps** when insertions land mid-sequence. Steps added mid-sequence take the next free numbering after renumber.
- Acceptance criteria, verification items, and affected-files entries follow their parent step's numbering.
- Preserve all formatting (lists, code fences, tables) of existing content you keep.

### 4. Structural consistency pass

After every edit batch, re-scan the plan body for references to features/sections that were removed in this update:

- Acceptance criteria that reference removed features → prune or rephrase.
- Verification items that mention removed features → prune.
- Affected-files entries that point to removed artifacts → prune.
- Inline references like "see X above" that now dangle → fix or remove.

Complete this pass in the same update — never leave dangling references to removed content.

### 5. Frontmatter updates

- Set `updated: YYYY-MM-DD` (today).
- Keep original `date` and `status` (unless the status guard in Plan Target Selection reopened the subject — then set `status: active`).
- Append new entries to `research:` and `iterations:` when new artifacts informed the update.
- Back-fill `informs:` on newly referenced research files (mirror b-plan's Cross-Reference Stitching rules, including its full-mode-only applicability: if b-plan would not have stitched the back-link in non-full mode, do not stitch it here either).

### 6. Revision Log

Append to `## Revision Log` at the end of the plan body (create the section if absent). Each update produces exactly one entry. Use this shape:

```markdown
### YYYY-MM-DD — <one-line summary>
- Added: <…>
- Modified: <…>
- Removed: <…> (explicit | reviewed: confirmed | reviewed: rejected | reviewed: deferred)
- Inputs: <comma-separated list — e.g. "session context, request prompt, assets/mockup-v2.png">
```

The summary line should be terse — one sentence capturing the change's nature (e.g. "mockup-driven flow replaces step 2; error states added").

If the subject was reopened (status guard override), add an extra bullet at the top of the entry:
`- Subject reopened from completed to active for this update.`

### 7. User Goal handling

- If the update changes the user goal, rewrite `## User Goal` and log the rewrite under `Modified:`.
- If the plan lacks `## User Goal`, ask once: "This plan has no `## User Goal` section. Should I draft one based on the current plan content?" On refusal, flag it in the output block as a gap. Soft, non-blocking — mirror b-build's flag pattern; do not block the update.

### 8. Spec guard

If the plan's frontmatter sets `spec:` and the update diverges from that spec:

- Flag the conflict in the output block (see Output section).
- Recommend resolving at spec level first: open the spec, update it there, then re-run `/b-plan-update`.
- Never silently diverge from a spec.

## Phase Drift

If `plan-*-phases.md` or `phase-N-*.md` exist in the subject folder:

- **Never edit them.** They are owned by `b-phase`.
- After completing the plan update, emit a prominent output warning that phases are stale relative to the updated plan.
- Recommend re-running `/skill:b-phase` (phrased conditionally on the active loader's discoverability — if the loader exposes `/skill:b-phase`, say so directly; otherwise say "if your loader exposes the `b-phase` skill, re-run it").

If no phase files exist, the drift warning is skipped silently.

## Output

After updating, always report this block exactly (substituting the bracketed values):

```text
Plan updated: .context/<subject>/plan-<topic>.md
Changes: N added, M modified, K removed (a explicit, b reviewed-confirmed, c reviewed-rejected, d reviewed-deferred)
Inputs used: [request, session context, <artifact list>]
Revision log: appended YYYY-MM-DD entry
Phase drift: stale phases detected — re-run /skill:b-phase | none
Spec conflict: none | flagged: <…>
User goal gap: none | flagged: <…> (plan lacked ## User Goal)
Subject status: active | reopened from completed
Recommended next step
```

**Recommended next step defaults:**

- Default: `/b-build` against the updated plan.
- If the update added ambiguity or risk → `/b-build-hard` against the updated plan.
- If phase drift was flagged → `/skill:b-phase` re-run (conditional on loader discoverability).
- Always conditional on the active loader's slash-command catalog — never assume.

## Behavior summary

- Self-contained like `b-iterate` — no capability probe. Downstream recommendations are conditional on the active loader's native catalog; never blocking.
- Subject → plan target → input intake → change-set classification → in-place edits → structural consistency → frontmatter → revision log → output. The order matters; do not skip steps.
- Prefer small, focused updates over sweeping rewrites.
- Hand back to `/b-build` or `/b-build-hard` when done.

## Closeout

After reporting the output block:

1. **Changed files** — list the plan path updated plus any copied artifacts.
2. **Verification** — confirm the in-place file is well-formed (frontmatter valid, sections present, revision log appended, no dangling references).
3. **Recommended next step** — surface the output block's recommended next step to the user.

Do not commit. Do not call `/b-save`. These are owned by the user-facing workflow.

## Best For

- New design context (mockups, screenshots) arriving mid-implementation.
- Spec or requirement changes that touch existing features.
- Re-scoped implementation after discovery (`/b-explore` or `/b-research`).
- Pre-build revision before `/b-phase` or `/b-build`.
- Implicit conflicts surfaced by research findings the plan did not anticipate.

## Out of Scope

- Creating a new plan (use `/b-plan`).
- Editing `plan-*-phases.md` or `phase-N-*.md` (use `/skill:b-phase`).
- Editing specs (open the spec and update it directly, then re-run `/b-plan-update`).
- Bulk multi-plan rewrites across subjects.