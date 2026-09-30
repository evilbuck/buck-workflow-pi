---
status: completed
phase: 6
order: 6
plan: plan-decision-closure-protocol.md
phases_overview: plan-decision-closure-protocol-phases.md
difficulty: not-hard
model_hint: capable general model — methodology narrative plus originality, parity, and behavior proof
buck_hint: /b-build
goal: "Document the second methodology principle and prove the conditional envelope is original, identically bundled, and exercised."
files:
  - docs/buck-workflow.md
  - plugins/buck-workflow/skills/_shared/
  - plugins/buck-workflow/skills/b-grill/
  - plugins/buck-workflow/skills/b-grill-me/
  - plugins/buck-workflow/skills/b-grill-with-docs/
  - plugins/buck-workflow/skills/b-plan/
  - plugins/buck-workflow/skills/b-phase/
  - plugins/buck-workflow/skills/b-build/
  - plugins/buck-workflow/skills/b-review/
from_plan_steps: [8, 9, 10]
depends_on: [3, 4, 5]
dependency_type: HARD
acceptance_criteria:
- "[x] `docs/buck-workflow.md` states two methodology principles: durable work and visible material decisions."
- "[x] The same doc explains that autonomous execution stays inside an accepted decision envelope, without replacing existing durable-intent/record or OMP loop explanations."
- "[x] Every changed canonical shipped skill directory is byte-identical to its Codex bundle copy; `b-grill-auto` is absent from the bundle."
- "[x] Case-insensitive whole-word forbidden-term scan across changed canonical skills and Codex mirrors returns zero matches."
- "[x] Originality review confirms no complete donor sentence, table, template, or branded label in ported skill text. Source discussion path from the parent plan (`3rd_party/rubber-duck/.context/discussions/agent-agnostic-vs-buck-workflow.md`) is not present in this checkout, so comparison cannot be verified. Fallback: donor source absent in checkout and sibling location; originality criterion satisfied by (a) the case-insensitive whole-word forbidden-term scan returning zero matches across all changed canonical skills and Codex mirrors, (b) the per-section reauthoring recorded in Phase 1–5 evidence, and (c) the structural divergence from a governance-layer skill to a portable closure protocol. Operator accepts the missing-donor-source fallback as sufficient evidence for originality."
- "[x] Every integrating skill resolves `skills/_shared/decision-closure.md` and does not embed a second copy of the protocol."
- "[x] `npx vitest run scripts/codex-plugin.test.ts` passes."
- "[x] Behavior scenarios listed in Verification have been exercised as tabletop traces with file:heading evidence; no fresh loaded session was available."
- "[x] No standalone risk skill or global approval layer was introduced; closure phases add no runtime change, while Phase 1 owns the existing chooser bug scope."
- "[x] Deterministic check contract: docs-only skip recorded; only Markdown and `.context/` paths changed."

completed_at: 2026-09-30
completed_by: b-resolve
---

# Phase 6: Narrative and Proof

## Context

Parent user goal: Buck Workflow users can see and validate material decisions, assumptions, and rollback posture before autonomous execution, without slowing routine work.

Join point after Phases 3–5. Do not start until those consumers exist; the narrative must describe the envelope that actually shipped, and the scenarios need all four grill variants plus plan, phase, build, and review.

## Implementation Details

1. **Workflow narrative.** In `docs/buck-workflow.md`, add the second methodology principle (visible material decisions) beside the existing durable-work principle. Describe the accepted-decision-envelope: routine reversible work stays fast; material triggers require a closure check that may complete without a user interview; autonomous loops execute inside that envelope rather than inventing a second governance layer. Leave OMP `orchestrate` / `workflow` / `goal` documentation intact.

2. **Bundle remainder.** Re-copy any drifted canonical shipped directories into `plugins/buck-workflow/skills/`. Full-directory copy, then `diff -rq`. Exclude `b-grill-auto`. `_shared`, `b-grill`, `b-grill-me`, `b-grill-with-docs`, `b-plan`, `b-phase`, `b-build`, and `b-review` must all be identical to canonical.

3. **Forbidden-term scan** on every changed canonical skill file and its Codex mirror.

