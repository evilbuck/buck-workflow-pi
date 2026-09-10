---
status: pending
phase: 5
order: 5
plan: plan-mattpocock-findings-remediation.md
phases_overview: plan-mattpocock-findings-remediation-phases.md
difficulty: hard
model_hint: strongest reasoning model available — tracker-coupled, rework risk if the config shape is wrong, and N3 mutates this repo's own config
buck_hint: /b-build-hard
goal: "Generalize the tracker config from 'this repo' to 'any repo' (b-init-tracker), then add the only missing inbound stage (b-triage)."
files:
  - skills/b-init-tracker/SKILL.md
  - prompts/b-init-tracker.md
  - commands/b-init-tracker.md
  - skills/b-triage/SKILL.md
  - prompts/b-triage.md
  - commands/b-triage.md
  - AGENTS.md
  - docs/agents/issue-tracker.md
  - docs/agents/triage-labels.md
  - README.md
  - docs/buck-workflow.md
from_plan_steps: [10, 11, 13]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] N3: b-init-tracker covers Sections A (tracker) + B (labels) ONLY — Section C (domain docs) is out of scope; that is b-docs + CONTEXT.md"
  - "[ ] N3: writes an idempotent managed block mirroring b-init-guardrails' <!-- BEGIN/END --> pattern"
  - "[ ] N3: run against THIS repo before N4 starts, and it does NOT clobber the hand-written docs/agents/*.md from Phase 1 — re-running is a no-op or a clean merge"
  - "[ ] N4: b-triage runs redundancy/prior-rejection check → verify the claim (reproduce/checkout) → grill → durable behavioural agent brief → .out-of-scope/ KB"
  - "[ ] N4: the agent brief is BEHAVIOURAL — no file paths, no line numbers"
  - "[ ] N4: b-triage produces the ready-for-agent state that b-auto-fix consumes as input, using the vocabulary in docs/agents/triage-labels.md"
  - "[ ] Wiring: prompts/ + commands/ symlinks exist for both b-init-tracker and b-triage"
  - "[ ] Catalog: both have rows in README '### Prompt Templates' AND '### Skills'"
  - "[ ] Catalog: both appear at docs/buck-workflow.md primitives table, quick-reference table, and a full section body"
  - "[ ] Both skills resolve BY NAME in a reloaded session (loader-native resolution)"
  - "[ ] README.md and docs/buck-workflow.md tails intact after every table edit (byte-compare unrelated sections against HEAD)"
completed_at: null
completed_by: null
---

# Phase 5: Tracker Init & Triage

## Context

Parent plan's user goal: a repo whose shipped skills do not read config files that were never written — generalized past this one repo.

This is the dependent slice of Tier 3. Phase 1's D2 wrote `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` **for this repo by hand**. N3 turns that into a producer any repo can run. N4 then consumes the label vocabulary N3 establishes.

`b-triage` is the only missing **inbound** stage — every issue-facing skill this repo owns points outward (`b-issue-create`, `b-pr`, `fix-pr`, `b-pr-review-2-issues`). Nothing turns an inbound claim into a verified, agent-ready brief.

**Dependency chain**: Phase 1 (D2 defines the config shape) → N3 (generalizes it) → N4 (consumes the labels). The plan is explicit that **N3 ships and is used against this repo before N4 starts** — that is the mitigation for the rework risk, not an optional nicety.

## Implementation Details

### N3 — `b-init-tracker` (plan step 10)

Trimmed port of upstream `setup-matt-pocock-skills`, **Sections A + B only**:
- **Section A — tracker**: which tracker, which repo, how issues are addressed. Produces `docs/agents/issue-tracker.md`.
- **Section B — labels**: the label vocabulary and what each label gates. Produces `docs/agents/triage-labels.md`.
- **Section C (domain docs) is explicitly out of scope** — this repo already owns that via `b-docs` + `CONTEXT.md`.

