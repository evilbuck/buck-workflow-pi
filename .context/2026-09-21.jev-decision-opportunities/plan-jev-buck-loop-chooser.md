---
status: active
date: 2026-09-21
updated: 2026-09-21
subject: 2026-09-21.jev-decision-opportunities
topics: [jev, typesafe, buck-loop, choice, sdk]
research: [research-jev-decision-opportunities.md]
iterations: []
spec: null
memory: []
---

# Plan: Jev Path B — buck-loop closed-set chooser

## User Goal

Operators running `/buck-loop` get the next legal action from a calibrated TypeSafe Choice over assembled loop state, instead of a tool-less smol session that is coerced into JSON and can legally `block` with no evidence.

## Goal

Replace `extensions/buck-loop/choice.ts` `runOmpModelSession` + JSON parse with a direct `@typesafe-ai/sdk` `systemOne` Choice. Gate on confidence in **our** code. Empty legal set, missing key, SDK throw, illegal label, or low confidence → `blocked`. Never fall back to a text LLM. Nested workers, scan, and the state machine stay unchanged.

## Context used / assumptions

- User-provided context: Jev opportunity research; `/fork b-plan`; TypeSafe skill install; extra-efficiency discussion limited to this repo; advisor check on standards-axis and empty-digest scribe.
- Session context: P0 is `choice.ts`. Path A (`judge()`) is out of scope until the OMP runtime backend is verified. Extra-efficiency ideas stay out of this plan.
- Artifacts used: `research-jev-decision-opportunities.md` (corrected 2026-09-21). Live TypeSafe docs: [state](https://docs.typesafe.ai/concepts/state.md), [choice](https://docs.typesafe.ai/primitives/choice.md), [JS SDK](https://docs.typesafe.ai/sdk/javascript.md). Skill on disk (verified 2026-09-21): `~/.omp/agent/skills/typesafe-ai`, `~/.pi/agent/skills/typesafe-ai`.
- Code: `choice.ts:112-204`, `loop.ts:337-351` + `decisionContext` at `loop.ts:562-572`, `types.ts:129-141`, `__tests__/choice.test.ts` (mocks `runOmpModelSession`).
- Assumptions:
  - Live calls need `TYPESAFE_API_KEY` (JS SDK docs). Missing key is **our** fail-closed policy: block, no smol fallback. Do not claim SDK HTTP status codes.
  - Jev `state` is a **named JSON object**, not the concatenated `decisionContext` string. Fields: `loopState`, `phaseOrPlanPath`, `why`, `review`, `postcondition` (same facts as today).
  - Question id is for code only. `instructions` is a complete question. `criteria` keys = legal kinds; values are short distinguishing descriptions (not `null`).
  - Use `choice()` + `TypeSafeClient.systemOne` from `@typesafe-ai/sdk`.
  - Jev returns no `reason`; keep `AcceptedChoice.reason` as `jev confidence=<n>` for the audit field.
  - One SDK call. Drop the two-attempt JSON retry (`choice.ts:129-141`).
  - Injectable `systemOne` on `choose()` so CI never hits the network.
  - JS SDK documents Node 20+. This package `engines.node` is `>=18`. Do not bump engines in this plan; implement on Node 20 (this workstation). Flag if CI is 18.
- Open questions: operator key availability (document; do not block the build). Confidence floor 0.7 until measured on this task.

## Scope
- Add `@typesafe-ai/sdk` as a runtime dependency; update `package-lock.json`.
- Rewrite `choose()` / delete JSON extract-parse-prompt-session helpers in `choice.ts`.
- Change `decisionContext` to return a named object; `chooseSafely` still passes it as `context`.
- Stop importing `runOmpModelSession` / `resolveOmpRole` from `choice.ts`.
- Rewrite `extensions/buck-loop/__tests__/choice.test.ts` against the injected client.
- Export a named confidence floor constant.
- Audit JSON records `choice`, `probabilities`, `confidence` (not raw model prose).

## Out of scope

- OMP `judge()`, eval cells, b-plan workflow template.
- `b-save-improved` auditor **and** scribe (scribe always runs at `index.ts:655-658`; auditor already gated by `needsAuditor` at `:664-671`. Empty-digest skip is a product choice, not this cutover).
- `b-review` standards-axis skip (skill always spawns the parallel `task`; docs-only only changes the seed, `SKILL.md:54-74`. Skipping would change the two-axis contract).
- b-review/b-triage/b-grill skill hooks; 64-skill roster gate; fix-pr comment Noul; code-review persona auto-select.
- `run-step.ts` nested workers, `machine.ts`, `scan.ts`, loop disk transitions (only `decisionContext` shape changes).
- LLM fallback if the key is missing.
- Streaming token `onActivity` from the SDK (no documented equivalent to the smol text delta). Existing stream test is deleted, not re-pinned.
- ADR (reversible adapter behind `choose()`). Living-doc sync is `/b-docs` if review flags it.

## Affected files

- `package.json`, `package-lock.json`
- `extensions/buck-loop/choice.ts`
- `extensions/buck-loop/loop.ts` — `decisionContext` only
- `extensions/buck-loop/__tests__/choice.test.ts`
- `extensions/buck-loop/types.ts` — only if `AcceptedChoice.reason` comment needs a one-line update (no shape change)

## Implementation steps

1. **Dependency.** Add `@typesafe-ai/sdk` to `package.json` `dependencies` (pin the current documented JS SDK release at implement time; docs currently link v0.6.0 sources). `npm install` so the lockfile updates. Do not add it as optional/peer.
2. **Inject the client.** `choose(opts)` gains optional `systemOne`. Default: `new TypeSafeClient()` then `systemOne({ state, questions: { next: choice(instructions, criteria) } })`. If `process.env.TYPESAFE_API_KEY` is missing/empty, do not construct/call the client; return `blocked` with reason `TYPESAFE_API_KEY is not set`.
3. **Named state + one Choice.** `decisionContext` returns `{ loopState, phaseOrPlanPath, why, review, postcondition }`. Instructions: complete sentence such as "Which legal loop action should run next given this snapshot?" Criteria: only `opts.legal` kinds, each with a one-line description that separates it from the others. Empty legal → block, no call. On success: label ∉ legal → block; `confidence < CHOICE_CONFIDENCE_FLOOR` (export `0.7`) → block; else accept. Throw → block via `serializeCallError`. No second attempt. Consume only `answers.next`.
4. **Delete the text-LLM path.** Remove `extractJsonObject`, `parseChoice`, `promptFor`, `callChoiceModel`, the attempt loop, and omp-models imports from `choice.ts`.
5. **Audit.** Record legal, state object, accepted, attempt `1`, `choice`, `probabilities`, `confidence`, synthetic reason. No JSON-prose `raw`.
6. **Tests.** Injected `systemOne` fake. Cover: high-confidence legal accept + audit; low-confidence block (one call); missing key, no client call; empty legal, no call; illegal label → block; throw → block; `systemOne` received named-object state and criteria keys equal the legal set only.

## Acceptance criteria

- [ ] `choice.ts` does not import or call `runOmpModelSession`.
- [ ] Empty legal set still blocks with zero client calls.
- [ ] Missing `TYPESAFE_API_KEY` on the default client blocks; it does not spawn a smol session.
- [ ] Confidence below `CHOICE_CONFIDENCE_FLOOR` blocks after one call.
- [ ] High-confidence legal label accepts; `AcceptedChoice.reason` is the synthetic confidence string.
- [ ] Client throw and illegal label block; no default-advance.
- [ ] Focused `choice.test.ts` passes without network.
- [ ] `loop.ts` `decisionContext` is a named object; machine/scan/run-step otherwise untouched.

## Verification

- `npx vitest run extensions/buck-loop/__tests__/choice.test.ts extensions/buck-loop/__tests__/loop.test.ts`
- `npm run guardrails:check` after the edit batch (code-touching).
- Smoke (manual, not CI): `/buck-loop` with a key set on a non-protected dirty-approved branch; `--status` still works with no key.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build-hard` against this plan (new runtime dep + fail-closed credential path).
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this plan), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this plan. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next turn.

## Risks

- Operators without `TYPESAFE_API_KEY` will always take the fallback-choice `blocked` path. That is intended; document it rather than silently restoring smol.
- New runtime dependency on a small published SDK; pin the version and mock in tests.
- Confidence 0.7 is uncalibrated on this task. Too high → extra operator stops; too low → repeats the stall. Start conservative.
- `onActivity` text deltas go away; the loop supervisor must not require them for progress (activity already has phase notify).

## Revision Log

### 2026-09-21 — lock Path B scope after extra-efficiency check
- Added: out-of-scope rows for standards-axis skip (contract) and empty-digest scribe skip (product); extra-efficiency items stay off this plan.
- Modified: skill install paths to verified `~/.omp/agent/skills/typesafe-ai` and `~/.pi/agent/skills/typesafe-ai`; session context that extra-efficiency talk is not in-scope.
- Removed: none
- Inputs: session context, advisor note on b-review fan-out and draftScribe guard, request `/b-plan-update`
