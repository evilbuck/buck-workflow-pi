---
status: completed
phase: 1
order: 1
plan: plan-jev-tool.md
phases_overview: plan-jev-tool-phases.md
difficulty: hard
model_hint: strongest reasoning model available — this phase establishes a new external SDK and OMP tool-registration boundary with fail-closed error behavior
buck_hint: /b-build-hard
goal: "Register a generic Jev OMP tool with a tested TypeSafe systemOne-compatible contract and no model fallback."
files:
  - package.json
  - package-lock.json
  - extensions/jev-tool/index.ts
  - extensions/jev-tool/__tests__/
  - extensions/index.ts
  - extensions/buck-mode.test.ts
from_plan_steps: [1, 2, 3]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] `@typesafe-ai/sdk` is installed through the repository dependency manifest and lockfile; its ESM import and constructor behavior are verified against the installed package."
  - "[x] Extension load registers a `jev` tool accepting TypeSafe-compatible `state`, named `questions`, and optional `model`, then returns the full `SystemOneResult` passthrough."
  - "[x] Noul, Choice, and Score question shapes are accepted; malformed or empty questions return one actionable failure result."
  - "[x] Missing `TYPESAFE_API_KEY` and SDK failures fail closed without `runOmpModelSession`, `createAgentSession`, or any fallback model call."
  - "[x] Focused Jev-tool and extension-registry tests pass, including multi-question passthrough and model override."
completed_at: 2026-09-21
completed_by: null
---

# Phase 1: Jev Tool Contract

## Context

Parent user goal: Engineers using OMP can offload “is this phase hard?” to Jev while the main model still designs phases, and the generic registered tool remains reusable for later classifications.

This phase establishes the reusable tool boundary only. It does not change phase difficulty parsing or the `b-phase` skill. Phase 2 consumes the final wire point in `extensions/index.ts`; Phase 3 consumes this tool contract.

## Implementation Details

1. Add `@typesafe-ai/sdk` to the repository dependency manifest using the plan’s package command. Keep the repository lockfile coherent. Inspect the installed SDK exports and constructor behavior rather than assuming the import shape.
2. Create `extensions/jev-tool/index.ts` following existing `wire(api)` and `api.registerTool` conventions.
   - Accept `state`, named `questions`, and optional `model`.
   - Match TypeSafe `systemOne` question semantics for Noul, Choice, and Score.
   - Keep the tool generic: no phase threshold or Buck-specific logic.
   - Inject the client factory for tests; the production default constructs the real TypeSafe client.
3. Return the complete `SystemOneResult` (`answers`, `model`, `usage`) as the tool result. Do not trim or reinterpret answers.
4. Validate that `questions` is non-empty and each declared question type is known before calling the SDK. Convert missing credentials and SDK errors into one actionable error result. Never start another model/session as fallback.
5. Wire the module from `extensions/index.ts` without disturbing existing extension wires or model auto-switch behavior.
6. Add focused tests with a fake client covering:
   - Noul passthrough;
   - mixed/multiple questions, including Choice and Score;
   - empty or malformed questions;
   - missing API key;
   - SDK failure;
   - explicit model override;
   - registration from the root extension wire.

Do not implement the eval twin or buck-loop chooser migration. Do not add the `>= 0.7` policy to the generic tool.

## Risks

- **SDK assumption drift:** TypeSafe exports or constructor credential behavior may differ from the plan. Mitigation: verify the installed package before finalizing types and tests.
- **Tool error leakage:** Throwing raw SDK errors may produce inconsistent agent behavior. Mitigation: one fail-closed actionable result at the tool boundary.
- **Fallback contamination:** Reusing OMP model helpers would violate the Jev contract. Mitigation: tests and source checks prohibit alternate model/session calls.
- **Root-wire regression:** `extensions/index.ts` also owns phase model auto-switching. Mitigation: keep this phase’s change to registration and run `extensions/buck-mode.test.ts`.

## Verification

- Run the focused Jev-tool test file(s).
- Run `npx vitest run extensions/buck-mode.test.ts`.
- Exercise the registered tool with a fake client through the root `wire(api)` path and observe the full passthrough response.
- Confirm the Jev implementation contains no `runOmpModelSession`, `createAgentSession`, or fallback-model call.
- Run `npm run guardrails:check` at the completed edit checkpoint.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), route them to a separate `/b-plan` → `/b-build` follow-up. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress` so the next session resumes here.
