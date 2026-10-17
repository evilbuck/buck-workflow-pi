---
status: completed
date: 2026-09-10
updated: 2026-09-10
subject: 2026-09-10.mattpocock-adoption
topics: [review, phase-1, mattpocock-remediation]
addresses: phase-1-live-defects.md
from_review: b-review
verdict: pass-with-warnings
---

# Plan Path Review: Phase 1 — Live Defects (mattpocock remediation)

## Plan Source
- File: `.context/2026-09-10.mattpocock-adoption/phase-1-live-defects.md` (parent: `plan-mattpocock-findings-remediation.md`)
- Goal: Make the repo self-consistent — ship the MIT notice, write the tracker config the skills already read, align b-research with always-on bootstrap policy, and capture the Tier-4 backlog.
- Baseline: working tree vs HEAD `0d1dbf7` (all Phase 1 work uncommitted); patch/complexity gates compare vs `origin/master` (`f797174`, merge-base of HEAD).

## Evidence Sources
- Git status: 9 modified files, 12 untracked (THIRD-PARTY-NOTICES.md, docs/agents/, 10 backlog/context files) — all within the phase's declared file list except two benign `.context` bookkeeping edits (see Out-of-scope).
- Recent commits: `0d1dbf7 docs: add mattpocock/skills overlap audit and report` (pre-existing HEAD; adds `scripts/serve-presentations.{ts,test.ts}`).
- Modified files verified directly: THIRD-PARTY-NOTICES.md, package.json, skills/b-grill-with-docs/{SKILL,CONTEXT-FORMAT,ADR-FORMAT}.md, docs/agents/{issue-tracker,triage-labels}.md, skills/b-issue-create/SKILL.md, skills/fix-pr/SKILL.md, skills/b-research/SKILL.md, .context/backlog/todo.md, 8 Tier-4 item files.
- Commands re-run independently by this review: `npm pack --dry-run`, upstream LICENSE fetch + byte diff, `bun x vitest run --coverage`, lizard complexity scan, lcov patch-coverage computation, docs/agents reference grep.

## Completion Matrix

| Criterion | Status | Evidence |
|------|--------|----------|
| D1: THIRD-PARTY-NOTICES.md at root, upstream MIT permission notice, `Copyright (c) 2026 Matt Pocock` verbatim | ✅ complete | File exists at repo root. Full license block **byte-identical** to `raw.githubusercontent.com/mattpocock/skills/main/LICENSE` (fenced block extracted and `diff`-compared: zero differences). Copyright line verbatim. |
| D1: `npm pack --dry-run` lists THIRD-PARTY-NOTICES.md | ✅ complete | Pack output line: `npm notice 1.6kB THIRD-PARTY-NOTICES.md`. `package.json` diff adds `"THIRD-PARTY-NOTICES.md"` to `files:` (+1 line). |
| D1: provenance headers on both format files; one-line origin note in SKILL.md | ✅ complete | `CONTEXT-FORMAT.md:1` and `ADR-FORMAT.md:1`: `<!-- Derived from mattpocock/skills (MIT) — see THIRD-PARTY-NOTICES.md. -->`. `skills/b-grill-with-docs/SKILL.md:57` carries the origin note directly below the two format-file references (lines 53–55). |
| D1: format-file diffs show ONLY the added header | ✅ complete | `git diff` numstat: CONTEXT-FORMAT.md +2/−0, ADR-FORMAT.md +2/−0; both hunks at `@@ -1,3 +1,5 @@` — header + blank line prepended, zero content lines touched. |
| D2: docs/agents/{issue-tracker,triage-labels}.md exist, describe GitHub / evilbuck/buck-workflow-pi | ✅ complete | Both files exist. issue-tracker.md: "Tracker: **GitHub Issues** on `evilbuck/buck-workflow-pi`", `gh` + `issue://` addressing, creation-flow convention. triage-labels.md: `ready-for-agent` / `needs-triage` vocabulary with what each gates (incl. b-auto-fix input state, `labels_skip` cross-ref). |
| D2: every `docs/agents/*.md` reference in skills resolves | ✅ complete | Recursive grep over `skills/`: exactly 2 distinct paths (`b-issue-create/SKILL.md:38-39`, `fix-pr/SKILL.md:247`); both resolve on disk (2/2). |
| D2: b-issue-create reads both docs conditionally | ✅ complete | `skills/b-issue-create/SKILL.md:37`: "**Issue-tracker conventions (when present — a consumer repo may have neither file)**". fix-pr:247 uses the same posture: "see `docs/agents/triage-labels.md` when present; confirm with `gh label list` first". |
| D3: b-research states background-subagent default, OMP `task` path, portable fallback, foreground exception | ✅ complete | `skills/b-research/SKILL.md:10-17` "## Dispatch (Default: Background Subagent)": default is explicit ("the **default**, not an option"), OMP path (`task` + read-only research/scout agent, async), portable fallback (sequential foreground, same subject/write-gate/artifact model), foreground exception (trivial lookup or no background dispatch). |
| D3: skill section and GLOBAL_OR_PROJECT-AGENTS.md § b-research agree in intent (side-by-side recorded) | ✅ complete | Side-by-side below. Agreement: yes. |
| Tier 4: one backlog item per deferred deliverable, each linked from todo.md | ✅ complete | 8/8 items exist in `.context/backlog/items/` (b-phase-ready-frontier-expand-contract, b-prototype, b-grill-round-frontier-mode, b-auto-fix-frontier-concurrency, code-smells-depth-axis-blueprint-visuals, b-which-catalog-router, b-retro, wayfinder); todo.md "### Tier 4 deferred (2026-09-10 mattpocock adoption)" links all 8; every link resolves; count matches the phase's deferred list; wayfinder carries its N4 gate; no items filed for the rejected list. Spot-read items are well-formed (frontmatter, rationale, plan back-links). |
| Guardrails verdict recorded; `contract: "none"` recorded not silently passed | ✅ complete | Re-measured independently; verdict recorded verbatim below. Note: the phase's risk note ("repo currently resolves `contract: none`") is stale — `guardrails.json` exists, so the contract resolves **durable v2**. Durable session-memory record lands at `/b-save` (step 4 of the phase loop, after this review). |

