---
status: pending
phase: 4
order: 4
plan: plan-mattpocock-findings-remediation.md
phases_overview: plan-mattpocock-findings-remediation-phases.md
difficulty: medium
model_hint: capable general model preferred — three independent skills, one shipping an executable shell template
buck_hint: /b-build
omp_execution: orchestrate
files:
  - skills/b-handoff/SKILL.md
  - prompts/b-handoff.md
  - commands/b-handoff.md
  - skills/writing-for-agents/SKILL.md
  - skills/b-wizard/SKILL.md
  - skills/b-wizard/template.sh
  - prompts/b-wizard.md
  - commands/b-wizard.md
  - README.md
  - docs/buck-workflow.md
from_plan_steps: [8, 9, 12, 13]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] N1: b-handoff writes to the OS temp dir, NOT the workspace"
  - "[ ] N1: b-handoff emits a 'suggested skills' section, references artifacts by path/URL instead of duplicating them, and redacts secrets"
  - "[ ] N2: writing-for-agents covers context load vs cognitive load, information hierarchy, completion criteria, leading words, the no-op test, and prompt-the-positive"
  - "[ ] N2: writing-for-agents has NO prompts/ or commands/ wrapper (model-invoked reference)"
  - "[ ] N5: b-wizard/template.sh does the work; SKILL.md is thin"
  - "[ ] N5: template.sh implements staged progress, confirmation gates, cross-platform URL open (including WSL), hidden secret entry, idempotent .env upsert, and `gh secret` write"
  - "[ ] N5: template.sh passes `bash -n`; shellcheck run if available; verified statically (no live credential run)"
  - "[ ] Wiring: prompts/ + commands/ symlinks exist for b-handoff and b-wizard only"
  - "[ ] Catalog: b-handoff and b-wizard have rows in README '### Prompt Templates' AND '### Skills'; writing-for-agents in '### Skills' only"
  - "[ ] Catalog: all three appear at docs/buck-workflow.md primitives table, quick-reference table, and a full section body"
  - "[ ] All three skills resolve BY NAME in a reloaded session (loader-native resolution)"
  - "[ ] README.md and docs/buck-workflow.md tails intact after every table edit (byte-compare unrelated sections against HEAD)"
  - "[ ] /b-guardrails-check verdict recorded — template.sh makes this session code-touching"
completed_at: null
completed_by: null
---

# Phase 4: Independent New Members

## Context

Parent plan's user goal: a buck-workflow user gets capabilities the repo genuinely lacks, delivered without breaking the catalog.

This is the independent slice of Tier 3. N1, N2, and N5 have **no dependency on each other and none on Phases 2 or 3** — only the plan's Tier-0 policy gate (Phase 1). They are grouped because each is small and they can be built in parallel.

- **N1 `b-handoff`** — cheapest new member. Cross-harness / cross-directory / cross-machine seed doc. Neither `b-recap` (chat-only, no artifact) nor `b-save` (historical record of what happened) produces one.
- **N2 `writing-for-agents`** — this repo's *product is agent-consumed documents* and it has no authoring standard. Also serves the open bootstrap-consolidation work.
- **N5 `b-wizard` + `template.sh`** — nothing local generates a runnable script for a **human** (credentials, dashboards, cutovers). The template does the work; the skill is thin.

## Implementation Details

### N1 — `b-handoff` (plan step 8)

- Writes the handoff doc to the **OS temp dir**, not the workspace. A handoff is transient and cross-directory; polluting `.context/` with it is wrong.
- Emits a **"suggested skills"** section so the receiving agent knows what to load.
- **References artifacts by path/URL** rather than duplicating their content — the receiving agent reads them.
- **Redacts secrets** before writing.
- Slash-invoked: `prompts/b-handoff.md` + `commands/b-handoff.md` symlink.

### N2 — `writing-for-agents` (plan step 9)

Model-invoked reference, **no wrapper** (precedent: `fix-pr`, and A1 `codebase-design` from Phase 2). Content:
- **Context load vs cognitive load** — the two distinct costs a document imposes on an agent.
- **Information hierarchy** — what must be read first.
- **Completion criteria** — how to state "done" so an agent can check it.
- **Leading words** — the first words of a section determine whether it is skipped.
- **The no-op test** — if removing a sentence changes no agent behaviour, delete it.
- **Prompt-the-positive** — state what to do, not only what to avoid.

