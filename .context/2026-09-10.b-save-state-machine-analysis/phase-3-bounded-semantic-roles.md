---
status: completed
phase: 3
order: 3
plan: plan-b-save-state-machine.md
phases_overview: plan-b-save-state-machine-phases.md
difficulty: medium
model_hint: capable general model preferred
buck_hint: /b-build
goal: "Ship hardened, bounded scribe/evidence-auditor/goal-classifier role sessions with zero ambient capability, closed schemas, and one deterministic retry."
files:
  - extensions/omp-models.ts
  - extensions/omp-models.test.ts
  - extensions/b-save/roles.ts
  - extensions/b-save/__tests__
from_plan_steps: [5]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[x] `runOmpModelSession` is extended in place (no second model-session convention): caller-owned system prompts, strict output schemas, empty ambient inputs, OMP-only switches, stable role IDs, and one retry from the original sanitized snapshot."
  - "[x] Scribe, evidence-auditor, and goal-classifier sessions run with no tools and no ambient skills, rules, context files, prompts, commands, extensions, MCP, LSP, or IRC."
  - "[x] Evidence inputs are bounded and cited by ID; the retry re-sends the original snapshot, never a re-scraped one."
  - "[x] Models return semantic content and closed verdicts only — never writable paths, commands, or mutations; role failure yields a resumable `failed_model` outcome."
  - "[x] Prompt-injection fixtures embedded in repository/session evidence cannot change role instructions, tool access, writable paths, payloads, or state transitions."
  - "[x] `extensions/omp-models.test.ts` and new role-validation tests pass; existing `b-save-improved` consumers of `runOmpModelSession` still pass."
completed_at: 2026-09-10
completed_by: omp-goal
---

# Phase 3: Bounded Semantic Roles

## Context

Parent plan user goal (inherited): Buck Workflow users run the new deterministic checkpoint as `/b-save`, while the current prompt-driven workflow remains available as `/deprecated-b-save` for compatibility and fallback.

Builds on Phase 2's typed evidence records, proposals, and dependency hashes: roles consume snapshot evidence by ID and return typed proposals/verdicts. This phase creates the **only** LLM surface in the engine — everything else stays deterministic. Covers plan step 5.

## Implementation Details

1. **Extend the shared helper (plan step 5) — `extensions/omp-models.ts`.** Extend the existing `runOmpModelSession` (do not create a second model-session convention) to support:
   - Caller-owned system prompts per role.
   - Strict output schemas (fail on schema violation; no lenient parsing).
   - Empty ambient inputs: no tools, no skills/rules/context files, no prompts/commands, no extensions, no MCP, no LSP, no IRC.
   - OMP-only switches so non-OMP loads degrade cleanly.
   - Stable role IDs (`scribe`, `evidence-auditor`, `goal-classifier`, optional `hindsight-delivery`) for persisted run state.
   - Exactly one retry, re-sending the **original** sanitized snapshot.
   Update `extensions/omp-models.test.ts`; keep existing `b-save-improved` consumers working (it is removed only at Phase 6 cutover).
2. **Role sessions (plan step 5) — `extensions/b-save/roles.ts`.**
   - **Scribe**: authors narrative, tags, priority, summary, durable facts for memory creation; extracts cited backlog semantics.
   - **Evidence auditor**: binary verdicts for non-mechanical spec/phase/iterate acceptance criteria.
   - **Goal classifier**: typed handling of semantic near-matches for the user-goal check.
   - **Hindsight delivery (conditional)**: only if Phase 1 proved the guarded pre-execution capability; otherwise this role does not exist and Phase 5 records `unsupported`.
   All roles: bounded evidence IDs in, closed schemas out, zero mutation authority. Role failure → resumable `failed_model` state in the machine.
3. **Injection hardening.** Add fixtures with prompt-injection text in repository/session evidence; assert instructions, tool access, writable paths, payloads, and transitions are unchanged. The snapshot redaction from Phase 2 is the first line of defense; role isolation is the second.

## Risks

- **Weakening isolation for convenience.** Any ambient capability granted "temporarily" becomes an attack path; keep the session surface empty and test that it stays empty.
- **Breaking `b-save-improved` mid-plan.** It must keep working until the Phase 6 cutover — extend, don't replace.
- **Retry semantics drift.** The retry must replay the original snapshot; a re-scrape could pick up different (possibly poisoned) evidence.

## Verification

- Run `extensions/omp-models.test.ts` (extended) plus new role-validation suites: schema rejection, empty-ambient assertion, retry-from-original-snapshot, `failed_model` resumability, injection fixtures.
- Run the existing `b-save-improved` test suites to confirm the shared helper change is backward-compatible.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only (escalate to `/b-build-hard` if isolation ambiguity appears).
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.

*(Goal mode: if not already active, this phase runs under the goal set in Phase 1's first turn.)*
