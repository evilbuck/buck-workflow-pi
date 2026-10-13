---
status: completed
phase: 1
order: 1
plan: plan-mattpocock-findings-remediation.md
phases_overview: plan-mattpocock-findings-remediation-phases.md
difficulty: medium
model_hint: capable general model preferred — three unrelated defects, one with a legal dimension
buck_hint: /b-build
goal: "Make the repo self-consistent: ship the MIT notice, write the tracker config the skills already read, and align b-research with always-on bootstrap policy."
omp_execution: orchestrate
files:
  - THIRD-PARTY-NOTICES.md
  - package.json
  - skills/b-grill-with-docs/SKILL.md
  - skills/b-grill-with-docs/CONTEXT-FORMAT.md
  - skills/b-grill-with-docs/ADR-FORMAT.md
  - docs/agents/issue-tracker.md
  - docs/agents/triage-labels.md
  - skills/b-issue-create/SKILL.md
  - skills/fix-pr/SKILL.md
  - skills/b-research/SKILL.md
  - .context/backlog/items/
  - .context/backlog/todo.md
from_plan_steps: [1, 2, 3, 14]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] D1: THIRD-PARTY-NOTICES.md exists at repo root carrying the upstream MIT permission notice and the `Copyright (c) 2026 Matt Pocock` line verbatim"
  - "[x] D1: `npm pack --dry-run` lists THIRD-PARTY-NOTICES.md (added to package.json `files:`)"
  - "[x] D1: both CONTEXT-FORMAT.md and ADR-FORMAT.md carry a provenance header; skills/b-grill-with-docs/SKILL.md carries a one-line origin note"
  - "[x] D1: diff of both format files vs their pre-change state shows ONLY the added header — no content rewrite"
  - "[x] D2: docs/agents/issue-tracker.md and docs/agents/triage-labels.md exist and describe this repo (GitHub, evilbuck/buck-workflow-pi)"
  - "[x] D2: `grep -oh 'docs/agents/[a-z-]*\\.md' skills/**/*.md | sort -u` — every hit resolves on disk"
  - "[x] D2: b-issue-create/SKILL.md reads both docs conditionally (when present), not unconditionally"
  - "[x] D3: skills/b-research/SKILL.md states background-subagent dispatch as the default, names the OMP (`task`) path and the portable fallback, and states the foreground exception"
  - "[x] D3: the new skill section and the GLOBAL_OR_PROJECT-AGENTS.md § b-research paragraph agree in intent (side-by-side check recorded)"
  - "[x] Tier 4: one backlog item per deferred deliverable in .context/backlog/items/, each linked from todo.md"
  - "[x] /b-guardrails-check verdict recorded (package.json makes this session code-touching); `contract: \"none\"` is recorded, not silently passed"
completed_at: 2026-09-10
completed_by: omp-execution-session
---

# Phase 1: Live Defects

## Context

Parent plan's user goal: a buck-workflow user gets a debugging on-ramp that does not exist today, review that runs both axes without one masking the other, and a repo whose shipped skills do not read config files that were never written — plus downstream consumers who stop receiving MIT-licensed third-party text with no notice.

This phase is the plan's Tier 0. All three items are "the repo is wrong today", independent of any adoption decision. The plan declares a **hard gate**: nothing in Tiers 1–3 starts until this phase ships. It also front-loads the Tier 4 backlog capture so the deferred list survives even if execution stops after this phase (the plan's Q4 default recommendation is exactly that).

The three defects are mutually independent and touch disjoint files — see the execution-loop note below.

## Implementation Details

### D1 — MIT notice + provenance (plan step 1)

`skills/b-grill-with-docs/CONTEXT-FORMAT.md` and `ADR-FORMAT.md` are near-verbatim copies of upstream `mattpocock/skills` `skills/engineering/domain-modeling/`. Upstream is **MIT © 2026 Matt Pocock** (verified 2026-09-10 via `raw.githubusercontent.com/mattpocock/skills/main/LICENSE`, HTTP 200). `package.json` `files:` includes `skills`, so the copy is redistributed on npm and MIT's "substantial portions" clause applies.

1. Create `THIRD-PARTY-NOTICES.md` at repo root: name the upstream project and URL, the exact files derived from it, and the **full upstream MIT text including the copyright line verbatim**.
2. Add a short provenance header to the top of both format files pointing at `THIRD-PARTY-NOTICES.md`.
3. Add a one-line origin note to `skills/b-grill-with-docs/SKILL.md` where the two format files are referenced.
4. Add `THIRD-PARTY-NOTICES.md` to `package.json` `files:`.

**Do not rewrite the format files' content.** The notice makes the copy compliant; a rewrite discards reviewed content and re-introduces drift from upstream (plan § Out of scope, Light Grill Q1).

### D2 — Tracker config (plan step 2)