### D3 side-by-side (recorded per phase verification)

| GLOBAL_OR_PROJECT-AGENTS.md § b-research (L186–190) | skills/b-research/SKILL.md Dispatch (L10–17) |
|---|---|
| "**Always delegate to a subagent.** `b-research` is a heavy, multi-source investigation — offload it. Never bundle external research into the main agent's context." | "Background subagent dispatch is the **default**, not an option. `b-research` is a heavy, multi-source investigation — never bundle it into the main agent's context." |
| "**Run asynchronously when helpful.** … dispatch in the background; keep working on the main thread and surface findings when the subagent returns. Don't block the conversation waiting on it." | "**OMP path**: dispatch via the `task` tool with a read-only research/scout agent. Run asynchronously — keep working on the main thread and surface findings when the subagent returns. Do not block the conversation waiting on it." |
| (no fallback stated) | "**Portable fallback**: run the same procedure sequentially in the foreground… same subject folder, write-gate, and artifact model; only the concurrency is lost." |
| (no exception stated) | "**Foreground exception**: run inline only when the lookup is trivial… or the harness cannot dispatch background work." |

Agreement in intent: **yes** — the skill restates the policy's default and async posture near-verbatim. The skill's foreground exception is not a contradiction: the phase contract itself requires stating it, and the policy's "run asynchronously *when helpful*" already admits the same latitude.

