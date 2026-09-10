---
status: pending
phase: 2
order: 2
plan: plan-mattpocock-findings-remediation.md
phases_overview: plan-mattpocock-findings-remediation-phases.md
difficulty: hard
model_hint: strongest reasoning model available — a workflow-station port whose load-bearing rule is a refusal gate
buck_hint: /b-build-hard
goal: "Close the biggest capability hole: a design vocabulary reference, and /b-diagnose — the debugging on-ramp the bootstrap's task-routing table already points at with nothing behind it."
files:
  - skills/codebase-design/SKILL.md
  - skills/codebase-design/DESIGN-IT-TWICE.md
  - skills/b-diagnose/SKILL.md
  - prompts/b-diagnose.md
  - commands/b-diagnose.md
  - README.md
  - docs/buck-workflow.md
from_plan_steps: [4, 5, 13]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] A1: skills/codebase-design/SKILL.md defines the seven terms (module, interface, depth, seam, adapter, leverage, locality), depth-as-leverage, the deletion test, and 'one adapter is hypothetical, two is real'"
  - "[ ] A1: DESIGN-IT-TWICE.md fan-out exists and is referenced from SKILL.md"
  - "[ ] A1: codebase-design has NO prompts/ or commands/ wrapper (model-invoked reference; fix-pr is the precedent)"
  - "[ ] A2: skills/b-diagnose/SKILL.md has 6 phases with Phase 1 (a tight, red-capable loop) as a blocking gate"
  - "[ ] A2: the skill REFUSES to state a hypothesis before a named command has gone red on the reported bug — this is the load-bearing rule and must survive the port verbatim in intent"
  - "[ ] A2: 10 ranked loop constructions, 3–5 falsifiable hypotheses, instrument step, regression test, and cleanup of tagged logs are all present"
  - "[ ] A2: exits are wired — b-iterate (fix in place), b-plan (architectural), code-smells (Phase 5 'no correct seam exists' is itself the finding)"
  - "[ ] A2: b-diagnose's seam language links to skills/codebase-design/SKILL.md rather than restating the definitions"
  - "[ ] Wiring: prompts/b-diagnose.md exists; commands/b-diagnose.md is a symlink to ../prompts/b-diagnose.md"
  - "[ ] Catalog: b-diagnose has a row in README '### Prompt Templates' AND '### Skills'; codebase-design has a row in '### Skills' only"
  - "[ ] Catalog: docs/buck-workflow.md updated at the primitives table (~L28), the quick-reference table (~L393), and a full section body"
  - "[ ] Both skills resolve BY NAME in a reloaded session (loader-native resolution — a readable SKILL.md is not evidence it loaded)"
  - "[ ] /b-diagnose driven against a deliberately broken fixture blocks at Phase 1 with no red command"
  - "[ ] README.md and docs/buck-workflow.md tails intact after every table edit (byte-compare unrelated sections against HEAD)"
completed_at: null
completed_by: null
---

# Phase 2: Design Vocabulary & b-diagnose

## Context

Parent plan's user goal: a buck-workflow user gets a debugging on-ramp that does not exist today (`/b-diagnose`), review that runs both axes without one masking the other, and a repo whose shipped skills do not read config files that were never written.

This is the plan's Tier 1 — the largest capability hole. The global bootstrap's task-routing table sends "reproducible bug, runtime error" to a *systematic-debugger* role **with no skill behind it**. `b-build` assumes you already know what to build; `b-iterate` assumes the defect is already written down. Nothing in 54 skills owns "it's broken and we don't know why".

A1 (`codebase-design`) ships first because it is the prerequisite vocabulary for A2's Phase-5 seam handoff and for C2's seams gate in Phase 3. It is cheap and unblocks two consumers.

## Implementation Details

### A1 — `codebase-design` reference (plan step 4)

Port as a **model-invoked reference skill** — no slash wrapper. Precedent: `fix-pr` (skill-only, `/skill:fix-pr`, documented at `docs/buck-workflow.md:31` and `:1108`).

Content:
- The seven terms: **module, interface, depth, seam, adapter, leverage, locality**.
- **Depth as leverage** — deep modules (small interface, large implementation) are the unit of leverage.
- **The deletion test** — can this abstraction be deleted without the callers noticing?
- **"One adapter is hypothetical, two is real"** — do not build an abstraction layer for a single implementation.
- `DESIGN-IT-TWICE.md` fan-out as a separate file in the skill directory.