`skills/b-issue-create/SKILL.md:37-39` lists `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` under **"Inputs to gather"** — unconditional, no "if present" guard. Neither file exists; no skill in this repo writes them. `SKILL.md:228` already guards the *label* half ("Do not assume `ready-for-agent` exists"), so only the doc reads are unguarded. `skills/fix-pr/SKILL.md:247` uses the same label vocabulary.

1. Write `docs/agents/issue-tracker.md`: tracker = GitHub, repo `evilbuck/buck-workflow-pi`, how issues are addressed (`gh`, `issue://`), any repo-specific conventions.
2. Write `docs/agents/triage-labels.md`: the label vocabulary including `ready-for-agent` and `needs-triage`, and **what each label gates** (e.g. `ready-for-agent` is the input state `b-auto-fix` consumes).
3. Change `b-issue-create/SKILL.md:37-39` to read both **when present** — the skill must degrade cleanly in a consumer repo that has neither.
4. Cross-reference `docs/agents/triage-labels.md` from `fix-pr/SKILL.md:247`, with the same when-present posture.

**Scope boundary**: this is the repo-local fix. Generalizing the producer into `b-init-tracker` is N3 (Phase 5) and is explicitly **not** in this phase.

### D3 — b-research dispatch (plan step 3)

`GLOBAL_OR_PROJECT-AGENTS.md` § b-research mandates "always delegate to a subagent, run asynchronously". `skills/b-research/SKILL.md` contains **zero** occurrences of `subagent|background|delegate|parallel|task(` — an always-on policy contradicted by the shipped skill.

Add a dispatch section to `skills/b-research/SKILL.md`:
- Background subagent is the **default**, not an option.
- Name the OMP path (`task` with a read-only research agent) and the portable fallback for harnesses without background dispatch.
- State the foreground exception explicitly (when it is legitimate to run inline).

### Tier 4 backlog capture (plan step 14)

One backlog item in `.context/backlog/items/` per deferred deliverable, each linked from `todo.md`:
`b-phase` ready-frontier + expand–contract · `b-prototype` · `b-grill` round-frontier mode · `b-auto-fix` frontier concurrency · `code-smells` depth axis + `b-blueprint` visuals · `b-which` router generated from the catalog · `b-retro` · `wayfinder` (gate on N4 proving the tracker integration).

Do **not** file items for the audit's rejected list (plan § Tier 4, "Rejected outright").

## Risks

- **Rewriting instead of noticing.** The tempting fix for D1 is to paraphrase the two format files. That is explicitly out of scope and loses reviewed content. The acceptance criterion pins this: diff must show only the added header.
- **Verbatim copyright line.** A paraphrased or reformatted copyright line does not satisfy MIT. Copy it byte-for-byte from upstream.
- **D2 over-reach.** Writing the docs is repo-local. Do not invent a managed-block generator here — that is N3.
- **Guardrails gate fires.** `package.json` is not `.md`/`.txt`/`docs/`/`.context/`, so this session is **code-touching** and the deterministic check contract is blocking. ~~The repo currently resolves `contract: "none"`~~ **Corrected 2026-09-10 during execution**: `guardrails.json` exists and the contract resolves **durable v2**. Verdict recorded: unit 499/499 pass, global ratchet 72.91% > 54.9% baseline (pass), patch gate FAIL 89% < 90% — all 10 uncovered lines in `scripts/serve-presentations.ts` from pre-existing commit 0d1dbf7 (zero coverable lines from this phase; routed to backlog as out-of-plan follow-up).
- **README/docs untouched.** No new skill ships in this phase, so there is no catalog edit and no clobber exposure here.

## Verification

- **D1**: `grep -ri 'mattpocock' .` returns hits in `THIRD-PARTY-NOTICES.md`, both format files, and `skills/b-grill-with-docs/SKILL.md`. `npm pack --dry-run | grep THIRD-PARTY` is non-empty. `git diff skills/b-grill-with-docs/CONTEXT-FORMAT.md skills/b-grill-with-docs/ADR-FORMAT.md` shows only added header lines.
- **D2**: `grep -oh 'docs/agents/[a-z-]*\.md' skills/**/*.md | sort -u` then `test -f` each — all resolve.
- **D3**: side-by-side of the `GLOBAL_OR_PROJECT-AGENTS.md` § b-research paragraph and the new skill section; record the comparison in the review.
- **Tier 4**: `todo.md` links resolve to files that exist; count matches the deferred list.
- **Gate**: run `/b-guardrails-check` and record the verdict verbatim in session memory.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:

**First-turn precondition (`omp_execution: orchestrate`)**: type the `orchestrate` keyword anywhere in your first turn of this phase. omp will inject the orchestrator contract (parallel `task` subagents, no-yield between phases, verify-after-every-phase). This phase has **four disjoint work units** — D1 (`THIRD-PARTY-NOTICES.md`, `package.json`, `b-grill-with-docs/`), D2 (`docs/agents/`, `b-issue-create`, `fix-pr`), D3 (`b-research`), Tier-4 backlog (`.context/backlog/`) — with no shared files, so they fan out cleanly.

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
