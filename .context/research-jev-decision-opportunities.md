---
status: active
date: 2026-09-21
subject: 2026-09-21.jev-decision-opportunities
topics: [jev, typesafe, extensions, skills, judge, closed-set]
informs: [plan-jev-buck-loop-chooser.md]
---

# Research: Jev decision opportunities

Jev is TypeSafe's System One model: state + typed questions → Choice / Score / Noul plus probabilities (and confidence on Choice/Score). It is not a coding LLM. Use it where this repo currently coerces a text model into JSON, or where a skill asks an agent to pick from a closed set after evidence is already assembled.

Two integration surfaces (keep distinct):

| Path | Use when | Mechanism |
|---|---|---|
| **A. OMP `judge()`** | Skills / eval workflow cells, *if* those skills grow eval-cell hooks | Kernel helper is documented in `docs/eval-kernel.md`. **Backend unverified** against the OMP runtime (no TypeSafe/Jev/credential wiring in this repo; grep of `extensions/` and `skills/` is empty). Do not plan against invented `judge()` semantics. |
| **B. `@typesafe-ai/sdk` in extensions** | Live TS call sites (`runOmpModelSession` + JSON parse) | Documented JS SDK: `npm install @typesafe-ai/sdk`, `TYPESAFE_API_KEY`, `client.systemOne`. Do **not** wrap Jev in `runOmpModelSession`. |

Rule of thumb: if code can assemble the state and branch on an enum/score, Jev (or plain code) belongs there. If the model must read, edit, or write prose, keep the LLM.

## P0 — do first

### 1. `extensions/buck-loop/choice.ts` closed-set chooser

**Primitive:** Choice over the runtime legal set (`iterate | document | save | retry | advance | block`). Confidence-gate: low → `block` / await-operator instead of a second coin-flip retry.

**State already exists:** `decisionContext()` in `loop.ts` (`state`, phase/plan path, `why`, parseable/docs/howto, postcondition).

**Why this is the hit:** textbook anti-pattern (`runOmpModelSession`, `tools: []`, parse `{choice, reason}`, two attempts, then block). Known stall: enum-only / weak context → legal `block` (`.context/backlog/items/buck-loop-contextless-choice-stall.md`). Child `reason` is unused. Jev also gives a calibrated "I don't know" that the smol JSON chooser cannot.

**Keep:** `machine.ts` / `scan.ts` (disk-derived next state); `run-step.ts` nested workers.

## P1 — next

| Site | Primitive | State | Notes |
|---|---|---|---|
| `b-save-improved` auditor | Choice `complete \| incomplete \| uncertain` per path | Preflight criteria + file excerpts + diff hunks | Assemble excerpts in **code**; Jev cannot `read`/`grep`. Confidence &lt;0.6 → `uncertain` (apply already no-ops). Scribe stays LLM. |
| `b-review` in-plan vs out-of-plan vs out-of-scope | Choice per finding | Finding + plan scope/affected-files + diff paths | Drives iterate artifact vs follow-up plan. **Verdict itself is code:** any in-plan issue → Needs work. |
| `b-eval-upstream-prs` I / F / R | Three Scores; bucket A–D in code | PR JSON + validation numbers | Composite scoring pattern. Validation battery stays exec. |
| `b-pr-review-2-issues` comment type | Choice `actionable \| question \| nit` | Comment body + author + file | `context_skip` (`.context/` prefix) and `duplicate` (exact match) stay code. |
| Eval workflow go/iterate/block | *Conditional* on Path A | `findings_per_phase` JSON | Only if `judge()` backend is verified in the OMP runtime. Until then, not a cutover target. |

## P2

| Site | Primitive | Why |
|---|---|---|
| `b-review` Documentation / How-to Impact | Two Nouls in one request | Non-blocking; independent of verdict. |
| `b-grill` `boundary_assessment` | Choice `boundaries_found \| cohesive` | Already a 2-option field at Q20; feeds `b-phase`. |
| `b-plan` `omp_execution` middle | Choice `none \| orchestrate \| workflow \| goal` | Keep non-OMP → `none` as code; Jev only for fuzzy predicates. |
| `b-plan` Light Grill skip | Noul `run_light_grill?` | Discretionary today; low cost of a wrong skip. |
| `b-triage` label after evidence | Choice over five roles + category | Still human-gated. Grill / reproduce / brief stay LLM. |
| `b-phase` difficulty | Choice `easy \| medium \| hard` | After grouping; numeric SKIP/PHASE thresholds stay code. |

## P3 / skip unless a consumer appears

- Code-review disposition consistency (Fixer self-claim vs diff).
- Code-review evidence-quality Noul (confidence is display-only today).
- Second `judge()` pass over per-phase `agent()` findings.
- `b-eval` gotcha Nouls (version regression, test-API drift) — often regex-able.

## Do not use Jev

**Generation / tools:** scribe memory; commit titles/bodies; PR descriptions; rebase conflict edits; nested `/buck-loop` workers; Reviewer `review_exec`; Fixer edits; grill interviews; agent briefs; plan/issue prose.

**Already code:** `extensions/state-machine.ts`; `scan.ts` / review machines; `rubric.ts` criticality math; model catalog sort; kamal semver/destination regex; subject lifecycle; guardrails; capability probe; path-prefix `context_skip`; exact-match dedup; "has acceptance criteria → ready-for-agent"; phase-table status equality; ≤8 steps / ≤5 files phasing counts.

**Anti-pattern to avoid:** feeding Jev through `runOmpModelSession` and parsing text. Extensions call `@typesafe-ai/sdk` directly.

## Recommended cutover order

1. **buck-loop `choose()` → `@typesafe-ai/sdk` Choice + confidence gate (Path B).** Live P0 stall. Extension-only. Mock the client in tests. This is the only implementation plan until Path A is verified.
2. **Later, out of this plan:** b-save auditor Choice after a deterministic excerpt assembler. Scribe unchanged.
3. **Later, out of this plan:** skill/eval `judge()` migrations — blocked on verifying the OMP `judge()` backend. Not TypeSafe-by-assumption.

Skill-level Choices (review classification, triage, I/F/R) are **not** extension work. They need eval-cell hooks *and* a verified `judge()` backend.

## Open questions

- Is `TYPESAFE_API_KEY` available on operator machines for Path B live calls?
- What is the OMP `judge()` backend? Unverified. Do not inherit TypeSafe/credential/fail-closed claims.
- Confidence floor for the chooser: start at 0.7 act-else-block; measure before tightening.

## Next

Path B plan: `plan-jev-buck-loop-chooser.md`.