Shape: **idempotent managed block**, mirroring `b-init-guardrails`' `<!-- BEGIN b-init-guardrails -->` / `<!-- END -->` pattern in `AGENTS.md`. Re-running must be a no-op, not a duplicate block.

**Critical interaction with Phase 1**: this repo will already have hand-written `docs/agents/*.md`. Running `b-init-tracker` here must **not clobber them**. Either detect-and-preserve, or merge into a managed region inside those files. Decide this explicitly — it is the single most likely way this phase produces a regression against Phase 1's shipped work.

### N4 — `b-triage` (plan step 11)

Five stages, in order:
1. **Redundancy / prior-rejection check** — has this been filed, fixed, or explicitly rejected before? Consult the `.out-of-scope/` KB.
2. **Verify the claim** — reproduce it, or check out the referenced state. An unverified claim is not triaged.
3. **Grill** — resolve ambiguity before writing anything durable.
4. **Durable behavioural agent brief** — describes the *behaviour* that must change. **No file paths, no line numbers**; those rot and they pre-empt the implementing agent's investigation.
5. **`.out-of-scope/` KB** — rejected claims are recorded with the reason so the redundancy check in stage 1 has something to read.

Output state must be the `ready-for-agent` label defined in `docs/agents/triage-labels.md` — the exact state `b-auto-fix` expects as input.

### Catalog wiring (plan step 13)

Both skills are slash-invoked: `prompts/<n>.md` + `commands/<n>.md` symlink + README `### Prompt Templates` row + README `### Skills` row + three `docs/buck-workflow.md` sites (primitives ~L28, quick reference ~L393, full section body).

N3 and N4 are sequential, so there is no parallel-write contention on the shared catalog files in this phase.

## Risks

- **N3 clobbering Phase 1's hand-written docs.** Highest-probability regression in this phase. `b-init-tracker` run against this repo must preserve or cleanly merge `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`. Verify by running it twice and diffing.
- **`b-triage` is tracker-coupled.** It assumes GitHub labels exist and are writable. If N3's config shape is wrong, N4 is rework. Mitigation (plan-mandated): N3 ships **and is used against this repo** before N4 starts.
- **File paths creeping into the agent brief.** The brief being behavioural is the load-bearing rule of the port; it is also the easiest one to violate while writing an example.
- **Skill-count inflation.** This phase lands the last two of seven new skills, reaching ~61 with no in-agent router. If Phase 4 already landed, promote `b-which` from Tier 4 at `/b-save`.
- **Catalog clobber.** Same documented hazard as Phases 2 and 4; re-read the tail after every table edit.
- **AGENTS.md managed block.** N3 writes into this repo's `AGENTS.md`, which already carries the `b-init-guardrails` managed block. The two blocks must coexist; do not nest or reuse the guardrails markers.

## Verification

- Run `b-init-tracker` against this repo **twice**. First run: managed block appears, `docs/agents/*.md` preserved. Second run: `git diff` is empty (idempotent).
- Confirm `AGENTS.md` contains both the `b-init-guardrails` and the new tracker managed block, unnested and independently delimited.
- Drive `b-triage` on a real inbound claim; confirm it refuses to produce a brief for an unverified claim, and confirm the emitted brief contains no file paths or line numbers.
- Confirm the label the brief lands on matches `docs/agents/triage-labels.md` and is the state `b-auto-fix` reads.
- Reload the session; probe `b-init-tracker` and `b-triage` by exact name.
- `readlink commands/b-init-tracker.md commands/b-triage.md` → `../prompts/<n>.md`.
- `git diff --stat README.md docs/buck-workflow.md` shows only additive hunks; tails intact.
- Docs-only phase unless N3's implementation lands executable code; if it does, run `/b-guardrails-check` and record the verdict.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:

1. Run `/b-build-hard` for this phase only. N3 must land **and be exercised against this repo** before N4 starts.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