Rewrite to this repo's conventions (frontmatter `name`/`description`, `_shared` protocol references where relevant) rather than copy-pasting. Where upstream prose is lifted substantially, Phase 1's `THIRD-PARTY-NOTICES.md` is the compliance surface — **extend it** rather than adding a second notice mechanism.

### A2 — `b-diagnose` (plan step 5)

Port `diagnosing-bugs`. Six phases, with **Phase 1 as a blocking gate**:

1. **Phase 1 — tight, red-capable loop before any hypothesis.** The skill must refuse to hypothesize until a named command reproduces the reported bug in the red. This is the rule most likely to be lost in a port; it is the reason the skill exists.
2. **10 ranked loop constructions** — ordered cheapest/fastest first.
3. **3–5 falsifiable hypotheses** — each must name what observation would kill it.
4. **Instrument** — tagged logging so cleanup is mechanical.
5. **Regression test** — fails pre-fix, passes post-fix.
6. **Clean up tagged logs.**

Wire the exits:
- **`b-iterate`** — the fix is in place, defect is now written down.
- **`b-plan`** — the finding is architectural and needs its own plan cycle.
- **`code-smells`** — Phase 5's "no correct seam exists to fix this" *is itself the finding*; hand off rather than forcing a fix.

Seam vocabulary must **link to** `skills/codebase-design/SKILL.md`, not restate it — a second definition is a drift source.

### Catalog wiring (plan step 13, b-diagnose only)

Per the plan's per-skill delivery surface, corrected against the current README:

| Surface | Location | b-diagnose | codebase-design |
|---|---|---|---|
| Skill body | `skills/<n>/SKILL.md` | yes | yes |
| Prompt | `prompts/<n>.md` | yes | **no** |
| Command symlink | `commands/<n>.md` → `../prompts/<n>.md` | yes | **no** |
| README `### Prompt Templates (/b-* commands)` (~L216-237) | slash-command table | yes | **no** |
| README `### Skills` (~L251-284) | skills table | yes | yes |
| `docs/buck-workflow.md` primitives table (~L28-31) | yes | yes (as skill-only, `fix-pr` row is the pattern) |
| `docs/buck-workflow.md` quick-reference table (~L393-397) | yes | yes |
| `docs/buck-workflow.md` full section body | yes | yes |

> **Plan correction**: the plan describes the two README tables as "slash-command ~L235, OMP mirror ~L269". The second table is `### Skills` (~L251). `### OMP Command Mirror` (~L239) is a prose paragraph about symlinks, not a table — do not try to add a row to it.

## Risks

- **Port fidelity.** Rewriting into this repo's conventions can silently drop `b-diagnose`'s Phase-1 refusal. The acceptance criteria name that specific rule; verify it by driving the skill, not by reading it.
- **Seam definition drift.** If A2 restates the seam definition instead of linking to A1, Phase 3's C2 inherits two sources of truth.
- **Catalog clobber.** Documented history: the 2026-09-04 `b-recap` insert deleted the README tail. Re-read the file tail after every table edit and byte-compare unrelated sections against `HEAD`.
- **Loader resolution ≠ file readable.** A `SKILL.md` on disk proves nothing about registration. Reload the session and probe each skill by exact name.
- **Docs-only phase, no code gate.** Nothing here touches `scripts/` or `package.json`; the deterministic check contract is skipped with a one-line explanation. If that changes, run `/b-guardrails-check`.

## Verification

- Reload the session; probe `codebase-design` and `b-diagnose` by exact name; confirm loader-native resolution.
- Create a deliberately broken fixture, invoke `/b-diagnose`, and confirm it **blocks at Phase 1** and declines to hypothesize before a red command exists.
- `readlink commands/b-diagnose.md` → `../prompts/b-diagnose.md`.
- `git diff --stat README.md docs/buck-workflow.md` shows only additive hunks; tails intact.
- Grep `b-diagnose` and `codebase-design` across `README.md` and `docs/buck-workflow.md`; confirm the expected hit count per the table above.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:

1. Run `/b-build-hard` for this phase only. A1 must land before A2 (A2 links to A1's vocabulary).
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
