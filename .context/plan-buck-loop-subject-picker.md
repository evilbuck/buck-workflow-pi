---
status: active
date: 2026-09-27
subject: 2026-09-19.buck-loop-subject-picker
topics: [buck-loop, subject-ranking, jev, tui, command-surface]
research: []
iterations: []
spec:
memory: [buck-loop-jev-ranked-subject-picker-plan-2026-09-27.md]
---

# Plan: Jev-ranked `/buck-loop` subject picker

## User Goal

When I run `/buck-loop` without a path, show me about ten likely subject folders ranked by probability; when I select one, start the loop on that subject.

## Goal

Replace bare `/buck-loop`'s usage error with a Jev-ranked TUI picker. Discover runnable active subjects, ask TypeSafe Jev for a probability distribution using the current conversation and bounded subject metadata, show up to ten rows in descending probability, then pass the selected folder to the existing supervisor exactly once. Explicit paths and `--resume` / `--status` / `--stop` remain unchanged.

## Context used / assumptions

- **Current behavior:** `parseArgs("")` returns `{ ok: false, error: USAGE }`; the handler emits an error toast and returns before creating activity, a log, or calling `handleLoop`. `scan()` requires an explicit path and still refuses `.context` because it never guesses among subjects.
- **User direction:** the command should not auto-start a guessed subject. Jev ranks candidates; the operator makes the final TUI selection; that selection kicks off buck-loop.
- **Existing primitives:** `runJev(createTypeSafeEvaluator(), request)` is the direct TypeSafe judgment path; `choice.ts` proves how to read Jev choice results. `listSubjectFolders()` and `inspectSubjectLifecycle()` are the lifecycle authority. `scan({ projectRoot, path })` is the existing runnable-plan classifier. `ctx.sessionManager.getBranch()` / `getEntries()` exposes bounded user/assistant conversation context.
- **Capability probe:** `full`, from the system available-skills catalog (`b-build`, `b-review`, and `b-save` are all loaded).
- **Selection semantics:**
  - “About ten” means at most 10 visible rows; fewer are shown when fewer eligible subjects exist.
  - Active subjects are preferred. Draft subjects are considered only when there are no active candidates, matching the shared subject-resolution protocol.
  - A candidate must resolve through `scan(subjectName)` to `unphased` or `phased-incomplete`. Completed, malformed, ambiguous multi-plan, dependency-blocked, and no-plan subjects are excluded.
  - When more than 50 eligible subjects exist, judge the 50 newest folder basenames to bound request size. Stable recency order breaks equal-probability ties.
  - A sole eligible candidate gets probability 1 without calling Jev, but is still presented for operator confirmation.
  - Jev failure, missing credentials, malformed/partial probabilities, missing TUI support, timeout, or cancel stops this invocation without persisting or starting a run. No recency fallback and no chat-model fallback.

## Scope

1. Discover and summarize eligible subject folders using the existing lifecycle and scan authorities.
2. Build one TypeSafe `choice` judgment whose labels are opaque candidate IDs and whose criteria contain bounded subject metadata; include a bounded tail of user/assistant conversation as state.
3. Validate Jev's full candidate probability map, rank descending, and render up to ten TUI rows with probability, subject basename, and a short title/next-work hint.
4. Convert empty command input into a start-without-path request; after the operator selects a row, call the existing `handleLoop` path with the raw subject basename.
5. Keep logging, activity, resume, safety confirmations, scan behavior, and explicit command forms intact.
6. Update user-facing command documentation and add the missing run how-to if review confirms how-to impact.

## Out of scope

- Automatically starting the highest-probability subject.
- Letting Jev create subjects, plans, paths, or free-form output outside the candidate set.
- Ranking plans or phases inside a subject; subjects with multiple plans remain ineligible until the operator passes an explicit plan path.
- Changing `scan()`'s explicit-path contract or phase-selection logic.
- Falling back to the configured `choice` stage, `smol`, host model, heuristics, or recency when TypeSafe judgment fails.
- Provider connectivity probes, model-profile changes, or a new model setting for subject ranking.
- Re-prompting during a run or on `--resume`.

## Affected files

| File | Change |
|---|---|
| `extensions/buck-loop/subject-choice.ts` | New candidate discovery, bounded metadata/conversation state, Jev probability validation/ranking, and display-row mapping. |
| `extensions/buck-loop/index.ts` | Parse empty input as start-without-path; run ranking + bounded `ui.select`; create the start log and call `handleLoop` only after selection. |
| `extensions/buck-loop/__tests__/subject-choice.test.ts` | Candidate filtering, lifecycle fallback, request shape, probability validation, stable ranking, cap, and sole-candidate behavior. |
| `extensions/buck-loop/__tests__/wire.test.ts` | Bare-command picker flow, selected-path kickoff, cancel/timeout/headless/Jev failure, and explicit-command bypass. |
| `docs/adr/0002-observably-invoked-happy-path-loop.md` | Record that no-path invocation uses Jev only to rank and still requires an operator selection. |
| `docs/extension-loading.md` | Document optional path and ranked picker behavior. |
| `docs/buck-workflow.md` / `docs/oh-my-pi.md` | Update only remaining text that says a positional path is always required. |
| `docs/howto/run-buck-loop.md` | Add through `/b-howto` if review confirms no existing procedure covers no-path selection and successful kickoff. |

`scan.ts`, `loop.ts`, `machine.ts`, `persist.ts`, and `choice.ts` should not require behavior changes. `subject-choice.ts` reuses their exported contracts rather than teaching the state machine to guess.

## Implementation steps

