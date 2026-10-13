---
status: completed
date: 2026-09-07
subject: 2026-09-07.b-plan-update-skill
topics: [b-plan-update, plan-revision, skill-creation, in-place-edit, revision-log]
memory: [memory-b-plan-update-skill-2026-09-07.md]
---

# Plan: Add `b-plan-update` skill — in-place plan revision for Buck Workflow

## Context

`/b-plan` today treats an existing `plan-*.md` only as *input context* (`skills/b-plan/SKILL.md:127`, "existing `plan-*.md` when refining or replacing a plan") and then writes a fresh plan — replacing, not merging. There is no protocol for interweaving new discussion context, a new prompt, or new artifacts (mockups/screenshots) into an existing plan, no removal gate (nothing warns when new info invalidates a planned feature), and no revision tracking. User decision (this session): implement as a **new sibling skill `b-plan-update`** (repo three-layer architecture: skills = canonical logic, prompts/commands = thin wrappers; a command-only wrapper would violate it), which **updates `plan-*.md` files only and flags phase drift** instead of editing phase files.

End state: `/b-plan-update` (and `prompts/b-plan-update.md` on Pi/installed harnesses) resolves the subject, picks the target plan, merges new inputs in place, gates implicit removals behind user review, appends a revision log, and warns when `b-phase` artifacts are now stale.

## Approach

### Step 1 — Create `skills/b-plan-update/SKILL.md`

New file; no equivalent exists (b-plan is creation-oriented; `design-brief/SKILL.md:57,100` only stitches a reference into a plan, it does not merge content). Frontmatter:

```yaml
---
name: b-plan-update
description: Apply new context, new prompts, and new artifacts (mockups, screenshots, research) to an existing plan in place — interweaving additions, removing features with warning and review when implicit, and appending a revision log. Use when the user wants to update, revise, or refine an existing plan-*.md.
---
```

Sections, in order, with these normative rules (compose full prose; every rule below is binding):

