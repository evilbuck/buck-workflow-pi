---
date: 2026-09-07
domains: [skill, buck-workflow, docs]
topics: [b-plan-update, plan-revision, in-place-edit, revision-log, sibling-skill, removal-review, mockups, artifacts, phase-drift, catalog, b-plan, b-phase]
subject: 2026-09-07.b-plan-update-skill
artifacts: [plan-b-plan-update-skill.md, skills/b-plan-update/SKILL.md, prompts/b-plan-update.md, commands/b-plan-update.md, README.md, docs/buck-workflow.md]
related: []
priority: medium
status: completed
---

# Session: b-plan-update skill shipped

Built the new sibling skill `b-plan-update` end-to-end. Plan, code, and catalogs all landed; smoke proof confirmed the protocol's observable behavior; full Vitest + Bun suite still green.

## Outcome

Shipped `/b-plan-update`: an in-place plan revision skill that complements `/b-plan` (which only creates fresh plans). The skill:

- Resolves the active subject via the shared `skills/_shared/subject-resolution.md` protocol.
- Picks a target plan (excludes `plan-*-phases.md`, prefers formal plans over `plan-draft-*.md`).
- Takes three input channels: explicit request/`$ARGUMENTS`, session context, new artifacts.
- Builds a four-bucket change set (Additions / Modifications / Explicit removals / Implicit removals).
- Interweaves additions and modifications into the plan's existing sections — never a delta section.
- Removes explicit drops immediately with `(explicit)` log tags.
- Gates implicit removals behind a numbered `ask`-style review list with evidence; logs `(reviewed: confirmed|rejected|deferred)`.
- Re-scans the plan body for dangling references and prunes acceptance criteria / verification / affected-files in the same update.
- Appends a single `## Revision Log` entry with `Added/Modified/Removed/Inputs` bullets.
- Sets `updated: YYYY-MM-DD` frontmatter; preserves original `date`.
- Flags spec conflict (when frontmatter `spec:` exists) without diverging silently.
- Flags phase drift when `plan-*-phases.md` or `phase-N-*.md` exist; never edits phase files.
- Emits a fixed output block (changes counts, inputs, drift, conflict, recommended next step).

## Files shipped

- `skills/b-plan-update/SKILL.md` (12.5 KB) — canonical skill
- `prompts/b-plan-update.md` (209 B) — thin wrapper, mirrors `prompts/b-plan.md` shape
- `commands/b-plan-update.md` — symlink to `../prompts/b-plan-update.md` (verified `readlink`)
- `README.md` — 2 new rows (command table L195, skills table L228)
- `docs/buck-workflow.md` — QRT row (L385), detail section `#### /b-plan-update — Update Existing Plan` (L684), Discoverability bullet (L1522)

## Verification

- **Vitest**: 27 files, **442 passed**, 0 failed (8.37s)
- **Bun** (test:bun): **70 passed**, 0 failed (5.90s)
- **Symlink**: `readlink commands/b-plan-update.md` → `../prompts/b-plan-update.md`; `diff` against source = identical
- **Catalogs**: README has 2 hits; docs/buck-workflow.md has 4 hits
- **README tail**: `## Hybrid Context Indexes`, `## Cross-Reference System`, `## Requirements`, `## Compatibility`, `## License` all present; file ends with newline
- **Manual smoke proof**: created `.context/2099-01-01.plan-update-smoke/` fixture, applied the skill's update protocol (explicit removal of feature X, modified step 2 to mockup-driven flow, added step 3 for error states, renumbered old step 3 → step 4), verified `updated: 2099-01-01` frontmatter, `## Revision Log` entry with `(explicit)` tag, no dangling references, mockup artifact copied to `assets/mockup-v2.png`. Subject cleaned up post-proof.

## Conventions adopted

- **Three-layer architecture respected**: skills canonical, prompts/commands thin wrappers. No command-only wrapper.
- **No capability probe** — `b-plan-update` is self-contained like `b-iterate`; downstream recommendations conditional on the active loader's catalog, never blocking.
- **Write boundary mirrors b-plan**: `.context/**` and temp scratch only; no bash redirects; no source files outside `.context/`.
- **README edit-safety rule** (lesson from 2026-09-04 `b-recap` insert): re-read tail after each README table edit to catch trailing-section clobber. Applied without incident this session.
- **Auxiliary skill, not chain step**: `b-plan-update` does not appear in the main workflow chain diagrams. Like `b-iterate`, it is invoked on demand.

## Risks / follow-ups

- **README anchor drift**: README.md line numbers shifted after the two inserts (plan used ~194, ~227). Future README-wide edits may require re-locating `b-plan-update` rows by content (`/b-plan-update`) rather than line number.
- **docs/buck-workflow.md anchor drift**: original anchors ~384, ~690, ~1490 were correct as of 2026-09-07 but the file is large; the contingency clause in the plan instructs future editors to relocate by content (`b-plan`) not line.
- **No tests**: `b-plan` itself has no tests; `b-plan-update` follows the same shape. If a follow-up demands tests, the skill's protocol is pure markdown editing — a smoke harness against fixtures in `/tmp` would suffice.
- **Phase drift false positives**: the skill emits a warning whenever phase files exist, even if the plan change is trivial. If this becomes noisy, add a content-diff heuristic.

## Session state pointer

`.context/workflow/current-session.json` still references the prior b-nasa-prd session (started_at 2026-09-04, subject `2026-09-04.b-nasa-prd-skill`). Stale pointer; not updated by b-save. If the harness expects `current-session.json` to track the latest b-save, surface to the user — out of scope here.