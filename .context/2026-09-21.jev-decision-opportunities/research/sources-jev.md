---
status: active
date: 2026-09-21
subject: 2026-09-21.jev-decision-opportunities
topics: [jev, typesafe, sources]
informs: []
---

# Sources

Access date: 2026-09-21.

## TypeSafe docs

| URL | What it established |
|---|---|
| https://docs.typesafe.ai/introduction | Jev = System One. State + typed questions → structured answers. No text generation. |
| https://docs.typesafe.ai/introduction/coding-agents | Jev is not a drop-in coding-agent LLM. Use it *inside* agents for routing/classification/scoring. |
| https://docs.typesafe.ai/concepts/system-one | Fast calibrated decisions; Choice / Score / Noul; ~text/JSON only (no images). Kahneman System 1. |
| https://docs.typesafe.ai/primitives | Atomic questions; compose in code; mix types in one request; independent parallel eval. |
| https://docs.typesafe.ai/primitives/choice | Closed-set option map; `choice` + `probabilities` + `confidence`. |
| https://docs.typesafe.ai/confidence | Confidence derived from distribution shape; high/medium/low → act / confirm / escalate. |
| https://docs.typesafe.ai/patterns | Fan-out, confidence routing, composite scoring, intent routing. |
| https://docs.typesafe.ai/patterns/confidence-routing | Answer = what; confidence = whether to act. Risk-scaled thresholds. |
| https://docs.typesafe.ai/patterns/intent-routing | Cheap classifier in front of deterministic code / specialist LLM / human. |
| https://docs.typesafe.ai/concepts/how-to-build-with-system-one | Code owns control flow; model only for narrow common-sense over unstructured data. ~100ms. |
| https://docs.typesafe.ai/cookbooks/skill_suggestion | Two-call skill router over 182 skills; wrong-load 16.8% → 7.3%. |
| https://docs.typesafe.ai/sdk/javascript | `npm install @typesafe-ai/sdk`; `TypeSafeClient.systemOne`; `TYPESAFE_API_KEY`. |
| https://docs.typesafe.ai/llms.txt | Full doc index. |

## Local

| Path | Role |
|---|---|
| `docs/eval-kernel.md` | OMP `judge(state, questions)` already exists; prefer over `completion()` for classification. |
| `extensions/buck-loop/choice.ts` | Live JSON-coerced closed-set chooser. |
| `extensions/b-save-improved/index.ts` | Scribe (generation) vs auditor (closed verdict). |
| `extensions/code-review-iteration/{findings,prompts,rubric,machine,loop}.ts` | Ratings computed in code; Reviewer/Fixer are tool sessions. |
| `extensions/omp-models.ts` | Text-LLM session factory (`runOmpModelSession`). |
| `extensions/state-machine.ts` | Pure deterministic evaluator. |
| `.context/backlog/items/buck-loop-contextless-choice-stall.md` | Known chooser stall. |

## Scouts (2026-09-21)

Structured payloads at `agent://ScoutBuckLoop`, `ScoutSaveCommitPr`, `ScoutCodeReview`, `ScoutReviewPlanGrill`, `ScoutTriageEvalPr`, `ScoutEvalKernel`.
