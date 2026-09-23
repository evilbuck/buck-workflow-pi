---
status: active
date: 2026-09-21
subject: 2026-09-21.jev-decision-opportunities
topics: [jev, typesafe, notes]
informs: []
---

# Rolling notes

## TypeSafe / Jev (official docs)

Jev evaluates typed questions against a state and returns values code can branch on. It does not write replies, code, or explanations.

Fit: one snap judgment a knowledgeable person makes in seconds given assembled context. Multi-factor judgments → one question per factor, compose in code.

Primitives: Choice (unordered closed set), Score (ordered rubric), Noul (P(yes)). Mix in one request; independent parallel eval. Adding questions barely changes latency (~100ms class).

Confidence (Choice/Score only) is a 0–1 collapse of the probability distribution. Pattern: high → act, medium → confirm, low → escalate. Thresholds scale with risk. Noul has no confidence field — threshold the probability itself.

Not a coding-agent model. Coding agents write code that *calls* Jev. Fragile "return JSON" LLM prompts are the replacement target.

JS integration: `@typesafe-ai/sdk`, `TYPESAFE_API_KEY`, `client.systemOne({ state, questions })`.

Skill-suggestion cookbook is the roster-router pattern (two calls: skim all, verify top 3).

Confidence: high (primary docs).

## ScoutBuckLoop

P0: `choice.ts` `runOmpModelSession({ tools: [] })` then parse `{ choice, reason }`. Legal set is six words. `decisionContext` already builds the state string. Two attempts then block. No confidence. This is the documented anti-pattern and the stall in `buck-loop-contextless-choice-stall.md`.

Do not replace: `run-step.ts` nested workers (tools + generation); `machine.ts` / `scan.ts` / effect interpreter (already deterministic). Child `reason` is unused for control flow.

Confidence: high (file:line).

## ScoutSaveCommitPr

P1: auditor `complete|incomplete|uncertain` per path. Preflight already ships criteria/status excerpts. Today: `runOmpModelSession` with `read`/`grep` + JSON parse. Jev only after code assembles excerpts (Jev cannot grep). Confidence <0.6 → force `uncertain` (apply already no-ops that).

Scout P3 on phase-table drift is **rejected**: two status strings agreeing is equality, not Jev.

Do not replace: scribe prose, commit message, PR body, rebase file edits, retain-facts handoff.

## ScoutCodeReview

Already System One–shaped where it matters: impact/likelihood/breadth → integer rubric in `rubric.ts`; rating never self-assigned. Catalog/model routing is a sort key. Machines are boolean predicates.

Only speculative P3: disposition consistency cross-check; evidence-quality Noul. Neither has a consumer today. Reviewer investigation and Fixer edits stay LLM+tools.

## ScoutReviewPlanGrill

Over-proposed the **verdict** as P0. Skill already says any in-plan issue → Needs work. That is code over a count, not Jev.

Real skill-level Jev: in-plan vs out-of-plan vs out-of-scope (drives iterate vs follow-up plan); doc/howto Nouls; grill `boundary_assessment`; fuzzy middle of `omp_execution`; light-grill skip Noul; phase difficulty.

Do not replace: numeric phase thresholds, capability probe, grill conversation, completion-matrix evidence gathering, guardrails.

Eval-kernel `completion()` go/iterate/block: scout suggested `judge()`. **Do not treat that as TypeSafe.** `docs/eval-kernel.md` documents `judge()` as a typed kernel helper only; backend unverified. Out of the Path B chooser plan.

## ScoutTriageEvalPr

Real: I/F/R Scores + bucket lookup; comment type Choice for actionable/question/nit; triage label Choice after evidence is assembled (still human-gated).

Rejected as Jev: `context_skip` (path prefix), duplicate (exact match), issue-create ready-for-agent vs needs-triage when the skill already encodes "has acceptance criteria" (code), plan-vs-phased ≤8/≤5 (counts), theme *names* (generation / open set). Theme *assignment* to a predeclared slug list could be Choice if the list is closed.

Do not replace: claim reproduction, grilling, agent briefs, validation batteries, merge-order graphs, plan prose.

## ScoutEvalKernel

OMP eval prelude documents `judge()`. Backend unverified in this repo (no typesafe/jev usage under `extensions/` or `skills/`). Not a cutover target until verified against the OMP runtime.

`runOmpModelSession` is a text-LLM factory. Do not route closed-set logic through it.

`state-machine.ts` and `b-kamal-release` classifiers are already regex/boolean. Keep.

## Ranking corrections applied by writer

| Scout claim | Correction |
|---|---|
| b-review verdict P0 | Demote. Rule is deterministic given in-plan count. |
| b-triage recommend P0 | Demote P1. Human approval already required; not a live extension call. |
| b-eval I/F/R P0 | Demote P1. Skill-time, not a hot loop. |
| comment classify P0 | Keep P1. Residual only for actionable/question/nit. |
| issue-create label P1 | Reject. Presence of AC is code. |
| phase table drift P3 | Reject. String equality. |
| plan vs phased P3 | Reject. Numeric thresholds. |
| theme naming | Reject generation. |