### N5 — `b-wizard` + `template.sh` (plan step 12)

`skills/b-wizard/template.sh` carries the implementation; `SKILL.md` is thin (when to reach for it, how to adapt the template, what to verify). The template must implement:
- staged progress output,
- confirmation gates before each side effect,
- **cross-platform URL open including WSL** (`open` / `xdg-open` / `wslview` / `cmd.exe /c start`),
- hidden secret entry (`read -s`),
- **idempotent `.env` upsert** (replace-in-place if the key exists, append otherwise — never blind append),
- `gh secret` write.

**Verify statically.** Do not run it against live credentials.

### Catalog wiring (plan step 13)

Same surface matrix as Phase 2. Corrected table locations:

| Surface | b-handoff | writing-for-agents | b-wizard |
|---|---|---|---|
| `skills/<n>/SKILL.md` | yes | yes | yes |
| `prompts/<n>.md` | yes | **no** | yes |
| `commands/<n>.md` symlink | yes | **no** | yes |
| README `### Prompt Templates (/b-* commands)` (~L216-237) | yes | **no** | yes |
| README `### Skills` (~L251-284) | yes | yes | yes |
| `docs/buck-workflow.md` primitives (~L28-31) | yes | yes | yes |
| `docs/buck-workflow.md` quick reference (~L393-397) | yes | yes | yes |
| `docs/buck-workflow.md` full section body | yes | yes | yes |

**Serialize the catalog edits.** `README.md` and `docs/buck-workflow.md` are shared by all three deliverables. Under `orchestrate`, subagents write skill bodies, prompts, and command symlinks in parallel; **one integration owner (the mainline agent) applies all README and `docs/buck-workflow.md` rows sequentially afterwards.** Concurrent edits to those two files are not guaranteed to merge and this repo has a documented clobber history on exactly those tables.

## Risks

- **Catalog contention is the headline risk of this phase.** Three deliverables, two shared long markdown tables, documented clobber history (2026-09-04 `b-recap` insert deleted the README tail). Mitigation: serialized integration owner; re-read the file tail after every table edit; byte-compare unrelated sections against `HEAD`.
- **Skill-count inflation.** This phase moves the repo past ~58 skills with no in-agent router. `b-which` (catalog-generated router) is deferred to Tier 4 — the plan says promote it if this phase lands. Consider that at `/b-save`.
- **`template.sh` is unverified code.** The repo returns `contract: "none"` (open item `run-b-init-guardrails-on-repo.md`), and `lizard` has no Shell support, so complexity is unmeasurable here. Static verification (`bash -n`, shellcheck if present) is the whole gate. Do not skip it.
- **Guardrails gate fires.** `skills/b-wizard/template.sh` is not `.md`/`.txt`/`docs/`/`.context/`, so this session is **code-touching** and the deterministic check contract is blocking. Record the verdict.
- **`b-handoff` writing into the workspace.** The default instinct is `.context/`. The plan is explicit: OS temp dir.

## Verification

- Reload the session; probe `b-handoff`, `writing-for-agents`, and `b-wizard` by exact name.
- `readlink commands/b-handoff.md commands/b-wizard.md` → `../prompts/<n>.md`.
- Confirm `commands/writing-for-agents.md` does **not** exist.
- `bash -n skills/b-wizard/template.sh`; `shellcheck skills/b-wizard/template.sh` if available; read the `.env` upsert path and confirm it is replace-in-place, not append.
- Drive `b-handoff` once and confirm the output path is under the OS temp dir and contains no secret values.
- `git diff --stat README.md docs/buck-workflow.md` shows only additive hunks; tails intact.
- Run `/b-guardrails-check` and record the verdict verbatim.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:

**First-turn precondition (`omp_execution: orchestrate`)**: type the `orchestrate` keyword anywhere in your first turn of this phase. omp will inject the orchestrator contract (parallel `task` subagents, no-yield between phases, verify-after-every-phase). Fan out **three** units — N1, N2, N5 — for skill bodies and their own wrapper files only. **The mainline agent owns `README.md` and `docs/buck-workflow.md` and applies those rows serially after the subagents return.**

1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