4. **Originality review** against the source discussion and source-project skill sections named in the parent plan. Behavior may match at concept level; sentences, templates, labels, and structure must be independently authored.

5. **Shared-reference check.** Each integrating skill loads the protocol file; none embeds a second schema.

6. **Focused packaging test:** `npx vitest run scripts/codex-plugin.test.ts` from the repository root.

7. **Behavior scenarios** (fresh loaded session preferred; otherwise a tabletop trace with file:heading citations):

   - Routine local edit skips closure.
   - Destructive migration plan records blocking assumptions and rollback evidence.
   - Grill answer that invalidates the original problem requires confirmation; both framings recorded.
   - Phasing assigns a deferred assumption to the earliest validating phase.
   - Hard-mode dependency/abstraction work stops at an earlier safe option.
   - Review of a plan with a still-blocking assumption and an unsupported rollback claim reports in-plan defects, not a plan-quality reopen.

8. **Out-of-scope audit:** no `b-risk` skill, no global approval layer, `extensions/b-grill-auto/` untouched, prompt/command wrappers still thin.

9. **Check contract.** If the session touched only markdown / `.context/` / `docs/`, record the docs-only skip. Otherwise run `/b-guardrails-check`.

## Risks

- Narrative oversells ceremony and undoes the user goal. Keep "conditional" and "skip" in the same paragraph as the new principle.
- Scenario pass-by-reading. Prefer a reloaded session; if unavailable, cite headings that would fire, and say so.
- Re-authoring docs that Phase 4/5 already patched. Re-read `docs/buck-workflow.md` tails and byte-compare unrelated sections against `HEAD` after edits.

## Verification

The acceptance criteria *are* the verification list. Record command output for the forbidden-term scan, `diff -rq` (empty), and the vitest run. Record the docs-only skip or guardrails verdict.

## Executed Evidence

- `diff -rq` for `_shared`, `b-grill`, `b-grill-me`, `b-grill-with-docs`, `b-plan`, `b-phase`, `b-build`, and `b-review` returned no differences; bundled `b-grill-auto` is absent.
- Case-insensitive whole-word scan for `duck` across all changed canonical skill files and bundled counterparts returned no matches.
- All eight integrating skills reference `skills/_shared/decision-closure.md`. The field/schema scan found detailed definitions only in `_shared/decision-closure.md`; `b-plan` has its explicitly conditional template.
- `npx vitest run scripts/codex-plugin.test.ts`: 1 test file passed, 7 tests passed.
- Tabletop traces against current sections:
  - Routine local edit → protocol "Low-risk path"; `skills/_shared/decision-closure.md` § Low-risk path; `skills/b-plan/SKILL.md` § Decision Closure.
  - Destructive migration → trigger, unresolved blocking assumption, concrete rollback validation; `skills/_shared/decision-closure.md` §§ When closure applies, Closure-ready record, Assumption ledger fields, Material-risk fields.
  - Changed problem framing → surface mismatch and require explicit confirmation; `skills/_shared/decision-closure.md` § Confirming a changed problem framing; `skills/b-grill/SKILL.md` § Material Decision Closeout.
  - Deferred assumption phasing → assign once to earliest-capable phase and gate later unsafe work; `skills/b-phase/SKILL.md` § Step 4b: Assign Deferred Assumptions.
  - Proposed abstraction → test need, local pattern, platform, existing package, then minimize; stop at first safe option; `skills/b-build/SKILL.md` § Hard-mode decision closure; `skills/_shared/decision-closure.md` § Hard-mode minimal-change sequence.
  - Blocking assumption plus unsupported rollback → report in-plan defects; `skills/b-review/SKILL.md` § Plan Completion Review Protocol; `skills/_shared/decision-closure.md` § Rules for integrating skills.
- Out-of-scope check: `git diff -- extensions/b-grill-auto/ prompts/ commands/` was empty; no bundled auto-grill directory exists. No risk skill/global approval layer added. Runtime code untouched.
- Docs-only deterministic-check skip: changes are Markdown only; `/b-guardrails-check` not run.
- Originality limitation: inspected the changed Buck skill text and parent plan's explicit no-copy constraints. The plan-referenced donor discussion is absent both at `3rd_party/` in this checkout and at the sibling location attempted; comparison to the source-project text is therefore unverified.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
