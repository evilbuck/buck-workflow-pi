---
status: active
date: 2026-08-26
subject: 2026-08-26.deterministic-bsave
topics: [b-save-improved, parity, digest, auditor-evidence, cross-references, subject-index]
research: []
iterations: []
spec:
memory: [../memory/deterministic-bsave-2026-08-27.md]
---
# Plan: b-save-improved artifact parity with b-save

## User Goal

Engineers who run `/b-save-improved` get session records — memory file, subject `index.md`, memory index entry — as rich and readable cold as the ones `/b-save` leaves, so adopting the deterministic checkpoint costs zero fidelity.

## Goal

Close the six remaining fidelity gaps identified by comparing `.context/2026-08-26.deterministic-bsave/` (improved) against `.context/2026-08-26.b-commit-placeholder-sentinels/` (b-save) after `8d0f1cb`.

## Context used / assumptions

- User-provided context: "We seem to be missing a lot of fidelity" (artifact comparison request), then "How do we achieve parity?" on the six-item gap table → this plan.
- Session context: PR #10 review fixed in `8d0f1cb` (slug containment, index idempotency, loose-artifact allowlist, subject-index enrichment). Remaining gaps verified against code this session.
- Artifacts used: `.context/memory/fix-pr-10-2026-08-26.md` (gap table with file:line evidence), `.context/2026-08-26.b-commit-placeholder-sentinels/` (parity exemplar).
- Code evidence:
  - `buildDigest` marks chat pieces `always: false` (`extensions/b-save-improved/index.ts:99`) — first user message drops first under the 12k cap.
  - `assembleApplyPayload` uses verdicts only as a completion gate; `evidence` is discarded.
  - `applyCrossrefs` only touches `preflight.plans`; specs never get `memory:` back-fill or `plans:` entries.
  - `applySubjectIndex` fills only empty bodies; re-saves never append sections.
  - `classifyTool` keeps only `write|edit|read` (`index.ts:118`) — bash/test activity invisible to the scribe.
- Assumptions:
  - Parity target is the b-save exemplar's *shape* (sections present, cross-refs stitched), not verbatim prose — prose quality is the scribe's job.
  - The scribe prompt's heading contract from `8d0f1cb` (User Goal / What happened / Decision / What shipped / Verification / Leftover / Related) is the canonical section set.
- Open questions: none material. (Light Grill skipped — scope was pre-reviewed by the user as the six-item table before `/b-plan` was invoked.)

## Scope

1. **Pin the session goal in the digest** — mark the *first* user chat piece `always: true` in `buildDigest` so the User Goal survives cap truncation. Keep dropping from the middle as today.
2. **Land auditor evidence in `## Verification`** — carry `verdicts[].evidence` through `assembleApplyPayload` into the apply payload; `save-apply` deterministically appends `- \`<path>\` — <evidence>` lines under the memory body's `## Verification` (create the section if the scribe omitted it; idempotent on re-run).
3. **Spec cross-reference stitching** — preflight reads each plan's `spec:` frontmatter field; apply (a) adds specs to the crossref set so specs get `memory:` back-fill, and (b) appends the plan filename to the spec's `plans:` array when missing.
4. **Subject index body append** — `applySubjectIndex` on an existing non-empty body appends any missing `## What shipped` / `## Verification` / `## Related` sections (extracted from the memory body as on the empty-body path); skip headings already present.
5. **Widen digest activity signal** — `classifyTool` emits one-line summaries for `bash` (command truncated to ~120 chars) so test runs and builds reach the scribe.
6. **Golden parity test** — a fixture-based test runs preflight + apply against a synthetic subject with canned scribe/auditor outputs and asserts the exemplar shape: subject `index.md` frontmatter keys (`status`, `date`, `subject`, `topics`, `memory`) + sections; memory body sections; memory index two-line entry; spec `memory:`/`plans:`; verification evidence lines.

## Out of scope

- Rewriting historical thin memories (`deterministic-bsave-2026-08-26.md` stays as-is until the next checkpoint).
- `/b-save` (prompt) changes — it remains the reference implementation.
- Retain/learn (step 8) behavior — already handed to the mainline agent.
- Digest cap size changes — 12k stands; pinning (item 1) addresses the goal-loss failure mode.

## Affected files

- `extensions/b-save-improved/index.ts` — items 1, 2, 5 (digest + payload assembly)
- `skills/b-save-improved/scripts/save-apply.ts` — items 2, 3b, 4
- `skills/b-save-improved/scripts/save-preflight.ts` — item 3a (plan `spec:` field)
- Tests: `extensions/b-save-improved/__tests__/wire.test.ts`, `handler.test.ts`, `skills/b-save-improved/scripts/save-apply.test.ts`, `save-preflight.test.ts` (item 6 lands here)
- `skills/b-save-improved/SKILL.md` — contract notes for items 2–4

## Implementation steps

1. `buildDigest`: track first user piece; set `always: true` on it. Test: entries exceeding `DIGEST_CAP` still contain the first user text.
2. `assembleApplyPayload`: include `verification_evidence: [{path, evidence}]` from `complete` verdicts. `applyMemory`/`applySubjectIndex`: append evidence lines under `## Verification` idempotently.
3. Preflight: add `spec` to each plan entry from frontmatter. Apply: crossref specs (`memory:` back-fill) + `appendFrontmatterListItem(spec, "plans", planFilename)`.
4. `applySubjectIndex`: extend the empty-body path to append missing sections to existing bodies.
5. `classifyTool`: accept `bash`, emit `bash <command.slice(0,120)>`.
6. Add the golden parity test asserting the exemplar shape end-to-end.

## Acceptance criteria

- [x] Digest over cap retains the first user message (test proves it)
- [x] Memory body `## Verification` contains auditor `file:line` evidence lines; re-run apply does not duplicate them
- [x] Spec file gains `memory:` entry and `plans:` entry after a checkpoint that completes its plan
- [x] Existing subject index body gains missing What shipped/Verification/Related sections; headings already present are untouched
- [x] Digest contains bash one-liners for test/build commands
- [x] Golden parity test passes and fails if any exemplar shape regresses
- [x] All existing b-save-improved tests stay green

## Verification

- `npx vitest run skills/b-save-improved/scripts/save-apply.test.ts skills/b-save-improved/scripts/save-preflight.test.ts extensions/b-save-improved/__tests__/wire.test.ts extensions/b-save-improved/__tests__/handler.test.ts`
- Manual smoke: run `/b-save-improved --dry-run` in this repo; confirm the report shows evidence/crossref/spec actions without writes.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` (or `/b-build-hard` if ambiguity appears) against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this plan), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this plan. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next turn.

## Risks

- Digest growth from bash lines → the existing drop-from-middle cap logic absorbs it; pinned first-user message is unaffected.
- Spec `plans:` stitching depends on plans carrying a `spec:` frontmatter field; plans without it are skipped silently (matches b-save behavior).
- Subject-index section append must key on exact headings to stay idempotent; the golden test locks this.
- Auditor evidence arriving as untrusted model text — it is markdown-quoted into Verification only; no path interpolation, so no containment surface.
