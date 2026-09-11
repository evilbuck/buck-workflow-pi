---
status: active
date: 2026-09-10
subject: 2026-09-10.b-save-state-machine-analysis
topics: [b-save, parity, phase-6]
---

# Phase 6 parity checklist

Fixture evidence from `npx vitest run extensions/b-save` (67 tests, 2026-09-10). Live OMP interrupt/resume is **not** recorded yet — cutover waits on that.

| Scenario | Fixture evidence | vs prompt `/b-save` | vs `/b-save-improved` |
|---|---|---|---|
| 1 Session state | `evaluate.test.ts` closed rule 1 from snapshot `session_evidence` | prompt treats current-session as hint | improved reports, does not select |
| 2 Subject | unique active subject selected; >1 → `UserGateError` | prompt may guess newest | improved enumerates |
| 3 Memory | scribe required; path derived, not model-chosen | prompt writes freely | improved scribe + apply |
| 4 Crossref | subject files must stay under `.context/` | prompt stitches memory arrays | improved applyCrossrefs |
| 5 Backlog | inferred completions gated; `--archive-inferred` required | prompt archives mixed | improved stages inferred |
| 6 Spec status | missing auditor → `NeedsJudgmentError` | prompt LLM-judges | improved auditor verdicts |
| 7 Memory index | upsert keyed by filename | prompt appends | improved canonical upsert |
| 8 Native memory | Hindsight `unsupported`; local stored>0 succeeds; stored:0 retries then `failed_nonblocking` | prompt mainline retain | improved retain/learn |
| 9 Reindex | isolated adapter returns `skipped` | optional skill | skip |
| 10 Phases | non-mechanical → evidence-auditor | prompt consolidates | improved status fields |
| 11 Iterates | same auditor routing | prompt consolidates | improved iterates |
| 12 User goal | exact/missing closed; near-match → goal-classifier | prompt warns | improved heading scan |
| Stale hashes | `StaleInputError` | n/a | preflight hashes |
| Model retry | `roles.test.ts` one retry then `failed_model` | n/a | EmptyModelResponseError retry |
| Prompt injection | roles ignore injection in evidence | n/a | isolation |
| User gates | subject + inferred backlog | n/a | `--archive-inferred` |
| Interrupted apply | `apply.test.ts` rollback/resume | n/a | apply is one-shot |
| Idempotent index | `upsertIndexLine` no duplicate | prompt can duplicate | apply idempotent |
| Backends | hindsight unsupported; local/mnemopi count-checked | retain/learn | same split |

## Live verification

- [x] Disposable repo: persist `awaiting_subject_choice`, resume with `--run-id` + `--subject` (`command.test.ts`)
- [x] Interrupted apply resume/rollback (`apply.test.ts`)
- [x] Extension `registerCommand("b-save")`; `commands/b-save.md` + `commands/deprecated-b-save.md` exist; `b-save-improved` files gone
- [x] Guardrails: 443 tests, patch coverage 90% vs `origin/master`, lizard CCN ≤ 10 on new engine files

Interactive OMP TUI `/b-save` in a separate linked package session was not run; the engine adapter and registration tests are the recorded live proof.
