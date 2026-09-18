---
status: pending
phase: 4
order: 4
plan: plan-buck-loop-extension.md
phases_overview: plan-buck-loop-extension-phases.md
difficulty: hard
model_hint: strongest reasoning model available — nested-session isolation, tool authority, model routing, and abort behavior are load-bearing
buck_hint: /b-build-hard
goal: "Run each Buck work step in an isolated nested OMP session with injected skill text, bounded tools, and no authority to choose the next state."
files:
  - extensions/buck-loop/run-step.ts
  - extensions/buck-loop/__tests__/run-step.test.ts
from_plan_steps: [4]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] `run-step.ts` loads the requested Buck skill body and names the exact plan or phase path in the nested-session prompt."
  - "[ ] Nested work sessions set `disableExtensionDiscovery: true`, preventing `/buck-loop` recursion."
  - "[ ] Tool sets are least-privilege by step: coding tools for build/iterate, read-heavy tools for review, and established improved-command patterns for docs, how-to, save, and commit."
  - "[ ] Model routing follows phase difficulty exactly: easy→smol, medium→slow, hard→default, using existing OMP role mapping."
  - "[ ] The timeout is a named 15-minute constant; abort, timeout, throw, or empty result returns a failed step."
  - "[ ] The runner returns only `{ ok, text }` diagnostics and never interprets or selects the next loop state."
  - "[ ] Focused nested-session tests pass with mocked `createAgentSession`."
completed_at: null
completed_by: null
---

# Phase 4: Nested Work Sessions

## Context

Parent user goal: An operator can leave a well-scoped Buck plan running unattended through build → review → iterate-if-needed → docs-if-needed → save → commit → next phase, without XState. Every transition is either a deterministic disk/git check or a closed-set LLM choice the machine validates.

Phase 1 defines work effects. This phase executes them but has no transition authority. The supervisor will trust a Phase 2 rescan, not a worker's final sentence.

## Implementation Details

1. Create `run-step.ts` as a separate helper for long work sessions. Do not reuse the short b-save classifier timeout.
2. Support the bounded parent-plan skill set: `b-build`, `b-build-hard`, `b-review`, `b-iterate`, `b-docs`, `b-howto`, `b-save`, and `b-commit`.
3. Resolve and inject the canonical skill markdown into the prompt. Lead with that skill contract and include the exact plan or phase path. Because extension discovery is disabled, the worker must not depend on slash-command expansion.
4. Set `disableExtensionDiscovery: true`. Derive the minimum tool allowlist per skill from existing improved-command patterns:
   - build/iterate: `read`, `edit`, `write`, `grep`, `bash`;
   - review: read-heavy tools only;
   - docs/how-to/save/commit: only the capabilities their current deterministic or skill contracts require.
5. Route models through existing `mappingFromOmpRoles` / `DIFFICULTY_TO_ROLE`: easy→smol, medium→slow, hard→default. Do not hard-code provider IDs.
6. Use a named 15-minute timeout constant, following the code-review-iteration precedent. Treat abort, timeout, exception, or empty output as `{ ok: false, text }`.
7. Return `{ ok, text }` only. Do not parse worker prose for phase status, review disposition, or next state.
8. Mock `createAgentSession` in tests. Assert prompt content, skill loading, model role, tool allowlist, extension isolation, timeout, success, throw, abort/timeout, and empty-output behavior.

## Risks

- A broad shared tool set defeats step isolation. Define explicit per-skill capabilities rather than one union.
- If skill text is missing or loaded from the wrong checkout, the nested worker cannot execute the Buck contract. Fail before session creation.
- Parsing the worker summary here would create a second classifier. Preserve raw diagnostic text and let Phase 2 scans determine postconditions.
- A 15-minute timeout may be tight for `b-build-hard`; keep it a named constant, as the parent plan requires, without adding configuration UI.

## Verification

- Run `vitest run extensions/buck-loop/__tests__/run-step.test.ts`.
- Assert every session disables extension discovery and receives the exact plan/phase path plus non-empty canonical skill text.
- Assert the helper never returns a state or choice and failure cases are distinguishable from success.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress` so the session resumes here next turn.