1. **Candidate model and discovery** — Add `SubjectCandidate` with opaque id, folder basename, title/summary, and resolved plan/phase hint. Start from `listSubjectFolders(projectRoot)`, select active statuses (or drafts only when no active subjects), and retain only `scan()` results with `unphased` or `phased-incomplete` facts. Sort newest first and cap the judgment pool at 50.
2. **Bounded evidence** — Read only each candidate's `index.md` heading/first prose summary and the resolved plan/phase filenames, with per-field and aggregate character caps. Extract at most the latest eight user/assistant messages, capped at 12,000 characters; exclude system, tool, and custom entries.
3. **Native judgment** — For 2+ candidates, call `runJev(createTypeSafeEvaluator(), ...)` with one `choice` question. Criteria labels are `candidate_0`, `candidate_1`, etc.; values contain the candidate metadata. Instructions ask which subject best matches the operator's current conversation and require calibrated probabilities. Do not use `choose()` because its profile/chat fallback violates this feature's Jev-only contract.
4. **Validate and rank** — Require a legal chosen label plus a finite, non-negative probability for every offered label and no unknown labels. Sort descending; preserve newest-first order for ties. Return the first 10. One candidate returns a synthetic 1.0 result; zero returns an actionable no-candidates result.
5. **Argument and UI boundary** — Change the start variant to allow an absent path and make `parseArgs("")` return it. Extend command context with optional `sessionManager` and `ui.select`. For no-path start, create the activity widget with `Choosing a subject`, rank candidates, and invoke `select` with full bounded dialog options (timeout plus `AbortSignal`). Rows include percentage + subject name + hint and map back to the untouched basename.
6. **Kickoff and cleanup** — After selection, switch activity to `Starting <subject>`, create the JSONL drain with the selected path, and call `handleLoop({ command: "start", path: subject })` exactly once. On rank failure, no UI, timeout, or cancel: notify, dispose activity, and do not create a run log/projection. Keep the existing `try`/`catch`/`finally` behavior after kickoff.
7. **Tests** — Add pure tests with injected evaluator/session data and wire tests with a fake select. Assert consumer-visible candidate order and exact kickoff path, not implementation text. Preserve existing explicit path/flag, scan-no-guess, activity-log, and safety-confirmation tests.
8. **Docs** — Update the ADR and command references. During `/b-review`, classify how-to impact; if positive, run `/b-howto` for the no-path selection procedure and observable success check.

## Acceptance criteria

- [ ] `/buck-loop` with no args and 2+ eligible subjects calls TypeSafe Jev once, presents at most 10 subjects in descending returned probability, and does not start before operator selection.
- [ ] Selecting a displayed row calls `handleLoop` exactly once with `{ command: "start", path: <raw-subject-basename> }`; the start JSONL invocation records the same path.
- [ ] Rows show the subject basename and probability; equal probabilities retain newest-first deterministic order.
- [ ] Candidate labels are closed and opaque. Unknown labels, missing candidate probabilities, non-finite/negative values, TypeSafe errors, or missing credentials fail closed with no model or heuristic fallback.
- [ ] Completed/malformed subjects and subjects that `scan()` classifies as missing or phased-complete are absent. Drafts appear only when no active runnable candidates exist.
- [ ] A sole candidate is shown at 100% without a Jev request. Zero candidates produces an actionable notification and no picker or loop start.
- [ ] Headless/missing `ui.select`, dialog timeout, and cancel create no loop projection/log and call neither `handleLoop` nor a fallback model.
- [ ] Explicit path, `--resume`, `--status`, and `--stop` never discover, rank, or display subjects.
- [ ] `scan("")` still returns `path is required`, and `scan(".context")` still refuses to guess.
- [ ] The chosen subject remains fixed for the invocation and `--resume` uses the persisted projection without re-ranking.

## Verification

- `npx vitest run extensions/buck-loop/__tests__/subject-choice.test.ts extensions/buck-loop/__tests__/wire.test.ts`
- Candidate fixtures: active + draft + completed + malformed + no-plan + multi-plan + phased-complete; verify active-first/fallback and runnable filtering.
- Jev fixtures: known distribution orders rows; equal values retain recency; 12 candidates display 10; unknown/missing/negative/`NaN` probability fails closed; sole candidate bypasses evaluator.
- Wire smoke: invoke the registered handler with empty args, a fake conversation tail, and fake selector; observe ranked rows, select one, then verify `handleLoop` and the JSONL invocation receive that exact basename. Exercise cancel and timeout to verify no run artifacts.
- Regression: `npx vitest run extensions/buck-loop/__tests__`.
- Deterministic contract: `npm run guardrails:check` at the coherent post-edit checkpoint.
- Live OMP smoke after build: discuss a known active subject, run bare `/buck-loop`, verify that subject ranks plausibly near the top, select it, observe `Starting <subject>`, then stop/resume and confirm no second ranking dialog.

## Execution Instructions

This plan looks large enough to benefit from phasing because it changes the command boundary, introduces a Jev ranking module, adds two test surfaces, and updates user-facing documentation. Run `/b-phase` to break it into sequential OMP-ready execution phases with dependency analysis, per-phase model hints, and resume-safe execution instructions.

## Risks

- **Conversation signal can be weak.** The TUI keeps the operator as the final authority; ranking never auto-starts.
- **Stale lifecycle metadata can hide/show the wrong work.** Candidate discovery uses the existing lifecycle authority and `scan()` instead of inventing another status parser.
- **Large active sets can inflate judgment input.** Bounded summaries and the 50-candidate judgment cap constrain cost; the UI remains capped at 10.
- **Jev probability shape can drift.** Validate the complete distribution and fail closed rather than presenting a false ranking.
- **Modal UI can hang RPC/headless callers.** Use bounded dialog options and treat timeout/cancel as denial.
- **Logging before selection would record an empty path.** Delay start-log creation until the operator has selected the subject.
