---
status: pending
phase: 3
order: 3
plan: plan-buck-loop-extension.md
phases_overview: plan-buck-loop-extension-phases.md
difficulty: hard
model_hint: strongest reasoning model available — this phase implements the model-to-machine trust boundary and must fail closed on malformed or illegal output
buck_hint: /b-build-hard
goal: "Implement a tool-less OMP choice helper that can accept only the transition table's current legal enum and audits every result."
files:
  - extensions/buck-loop/choice.ts
  - extensions/buck-loop/__tests__/choice.test.ts
from_plan_steps: [3]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] The helper calls `runOmpModelSession` with extension discovery disabled, MCP disabled, no tools, and restricted tool names."
  - "[ ] The prompt exposes only the current legal enum and asks for JSON `{ choice, reason }`; it does not let the model define route types."
  - "[ ] Parsed choices outside the legal set are rejected and retried once; a second illegal, empty, or non-JSON result blocks instead of advancing."
  - "[ ] A legal mocked choice is the only transition result returned to the caller."
  - "[ ] Every attempt writes a transition audit containing the legal set, raw output, and accepted or rejected outcome."
  - "[ ] Focused choice tests pass without a live model."
completed_at: null
completed_by: null
---

# Phase 3: Closed-Set Choice

## Context

Parent user goal: An operator can leave a well-scoped Buck plan running unattended through build → review → iterate-if-needed → docs-if-needed → save → commit → next phase, without XState. Every transition is either a deterministic disk/git check or a closed-set LLM choice the machine validates.

Phase 1 declares legal choices. This phase implements the single LLM trust boundary. It classifies only when deterministic guards cannot decide and never mutates state directly.

## Implementation Details

1. Create `choice.ts` around `runOmpModelSession` from `extensions/omp-models.ts`. Use the existing role mapping with `smol` first and the established default fallback behavior.
2. Configure the decision session exactly as a classifier boundary: `toolNames: []`, `restrictToolNames: true`, `disableExtensionDiscovery: true`, and `enableMCP: false`.
3. Build the prompt from the current `legal` array only. Request JSON:

   ```json
   { "choice": "<one legal value>", "reason": "..." }
   ```

4. Extract and parse JSON using the established `b-save-improved` parse-then-reject style. Validate `choice` against the supplied legal set after parsing.
5. On an illegal, empty, or unparsable response, retry once with a correction that repeats the legal set. If the second attempt fails, return the explicit blocked outcome; never substitute a default choice.
6. Write `.context/<subject>/transition-audits/<id>.json` for accepted and rejected attempts. Record the legal set, raw model output, parsed value when available, acceptance status, and reason. The machine applies only an accepted legal value.
7. Add mocked-session tests for first-attempt legal output, illegal then legal output, two illegal outputs, empty/non-JSON output, and audit contents. No network or live model.

## Risks

- A permissive JSON extractor can accept commentary containing a second invented value. Parse one object and validate the final scalar against `legal`.
- Retry code can accidentally retain the first illegal value. Each attempt must be independently parsed and audited.
- Returning a fallback such as `save` would violate the user goal. Failure is `blocked`, not progress.
- Audit filenames must avoid overwriting prior attempts while remaining deterministic enough for tests.

## Verification

- Run `vitest run extensions/buck-loop/__tests__/choice.test.ts`.
- Assert mocked calls receive no tools, no MCP, disabled extension discovery, and only the supplied legal enum in the prompt.
- Assert the caller cannot obtain an unvalidated raw model choice and both accepted and rejected audits contain the declared legal set.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress` so the session resumes here next turn.