1. **Write Boundary** — mirror b-plan's: may write `.context/**` and temp scratch only via native file tools; no bash redirects; no source files outside `.context/`.
2. **Subject Resolution** — follow `skills/_shared/subject-resolution.md` verbatim (link it). No capability-probe table: this skill is self-contained like `b-iterate`; downstream recommendations are conditional on the active harness's loader-native catalog, never blocking.
3. **Plan Target Selection** — scan the resolved subject folder for `plan-*.md`, **excluding** `plan-*-phases.md` (owned by `b-phase`, never a target) and preferring formal plans over `plan-draft-*.md` when both exist. Exactly one → use silently. Multiple → numbered menu, wait. Zero → stop: "No plan to update in this subject. Run `/b-plan` to create one." Status guard: subject `index.md` must be `active` (or `draft`); if `completed`, stop and ask — only on explicit user confirmation, set `index.md` back to `status: active` and record the reopen in the revision log.
4. **Input Intake** — three channels, used together: (a) explicit instructions from the current request/`$ARGUMENTS`; (b) established session context (prior decisions, constraints); (c) new artifacts the user provides (mockups, screenshots, briefs, research). Artifact placement rule: any artifact living outside the subject folder is **copied in** — binaries into `.context/<subject>/assets/`, markdown into the subject folder root — then referenced by relative path (`assets/mockup-v2.png`). Artifacts already inside the subject folder are referenced in place. Unfetchable URLs: reference the URL and note it in the revision log.
5. **Update Protocol** (core):
   - Read the target plan and subject `index.md` fully before editing.
   - Build a change set classified as **Additions / Modifications / Explicit removals / Implicit removals**:
     - Additions & Modifications: **interweave into the plan's existing sections** (User Goal, Goal, Scope, Out of scope, Affected files, Implementation steps, Acceptance criteria, Verification, Risks) — preserve the plan's heading style, renumber implementation steps, never append a "delta" section. Steps added mid-sequence take the next free numbering after renumber.
     - Explicit removals (user directly said "drop X"): remove immediately, log as `removed at user request`.
     - Implicit removals (new info makes an existing feature incompatible, obsolete, or conflicting): **never remove silently**. Present a numbered removal-review list — each entry: feature/section, why incompatible, which input evidences it — and wait. Confirmed → remove + log. Rejected → keep and record the tension under assumptions/open questions. Deferred → mark the feature inline with `⚠️ pending removal review — <reason>` + log.
   - Structural consistency pass after edits: no dangling references to removed features — re-scan the plan body for removed feature names and prune their acceptance criteria, verification items, and affected-files entries in the same update.
   - Frontmatter: set `updated: YYYY-MM-DD` (today); keep original `date`; append new entries to `research:`/`iterations:` when new artifacts informed the update; back-fill `informs:` on newly referenced research files (mirror b-plan's Cross-Reference Stitching rules, including its full-mode-only applicability).
   - **Revision Log**: append to `## Revision Log` at the end of the plan body (create if absent), entry shape:
     ```markdown
     ### YYYY-MM-DD — <one-line summary>
     - Added: <…>
     - Modified: <…>
     - Removed: <…> (explicit | reviewed: confirmed | deferred)
     - Inputs: session context, request prompt, assets/<file>
     ```
   - User Goal handling: if the update changes the user goal, rewrite `## User Goal` and log it. If the plan lacks `## User Goal`, ask once; on refusal flag it in the output as a gap (soft, non-blocking — mirror b-build's flag, do not block the update).
   - Spec guard (one rule, not a section): if the plan's frontmatter sets `spec:` and the update diverges from that spec, flag the conflict in the output and recommend resolving at spec level first; never silently diverge.
6. **Phase Drift** — if `plan-*-phases.md` or `phase-*.md` exist in the subject: never edit them; emit a prominent output warning that phases are stale relative to the updated plan and recommend re-running `/skill:b-phase` (phrased conditionally on loader discoverability).
7. **Output** — after updating, always report this block:
   ```text
   Plan updated: .context/<subject>/plan-<topic>.md
   Changes: N added, M modified, K removed (a explicit, b reviewed-confirmed), P pending removal review
   Inputs used: [request, session context, artifact list]
   Revision log: appended YYYY-MM-DD entry
   Phase drift: stale phases detected — re-run /skill:b-phase | none
   Spec conflict: none | flagged: <…>
   Recommended next step
   ```
   Recommended next step defaults: `/b-build` (or `/b-build-hard` if the update added ambiguity/risk) against the updated plan; `/skill:b-phase` re-run when drift was flagged — both conditional on loader discoverability.

### Step 2 — Create `prompts/b-plan-update.md` (thin wrapper)

Exact content, mirroring `prompts/b-plan.md`'s shape:

```markdown
---
description: Apply new context, artifacts, and scope changes to an existing plan in place
---

# B-Plan-Update

$ARGUMENTS

Load and follow the `b-plan-update` skill:

```
skills/b-plan-update/SKILL.md
```
```

### Step 3 — Create the OMP command symlink

```bash
ln -s ../prompts/b-plan-update.md commands/b-plan-update.md
```

(Verified pattern: `commands/b-plan.md -> ../prompts/b-plan.md`.) The installer needs no edit — `scripts/install.mjs` globs `prompts/*.md` and `skills/*/` per harness.

### Step 4 — Register in catalogs

1. `README.md` command table (row after `/b-plan`, ~line 194):
   `| \`/b-plan-update\` | \`b-plan-update\` | Apply new context, artifacts, and scope changes to an existing plan in place |`
2. `README.md` skills table (row after `b-plan`, ~line 227):
   `| \`b-plan-update\` | Update an existing plan in place — interweave additions, remove with review, revision log |`
3. **README edit-safety rule** (repo lesson, 2026-09-04): after each README table edit, re-read the file tail to confirm no trailing sections (`## Hybrid Context Indexes` onward through `## License`) were clobbered; restore from HEAD if they were.
4. `docs/buck-workflow.md` Quick Reference Table (row after the `b-plan` row, ~line 384):
   `| [**b-plan-update**](#b-plan-update--update-existing-plan) | Prompt template + Skill | \`/b-plan-update\` | \`prompts/b-plan-update.md\` + \`skills/b-plan-update/\` | Apply new context, artifacts, and scope changes to an existing plan in place |`
5. `docs/buck-workflow.md` detail section `#### /b-plan-update — Update Existing Plan` inserted immediately after the `/b-plan` detail section ends (~line 690, before the `b-phase` section): back-link to Quick Reference, `**Pi/OMP primitive**: Prompt command (prompts/b-plan-update.md in Pi, commands/b-plan-update.md symlink in OMP)`, then a Behavior/When-to-Use/Next-Steps summary restating: subject + plan-target selection, three intake channels, interweave-not-delta, removal gates (explicit vs implicit-with-review), revision log, `updated:` frontmatter, phase-drift flag, spec-conflict flag.
6. `docs/buck-workflow.md` skills list (~line 1490): add `- /b-plan-update` directly after `- /b-plan`.

Do not touch the main workflow chain diagrams in either file — `b-plan-update` is an auxiliary skill (like `b-iterate`), not a chain step.

## Critical files & anchors

- `skills/b-plan/SKILL.md` — reference for Write Boundary wording, Cross-Reference Stitching rules, Output block style (lines 65–71, 239–257, 608–637). Read, don't edit.
- `skills/_shared/subject-resolution.md` — the protocol Step 2 of the new skill links verbatim.
- `skills/b-iterate/SKILL.md` — precedent shape for a self-contained sibling skill without a capability probe.
- `README.md` ~194, ~227 — two catalog insert points; tail re-read after each edit.
- `docs/buck-workflow.md` ~384, ~690, ~1490 — three insert points.

## Verification

1. Symlink: `readlink commands/b-plan-update.md` → `../prompts/b-plan-update.md`.
2. Catalog consistency: `grep -c "b-plan-update" README.md docs/buck-workflow.md` → ≥2 and ≥3 hits respectively; plus each row renders inside its table (no broken pipe counts).
3. README tail intact: `read README.md` last ~60 lines still contain `## Hybrid Context Indexes` … `## License` and the file ends with a newline.
4. Suite: `npm test` in repo root — no test touches these paths (context-artifacts tests run against `/tmp` fixtures), so expect 386 passing, 0 new failures. Session is docs-only per the guardrails predicate (all added paths are `.md` + one `.md` symlink) — state the skip in one line.
5. End-to-end manual proof (the real behavior check): in the repo, create a throwaway subject `.context/2099-01-01.plan-update-smoke/` with `index.md` (`status: active`) and a minimal `plan-demo.md` (frontmatter + User Goal/Scope/2 implementation steps/1 acceptance criterion). In a fresh OMP session (repo `.omp/skills` → `../skills` link loads project skills), run `/b-plan-update` with instructions: "step 2 replaced by a mockup-driven flow; add step 3 for error states; feature X from step 1 is obsolete". Confirm observable output: plan file edited in place with steps interwoven and renumbered; `updated: 2099-01-01` in frontmatter; `## Revision Log` entry appended listing added/removed with `(explicit)`; the implicit obsolescence of feature X produced a removal-review list. Phase drift: none (no phases file). Spec conflict: none.

## Assumptions & contingencies

- **In-place update, no versioned files**: filename never changes; history lives in git + the in-file revision log. If a user asks for a snapshot copy before updating, copy to `plan-<topic>.pre-update-YYYYMMDD.md` in the same folder first, then proceed in place — offer this only when the update is large (≥ half the plan body changed).
- **Removal-review interaction style**: numbered list, one round, `ask`-style menu — mirror b-plan's Clarification Interview (one question at a time, recommended answer included).
- **No new tests**: `b-plan` itself has no tests (pure prompt/skill, no scripts); `b-plan-update` is the same shape. If review later demands one, it belongs to a follow-up, not this change.
- **Contingency**: if `docs/buck-workflow.md` line anchors have shifted by implementation time (file edited since 2026-09-07), re-locate insert points by the `b-plan` row/section/skills-list entries — the anchors are logical (after `b-plan`), not absolute.