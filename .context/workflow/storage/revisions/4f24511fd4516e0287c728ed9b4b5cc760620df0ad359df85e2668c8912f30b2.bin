---
status: completed
phase: 3
order: 3
plan: plan-mattpocock-findings-remediation.md
phases_overview: plan-mattpocock-findings-remediation-phases.md
difficulty: medium
model_hint: capable general model preferred — small edits to two core loop skills, but they change every later review and build
buck_hint: /b-build
goal: "Compose the two review axes without one masking the other, and make b-build confirm seams (not just behaviours) before the first RED."
files:
  - skills/b-review/SKILL.md
  - skills/b-build/SKILL.md
  - skills/b-build/references/seams.md
from_plan_steps: [6, 7]
depends_on: [2]
dependency_type: SOFT
acceptance_criteria:
  - "[x] C1: b-review spawns the standards axis as a separate parallel `task` sub-agent, seeded with code-review-universal guides and a DIFF-SCOPED subset of the code-smells catalog"
  - "[x] C1: the standards agent runs in its own context so it cannot pollute the acceptance-contract (spec) axis"
  - "[x] C1: the no-reranking rule is explicit — report the worst finding PER AXIS, never a single merged ranking"
  - "[x] C1: the portable (no-background-dispatch) fallback is named, not assumed"
  - "[x] C2: skills/b-build/references/seams.md exists and links to skills/codebase-design/SKILL.md for the seam definition rather than restating it"
  - "[x] C2: b-build's TDD Plan step requires named, confirmed seams before the first RED"
  - "[x] C2: the tautological-test anti-pattern is named — an assertion that recomputes the expected value the way the code does"
  - "[x] Verified on a real diff: two agent outputs, per-axis findings, no cross-axis ranking"
completed_at: 2026-09-10
completed_by: omp-execution-session
---

# Phase 3: Loop Composition Patches

## Context

Parent plan's user goal: review that runs both the standards and spec axes without one masking the other.

This is the plan's Tier 2. Unlike Tier 1, nothing new is being invented — **both review axes already exist locally**. `b-review` is the spec/acceptance-contract axis; `code-review-universal` and `code-smells` are the standards axis. Only the composition is missing. That is the highest value per hour in the patch tier.

C2 turns `b-build`'s "confirm behaviours" into "confirm seams", and names a test failure mode the global bootstrap's anti-padding rule does not cover: an assertion that recomputes the expected value the same way the code does.

**Dependency note**: this phase is SOFT on Phase 2. C2's `seams.md` links to `skills/codebase-design/SKILL.md` (A1). If Phase 2 has not landed, do **not** inline the seam definitions as a workaround — that creates the second source of truth Phase 2 was specifically written to avoid. Land A1 first, even standalone.

## Implementation Details

### C1 — `b-review` parallel standards axis (plan step 6)

Patch `skills/b-review/SKILL.md`:

1. **Fan out the standards pass** as a parallel `task` sub-agent. Seed it with:
   - the `code-review-universal` guides relevant to the diff's languages, and
   - a **diff-scoped subset** of the `code-smells` catalog — not all 23 smells.
2. **Context isolation is the point.** The standards agent runs in its own context so its findings cannot pollute the acceptance-contract reasoning. The spec axis stays in the mainline agent.
3. **No-reranking rule.** Report the worst finding *per axis*. Never merge the two into one ranked list — a merged ranking lets a loud standards nit outrank a quiet spec violation, which is exactly the masking this patch exists to prevent.
4. **Portable fallback.** Harnesses without background dispatch run the standards pass as a second, explicitly-scoped sequential pass with the same no-reranking output shape.

### C2 — `b-build` seams gate (plan step 7)

1. Create `skills/b-build/references/seams.md`:
   - What a seam is → **link to `skills/codebase-design/SKILL.md`**; do not restate.
   - How to name the seams a change will be tested through.
   - The **tautological-test anti-pattern**: an assertion that recomputes the expected value the way the code does. It passes for any implementation, including a wrong one. This is *not* covered by the existing anti-padding rules (which target same-path parameter rows, tautologies-by-shape, bare not-throw, non-empty checks).
2. Add **one line** to `b-build`'s TDD Plan step: name and confirm the seams under test before the first RED.

Keep the edit to `b-build/SKILL.md` minimal — one line plus the reference link. `b-build` is the most-invoked skill in the repo.

## Risks

- **This phase changes the skill every later phase's own `/b-review` step uses.** Phases 4 and 5 will run under the patched review contract. Treat the first `/b-review` after this phase as a smoke test of C1 itself, and be ready to distinguish "the phase has a defect" from "the review patch has a defect".
- **Review fan-out cost.** A parallel standards agent roughly doubles review token spend on every run. Mitigation per the plan: diff-scoped catalog subset, not the full 23 smells; measure on a real diff before making it the default.
- **Seam definition drift.** If `seams.md` restates rather than links, `codebase-design` and `seams.md` will diverge on the next edit to either.
- **Scope creep into `b-build`.** The plan asks for one line in the TDD Plan step. Rewriting `b-build`'s TDD section is out of scope.
- **Docs-only phase, no code gate.** Nothing here touches `scripts/` or `package.json`; the deterministic check contract is skipped with a one-line explanation.

## Verification

- Run `b-review` on a **real diff** (the Phase 2 diff is a natural candidate). Confirm:
  - two distinct agent outputs exist,
  - findings are reported per axis,
  - there is no merged cross-axis ranking anywhere in the output.
- Measure the token cost of the fan-out on that diff and record it — the plan flags this as a real cost, and the number decides whether it stays the default.
- Confirm `skills/b-build/references/seams.md` links to `codebase-design` and contains no independent seam definition.
- Read `b-build`'s TDD Plan step and confirm the seams requirement precedes the first RED.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:

1. Run `/b-build` for this phase only. Escalate to `/b-build-hard` if the `b-review` fan-out design turns out ambiguous in practice.
2. Run `/b-review` against this phase file — **using the patched skill**, which doubles as C1's smoke test.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues route to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
