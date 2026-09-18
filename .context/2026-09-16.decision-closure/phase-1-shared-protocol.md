---
status: pending
phase: 1
order: 1
plan: plan-decision-closure-protocol.md
phases_overview: plan-decision-closure-protocol-phases.md
difficulty: hard
model_hint: strongest reasoning model available — schema and vocabulary must be original Buck prose, not a restatement of the donor
buck_hint: /b-build-hard
goal: "Author the canonical conditional decision-closure protocol and register it so later skills load one schema instead of inventing parallel contracts."
files:
  - skills/_shared/decision-closure.md
  - skills/_shared/SKILL.md
  - plugins/buck-workflow/skills/_shared/
from_plan_steps: [1]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[ ] `skills/_shared/decision-closure.md` exists and is loadable as `skill://_shared/decision-closure.md`."
  - "[ ] `skills/_shared/SKILL.md` lists `decision-closure.md` in the Available Resources table with a one-line purpose."
  - "[ ] The protocol names material triggers, a low-risk skip path, closure-ready criteria, assumption ID/status/blocking/validation-path rules, material-risk fields, confirmed problem reframing, pressure calibration, and the hard-mode minimal-change sequence."
  - "[ ] Allowed assumption statuses are exactly `validated`, `deferred`, and `invalidated`; closure is not ready while a blocking assumption is unresolved or a material rollback/fallback claim has no validation path."
  - "[ ] Integrating skills are instructed to load this file rather than copy its schema."
  - "[ ] Canonical `_shared` and `plugins/buck-workflow/skills/_shared/` are byte-identical after a full-directory sync."
  - "[ ] Changed canonical and bundled `_shared` files contain no case-insensitive whole-word match for the term forbidden by the parent plan."
  - "[ ] No complete donor sentence, table, template, or branded label is present; headings and field names are authored for Buck."
completed_at: null
completed_by: null
---

# Phase 1: Shared Protocol

## Context

Parent user goal: Buck Workflow users can see and validate material decisions, assumptions, and rollback posture before autonomous execution, without slowing routine work.

This phase is the schema gate. Later phases only reference this file. If the protocol is vague, duplicated, or leaked from the donor project, every consumer inherits the defect.

## Implementation Details

1. Create `skills/_shared/decision-closure.md` as the single source of truth. Author in Buck vocabulary. Do not copy donor sentences, tables, templates, or labels. Do not use the term forbidden by the parent plan.

2. Freeze these contracts in that file (exact heading names are yours to choose; later phases will cite them by heading):

   - **Material triggers** — hard-to-reverse changes; trust-boundary changes; data-loss or migration risk; accessibility impact; unresolved scope; new dependencies; new abstractions; broad refactors. A trigger makes a closure *check* mandatory; it does not by itself force a user interview.
   - **Low-risk skip** — routine, reversible, well-specified work with clear evidence records no closure section and asks no extra questions.
   - **Closure-ready criteria** — selected course and material trade-offs; supporting evidence; assumptions with stable IDs and allowed statuses; blocking flag plus validation path for each unresolved assumption; material failure mode, impact, mitigation, and rollback or fallback; intentionally excluded scope; next bounded action.
   - **Assumption records** — stable IDs unique within the artifact (recommend `A-<n>`); status ∈ {`validated`, `deferred`, `invalidated`}; `blocking: true|false`; evidence or a named validation path. Closure is not ready while a blocking assumption remains unresolved or a material rollback/fallback claim has no validation path.
   - **Material-risk fields** — failure mode, impact, mitigation, rollback or fallback. Trust-boundary and rollback coverage are explicit where those triggers apply.
   - **Confirmed problem reframing** — if answers or repo evidence show the stated problem is wrong, surface the mismatch, obtain explicit user confirmation, and record both the prior framing and the confirmed replacement. Silent redirect is forbidden.
   - **Pressure calibration** — grill intensity follows materiality. Reversible local work stays light. Triggered work increases pressure on the unresolved decision, not on already-closed evidence. Do not turn Light Grill into a mandatory interview.
   - **Minimal-change sequence** (consumed by hard-mode build): confirm a change is needed → reuse a local pattern → use a platform-native capability → use an already-present package → minimize the patch → introduce a new abstraction only when earlier options are insufficient. Stop at the first option that safely satisfies the plan.
   - **Cross-skill rules** — `b-grill*` emit one closeout section that instantiates this schema; `b-plan` may synthesize a ledger when upstream closeout is absent; `b-phase` assigns each deferred/blocking ID to exactly one earliest-capable phase; `b-build` hard mode applies the minimal-change sequence and does not reopen settled plan decisions without current contradictory evidence; `b-review` checks blocking-assumption resolution and rollback/fallback evidence, and does not become a plan-quality review.
   - **Record shape** — additive and body-based. No new required frontmatter keys. No runtime serializer change.

3. Register the file in `skills/_shared/SKILL.md` Available Resources. Purpose line must say other skills load it by filename when a material-decision contract is needed.

4. Synchronize the full canonical `skills/_shared/` directory into `plugins/buck-workflow/skills/_shared/`. Compare with `diff -rq`; expect no differences.

5. Run a case-insensitive whole-word scan for the forbidden term on the new protocol file and the bundled `_shared` copy. Expect zero matches.

## Risks

- Ceremony leak: if skip rules are weak, later skills will interview on every plan. Keep triggers explicit and the skip path first.
- Schema drift: if this file is a narrative essay without field names, Phase 3–4 will invent incompatible ledgers. Prefer named fields and allowed values.
- Donor language: originality is an acceptance criterion, not a polish pass. Rewrite from the parent plan's behavioral contract.
- Bundle drift: sync the whole `_shared` directory, including existing files such as `subject-resolution.md` and `scripts/`.

## Verification

- `skill://_shared/decision-closure.md` resolves; `_shared/SKILL.md` lists it.
- A reviewer can point at named headings for triggers, skip, statuses, blocking, risk fields, reframing, pressure, and minimal-change.
- `diff -rq skills/_shared plugins/buck-workflow/skills/_shared` is empty.
- Forbidden-term scan is clean.
- Docs-only session: skip the deterministic check contract with one line of explanation unless a non-markdown path changed.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