## Verification Status
- Goal achieved: **yes** — notice ships, tracker config exists and is read conditionally, b-research skill no longer contradicts always-on policy, Tier-4 list captured durably.
- User goal: **met (for this phase's slice)** — downstream npm consumers now receive the MIT notice with the redistributed files; shipped skills no longer read config that was never written; deferred list survives even if execution stops here.
- Scope adhered: **yes** — all changes fall in the phase's declared file list, plus two benign `.context` bookkeeping edits (below). No format-file content rewrite (the D1 risk); no `b-init-tracker` over-reach (N3 stayed in Phase 5); no README/catalog edits (none required).
- Out-of-scope changes: `.context/2026-09-10.mattpocock-skills-overlap/research-mattpocock-skills-overlap.md` gained an `informs:` cross-reference to the remediation plan (+2/−1 frontmatter lines) — standard buck-workflow cross-referencing from the planning session, not a scope violation. Two extra backlog items (`mattpocock-adoptions.md` umbrella, `mattpocock-audit-defects.md` Phase-1 tracker) are plan bookkeeping registered in todo.md, within the declared `.context/backlog/` scope.

## Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: **fail** (patch gate; pre-existing — see Issue Classification)
- Gates: unit_test_gate=pass (499/499 tests, 28 files, re-run 2026-09-10), functional_test_gate=skipped (`functional_test_cmd: null`), lint_gate=skipped (`lint_cmd: null`), patch_gate=**fail** (89.8% < 90%), global_ratchet=pass (72.92% > baseline 54.9% — baseline update reportable), complexity_gate=**fail on stale baseline** (pre-existing; see below)

Independent re-measurement detail:
- **Patch gate**: the only coverable file in `origin/master...worktree` is `scripts/serve-presentations.ts` — 88/98 lines covered = 89.8%; 10 missing lines (289–292, 295–296, 299, 301, 303–304). That file was added by **pre-existing commit `0d1dbf7`** (current HEAD, predates this session). Phase 1's diff contains **zero coverable lines** (markdown, one `package.json` array entry, `.context` files). Already tracked: `items/patch-gate-branch-coverage.md`.
- **Complexity gate**: lizard reports `extensions/b-save-improved/index.ts parseArgs` CCN 48 (absent from `guardrails.json` baseline inventory) and `skills/b-hindsight-import-projects/scripts/import-projects.ts parseArgs` CCN 68 vs baseline 66. **Both files are byte-identical to `origin/master`** (not in the branch diff at all) — this is drift between the recorded baseline and current master state, not Phase 1 work. Related: `items/complexity-burn-down.md`.
- Phase 1 acceptance only requires the verdict be **recorded, not passed** ("Record the verdict; do not silently pass") — satisfied by this report; `/b-save` must copy it into session memory.

## User Goal Analysis
- Goal: "a repo whose shipped skills do not read config files that were never written — plus downstream consumers who stop receiving MIT-licensed third-party text with no notice" (parent plan, Phase-1 slice; debugging on-ramp and review axes belong to later phases).
- Met: MIT notice ships on npm (pack-verified); tracker config exists and skills degrade cleanly without it; b-research policy contradiction resolved; Tier-4 capture survives an execution stop (plan Q4 default).
- Partial: —
- Missing: — (remaining user-goal slices are Phases 2–5 by design)
- Verdict: **met** for this phase's slice.

## Documentation Impact
- No documentation impact — the phase's deliverables *are* the living documentation (THIRD-PARTY-NOTICES.md, docs/agents/ convention docs, skill-text alignment). No convention, decision, or domain term realized here remains undocumented. (Optional, non-blocking nicety: a README pointer to THIRD-PARTY-NOTICES.md; MIT does not require it since the notice ships in the package.)
- Recommended: none.

## How-to Impact
- No how-to impact — no new or changed user-facing action (no new command, keybinding, or everyday sequence).
- Recommended: none.

## Issue Classification
- In-plan issues (implementation defects → `/b-iterate`): **none** — all 11 acceptance criteria verified complete with direct current-state evidence; no `iterate-*.md` written.
- Out-of-plan issues (scope discoveries → follow-up, do not block this phase):
  1. **Patch gate fails at 89.8% from pre-existing `scripts/serve-presentations.ts` (commit `0d1dbf7`)** — 10 uncovered lines (289–304). Pre-existing branch state; Phase 1 added zero coverable lines. Route: existing backlog item `items/patch-gate-branch-coverage.md` (consider refreshing its stale "failed at 51%" note), or cover the 10 lines before merging this branch.
  2. **Complexity baseline drift** — `b-save-improved/index.ts parseArgs` (CCN 48) missing from `guardrails.json` baseline inventory; `import-projects.ts parseArgs` measures 68 vs recorded 66 — both files identical to `origin/master`. The recorded baseline is stale relative to master. Route: `/b-init-guardrails` refresh (per the check skill's `ratchet_update` protocol) at a coherent point; related `items/complexity-burn-down.md`.
  3. **Stale phase risk note** — phase file asserts the repo resolves `contract: "none"` and backlog item `run-b-init-guardrails-on-repo.md` remains open, but `guardrails.json` (durable v2) exists. Informational; close or amend the backlog item during `/b-save`.

## Verdict
**Pass with warnings** — driven by in-plan issues only, of which there are none. The guardrails `fail` is recorded (as the phase's own acceptance criterion demands) and is proven pre-existing branch state: the failing lines and complexity drift exist identically on `origin/master`+`0d1dbf7` with zero contribution from Phase 1's diff. Out-of-plan findings do not change this verdict.

## Recommended Next Step
Close accepted work: `/b-save` (record this verdict + guardrails verdict verbatim in session memory; amend the stale guardrails backlog item) → `/b-commit`. Then follow-up out-of-plan work: cover `serve-presentations.ts:289-304` (existing `patch-gate-branch-coverage` item) and refresh the guardrails baselines via `/b-init-guardrails` — before any Phase 2 code-touching session, since the patch gate will keep failing on this branch until the 10 lines are covered or the commit range changes.
