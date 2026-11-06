---
status: complete
date: 2026-09-10
subject: 2026-09-10.mattpocock-adoption
topics: [review, phase-5, re-review]
addresses: phase-5-tracker-init-and-triage.md
from_review: b-review
supersedes: first-pass review of same date (verdict was Needs work)
---

# Plan Path Review: Phase 5 — Tracker Init & Triage (re-review)

## Plan Source
- File: `.context/2026-09-10.mattpocock-adoption/phase-5-tracker-init-and-triage.md`
- Goal: generalize tracker config to any repo (`b-init-tracker`, Sections A+B only) and add the missing inbound stage (`b-triage`)
- Baseline: commit `6f33737` + uncommitted working tree on `feat/matt-pocock-adapt`
- This document supersedes the first-pass review: the 2 in-plan P2 defects and 3 P3 polish findings it raised have been re-verified against the current working tree.

## Re-verification of First-Pass Findings

| # | First-pass finding | Status | Evidence |
|---|---|---|---|
| 1 | [P2] Missing unverified-claim refusal gate | ✅ **fixed** | `skills/b-triage/SKILL.md:109-114` — step 3 now ends with "**Gate: an unverified claim is not triaged.** A failed or not-yet-performed verification **blocks** `ready-for-agent` and **blocks** writing an agent brief — route to `needs-info` … or keep gathering context instead. The maintainer may explicitly override via the quick state override below; absent that, **do not skip this gate**." Hard-rule language (blocks / do not skip), single stated exception = maintainer quick-override — exactly the phase contract. The old advisory line ("makes a much stronger agent brief") is gone. |
| 2 | [P2] Partial-config trap in `b-init-tracker` | ✅ **fixed** | `skills/b-init-tracker/SKILL.md:36-46` — Explore now checks each docs file **independently** ("do not treat the pair as one unit… Whichever is **missing, still run its section** to create it… even when its sibling already exists") and names the self-heal case explicitly ("a partial prior run … must self-heal on the next run rather than silently skipping the missing file forever"). Present-findings step (L49-55) matches: per-file skip for existing, per-file question for missing "even if the sibling file is present". The old "if either exists → configured" wording is gone; existing files remain read-only (L38-39, reaffirmed at L119-121). |
| 3 | [P3] GitLab surface gate never fires | ✅ **fixed** | `skills/b-init-tracker/issue-tracker-gitlab.md:18-22` — now literally "**PRs as a request surface: no** by default (`b-triage` checks this exact phrase regardless of tracker; GitLab calls these merge requests, but the config line stays \"PRs\" for a consistent gate)". Flipping `no`→`yes` yields the exact substring `b-triage`'s SKILL.md:25 keys on ("PRs as a request surface: yes"). GitHub seed (L18) uses the identical phrase; the section heading still says "Merge requests as a triage surface" but the gate keys on the config line, not the heading. |
| 4 | [P3] Managed-block label summary over-claims its source | ✅ **fixed** | `AGENTS.md:291` now reads "`ready-for-agent` and `needs-triage` state labels plus a `bug`/`enhancement`/`documentation` category axis; neither state label is guaranteed to exist in the tracker yet (`gh label list` first)." Every clause traces to `docs/agents/triage-labels.md` (re-read this pass): table rows 1-2 = the two state labels, row 3 = the three-category axis, Rules bullet 1 = non-guaranteed existence + `gh label list`. The "five canonical roles… mapped 1:1" claim is gone from the block. |
| 5 | [P3] Category labels unscaffolded | ✅ **fixed** | `skills/b-init-tracker/triage-labels-seed.md:14-19` — new "Category axis, orthogonal to the state roles above" section with a `bug`/`enhancement` table and the one-state-role-plus-one-category-role rule, matching `b-triage` SKILL.md's Roles section. Five state roles retained above it. |

## Idempotency Proof (re-derived against the NEW block wording)
- **Issue tracker line** (`AGENTS.md:287`): "GitHub Issues on `evilbuck/buck-workflow-pi`, addressed via the `gh` CLI and `issue://<N>` internal references" — unchanged; still faithfully derivable from `docs/agents/issue-tracker.md` (tracker line, CLI conventions, `issue://<N>` reference). ✅
- **Triage labels line** (`AGENTS.md:291`): now **fully doc-derived**. Two state labels, three-category axis, existence caveat, and `gh label list` instruction all recompute from `docs/agents/triage-labels.md` alone — no dependency on the skill's seed vocabulary remains (the first-pass weakness). A strictly doc-derived recomputation reproduces the block; byte-no-op on re-run rests on the skill's explicit byte-compare/replace-in-place rule (SKILL.md:107-112) as before, but the summary no longer asserts anything the source doc doesn't establish. ✅ byte-stable re-derivation holds.
- Marker hygiene unchanged: exactly one `BEGIN/END b-init-tracker` pair (L280/L292), sibling of `b-init-guardrails` (END at L279), no nesting.
- Caveat (unchanged from first pass): single working-tree snapshot — two literal runs still not observable; the proof is re-derivation + the mechanical rule, not an executed second run.

## Regression Sweep
- Grep for "as a request surface": exactly three sites — GitHub seed (`: no` default), GitLab seed (`: no` default + exact-phrase note), `b-triage` SKILL.md:25 checker. Consistent; no leftover "MRs as a request surface" anywhere. Local seed carries no surface line (absence ⇒ gate stays off — safe default, pre-existing and unflagged in the first pass).
- Gate language appears only in `b-triage` SKILL.md (no stale copies in prompts/, docs/, or README); surrounding steps 2–5 read coherently — step ordering, the `needs-info` routing, and the quick-state-override cross-reference all resolve.
- `b-init-tracker` SKILL.md intro still says "five canonical triage roles" — accurate for the **seed** vocabulary (five state roles in `triage-labels-seed.md`), distinct from the AGENTS.md block which now describes this repo's actual doc. No conflict.
- `docs/agents/*.md` remain byte-untouched vs baseline (`git status`: only `AGENTS.md`, `THIRD-PARTY-NOTICES.md`, phase-file status among tracked changes) — fixes landed in skill bodies and the managed block only, as prescribed.
- No new dangling references; no typos or broken sentences found in the edited regions.

## Verification Status
- Goal achieved: yes (both skills shipped, wired, N3 exercised against this repo; all five first-pass in-plan findings resolved)
- User goal (skills don't read config that was never written): met, and the partial-config caveat is now closed — `b-init-tracker` self-heals a missing sibling file.
- Scope adhered: yes; out-of-scope changes: none.

## Guardrails Verdict
- Contract: durable · version: 2
- Status: **— (docs-only)** — unchanged: the working-tree diff remains exclusively markdown skill bodies, prompt wrappers, symlinks, and doc/notice hunks; no executable code.

## Outstanding (non-blocking, carried forward unchanged)
- Out-of-plan issue 1: `ready-for-agent` ↔ `b-auto-fix` coupling is nominal (assignee-based selection), not mechanical — separate `/b-plan` if wanted.
- Out-of-plan issue 2: catalog wiring landed inside the phase-4 commit (`6f33737`) — history hygiene note for the phase-5 commit message.
- Standards-axis residue (nits): AI-disclaimer prefix absent from needs-info/brief templates; label vocabulary stated in four sites; H1/H2 managed-block heading drift vs b-init-guardrails; en-GB/en-US mix; `gh label list` named in the provider-neutral labels seed. None block.

## Verdict
**Pass** — all five in-plan findings from the first-pass review are resolved in the current working tree; the idempotency proof re-derives cleanly against the corrected block wording; the regression sweep found no new issues. Out-of-plan findings remain follow-up work and do not affect this verdict.

## Recommended Next Step
`/b-save` → `/b-commit` (note the phase-4 catalog-wiring provenance in the commit message). Out-of-plan issues 1–2 → separate `/b-plan` if wanted; promote `b-which` per the phase's skill-count risk note.

