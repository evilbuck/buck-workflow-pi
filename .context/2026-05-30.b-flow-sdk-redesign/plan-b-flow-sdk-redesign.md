---
status: completed
date: 2026-05-30
subject: 2026-05-30.b-flow-sdk-redesign
topics: [b-flow, pi-sdk, sdk-worker, worker-redesign, xstate, migration]
research: ["research-pi-sdk-worker-architecture.md"]
memory: ["b-flow-sdk-research-2026-05-30.md", "b-flow-sdk-phase1-build-2026-05-30.md", "b-flow-sdk-phase2-build-2026-05-30.md", "b-flow-phase3-test-coverage-2026-05-30.md", "b-flow-sdk-iteration-2026-05-30.md"]
iterations: ["iterate-b-flow-sdk-redesign.md"]
---

# Plan: b-flow SDK-Driven Worker Redesign

## Goal
Replace b-flow's heavyweight `pi -p --no-session` subprocess worker model with lightweight, in-process `createAgentSession()` calls from the Pi SDK (`@mariozechner/pi-coding-agent`). Deliver near-zero startup overhead (~50ms vs 2-5s), real-time event streaming, `session.abort()` + `dispose()` lifecycle, per-chunk model selection by difficulty tier, and read-only tool scoping for review chunks — while preserving **100% backward compatibility** for the existing subprocess path during a safe, phased migration.

## Context used / assumptions

- **Trigger**: Explicit `/b-plan` as the documented "Next Step" in subject `index.md` (following b-research session and architecture review).
- **Artifacts consulted**:
  - `research-pi-sdk-worker-architecture.md` (SDK API surface, isolation guarantees, current worker pain points, open questions, sources)
  - `architecture-review-sdk-worker.md` (Mermaid diagrams, proposed sdk-worker.ts sketch, 3-phase migration, risk register, integration notes)
  - `index.md` (state, backlog linkage)
  - `.context/backlog/items/b-flow-sdk-redesign.md` (motivation: b-flow ~3500 LOC is wired + tested but dormant because subprocess eats main-thread context)
  - `.context/memory/b-flow-sdk-research-2026-05-30.md` (key decisions, files examined)
- **Code inspected** (via read + targeted grep):
  - `extensions/b-flow/worker.ts` (full subprocess impl, prompt builder, result/audit file logic, ~180 LOC)
  - `extensions/b-flow/chunk-queue-machine.ts` (XState actor wiring for runWorker + verifyResult, state "spawningWorker" → "readingResult")
  - `extensions/b-flow/types.ts` (WorkerOptions, WorkerResult, ChunkQueueItem with optional difficulty)
  - `extensions/b-flow/queue-builder.ts` (frontmatter difficulty parsing)
  - `extensions/b-flow/verify-result.ts` (markdown result parser → CHUNK_* events)
  - `extensions/b-flow/__tests__/integration.test.ts` (fakePi PATH injection for subprocess testing, queue assertions)
  - `extensions/b-flow/index.ts` (ExtensionAPI import from same package)
  - Pi SDK (dist + docs/sdk.md + examples/sdk/{05-tools,12-full-control}.ts): createAgentSession options, AgentSession {prompt, subscribe, abort, dispose, messages}, SessionManager.inMemory, SettingsManager.inMemory, tool allowlists, resourceLoader inheritance
  - Transitive: `@mariozechner/pi-ai` getModel usage patterns (already imported elsewhere in extensions/)
- **Assumptions**:
  - Sequential execution (one worker at a time) is the correct Phase 1 default (avoids any shared-state races; throughput is future work).
  - Default `DefaultResourceLoader` (discovering extensions/skills from the same projectRoot) is appropriate — workers are trusted sub-agents executing narrow chunk prompts.
  - `session.dispose()` (preceded by `abort()` on error paths) is sufficient for cleanup in practice; we will add observability rather than custom resource tracking in v1.
  - Current model IDs from project docs (e.g. `anthropic/claude-sonnet-4-6`, `anthropic/claude-opus-4-7`, haiku equivalents) are the ones to use in the mapping.
  - Inside a running Pi extension, `createAgentSession()` inherits the parent's auth credentials correctly via the shared environment / AuthStorage defaults.
  - No new top-level dependencies (SDK is already a transitive dep of the extension host).
- **Key decisions captured**:
  - Integration point: **internal dispatch inside `worker.ts`** (keeps `runWorker` signature identical → zero changes to XState machines, chunk-queue-machine.ts, or any caller for Phase 1). This is lower blast radius than swapping actors.
  - Result compatibility: SDK path will **still write** the exact same `resultFile` markdown + `audit.json` artifacts using synthesized content from toolCalls + final assistant message. verifyResult, persistence, and parent buck machine remain untouched.
  - Model selection: difficulty → fallback array (haiku/sonnet/opus or cheap equivalents) using `getModel`, first available wins.

## Scope

**In scope (Phase 1 — Dual implementation, zero behavioral change when disabled):**
- New `sdk-worker.ts` implementing `runSDKWorker` with full WorkerOptions/WorkerResult compatibility.
- Dispatch logic + flag (env var `BFLOW_USE_SDK_WORKER=1` for now; future settings hook) inside `worker.ts`.
- Unit tests (`sdk-worker.test.ts`) with vitest mocks for the entire SDK surface.
- Integration test coverage additions (flag-driven) that still pass the existing suite when flag=off.
- Additive (non-breaking) fields on WorkerResult for richer SDK telemetry.
- Shared helper extraction in worker.ts for audit/result writing (if it improves clarity without risk).
- Precise updates to subject folder artifacts (this plan, index, research backfill).
- Clear "how to run with SDK worker" comments and a small verification checklist.

**Out of scope (explicitly deferred):**
- Deleting or commenting out subprocess code (Phase 2+).
- Changing the default to SDK worker.
- Concurrent worker execution or pooling.
- Removing file-based result/audit I/O (the SDK path will still produce them for compat; a later cleanup can bypass verifyResult entirely).
- Any modifications to `machine.ts`, `chunk-queue-machine.ts` (actor source), `guards.ts`, `persistence.ts`, `ui.ts`, `index.ts`, or `queue-builder.ts`.
- High-level documentation updates (docs/buck-workflow.md etc.) beyond a one-line note.
- Production end-to-end runs of full b-flow inside a real Pi session (unit + mocked integration only for this plan).
- ResourceLoader sharing or custom loader to reduce discovery cost.
- Changes to prompt templates or buck workflow conventions themselves.

## Affected files

**New (created by this plan):**
- `extensions/b-flow/sdk-worker.ts`
- `extensions/b-flow/__tests__/sdk-worker.test.ts`

**Modified:**
- `extensions/b-flow/worker.ts` (primary — dispatch + helper sharing + JSDoc)
- `extensions/b-flow/types.ts` (additive optional fields on WorkerResult)
- `extensions/b-flow/__tests__/integration.test.ts` (additional describe blocks for flag=1 path)
- `.context/2026-05-30.b-flow-sdk-redesign/index.md` (already updated in pre-plan step)
- `.context/2026-05-30.b-flow-sdk-redesign/research-pi-sdk-worker-architecture.md` (informs backfilled in pre-plan step)

**Intentionally untouched (by design for minimal blast radius):**
- All XState machines and orchestration layer
- `verify-result.ts`, `queue-builder.ts`, `guards.ts`, `persistence.ts`, `machine.ts`, `index.ts`
- `playwright.config.ts`, root package.json, tsconfig (no config changes expected)
- docs/ (except possible one-line note in a later phase)

## Implementation steps

1. **Types (non-breaking)**: In `types.ts`, extend `WorkerResult` with optional fields: `toolCalls?: Array<{name: string; input: unknown}>`, `messageCount?: number`, `changedFiles?: string[]`. Update JSDoc. No other type changes.

2. **Refactor worker.ts for dual dispatch (safe, small diff)**:
   - Rename the existing body of `runWorker` to `runSubprocessWorker` (keep internal, same signature).
   - Add `import { runSDKWorker } from "./sdk-worker.js";` (or export from new file).
   - At top of exported `runWorker`:
     ```ts
     const useSDK = process.env.BFLOW_USE_SDK_WORKER === "1";
     // future: || settings flag from options or global
     if (useSDK) {
       return runSDKWorker(chunk, options);
     }
     return runSubprocessWorker(chunk, options);
     ```
   - Extract 1-2 pure helpers if helpful: `ensureResultDirs(base, subject)`, `buildResultMarkdown(...)` (used by both paths). Keep subprocess path 100% identical in behavior and side effects.
   - Update the file header JSDoc and the "Default worker implementation" comment.

3. **Create `sdk-worker.ts`** (core new code, ~120-180 LOC):
   - Imports: createAgentSession, SessionManager, SettingsManager from "@mariozechner/pi-coding-agent"; getModel from "@mariozechner/pi-ai"; types from "./types.js" and node fs/path.
   - `BUCK_MODEL_MAPPING` (refined with current IDs from docs/buck-workflow.md):
     ```ts
     easy: ["anthropic/claude-haiku-4-6", "openai/gpt-4o-mini"],
     medium: ["anthropic/claude-sonnet-4-6", "openai/gpt-4o"],
     hard: ["anthropic/claude-opus-4-7", "anthropic/claude-sonnet-4-6"],
     ```
   - `selectModel(difficulty, override?)` using getModel(provider, id) with fallback chain.
   - `selectTools(chunk)`: iterate/review → read-only set; else full coding set. Match names from SDK examples (read, grep, find, ls, bash, edit, write).
   - `buildChunkPrompt(chunk, goal)`: simpler than subprocess version — no resultFile mention. Focus on "execute this chunk, report changes explicitly".
   - `extractChangedFiles(toolCalls)`: from edit/write inputs.
   - `synthesizeResultMarkdown(...)`: build the exact frontmatter + sections that verifyResult expects, populated from trace + last assistant message + goal/chunk metadata.
   - `runSDKWorker(chunk, options: WorkerOptions): Promise<WorkerResult>`:
     - Compute resultDir / auditDir / resultFile / auditFile using same logic as subprocess (or call shared helper).
     - Write initial audit JSON.
     - `const { session } = await createAgentSession({ cwd: projectRoot, sessionManager: SessionManager.inMemory(projectRoot), settingsManager: SettingsManager.inMemory({compaction:{enabled:false}, retry:{enabled:true,maxRetries:2}}), model: selectModel(...), thinkingLevel: "off", tools: selectTools(chunk) });`
     - Subscribe to capture tool_execution_start events into toolCalls array.
     - `await Promise.race([ session.prompt( buildChunkPrompt(...) ), timeoutPromise ])`
     - On success: synthesize + write resultFile (using same format), update audit, return `{ type: "WORKER_COMPLETED", resultFile, status: "completed", toolCalls, messageCount: session.messages.length, changedFiles }`
     - On error/timeout: `await session.abort();` then `session.dispose();` return FAILED.
     - `finally { session.dispose(); }` (guaranteed).
   - Re-use or duplicate minimal dir/audit logic for v1 (or share via worker.ts helpers).

4. **Unit tests — `sdk-worker.test.ts`** (new, high coverage):
   - `vi.mock("@mariozechner/pi-coding-agent", () => ({ createAgentSession: vi.fn() }));`
   - `vi.mock("@mariozechner/pi-ai", () => ({ getModel: vi.fn() }));`
   - Helper to build a fake AgentSession (object with prompt: vi.fn().mockResolvedValue(), subscribe, abort, dispose, messages, etc.) that can emit tool events via the listener.
   - Tests for:
     - tool selection matrix (iterate vs phase vs backlog)
     - model selection + fallback + override
     - prompt construction (no resultFile leakage)
     - happy path: toolCalls captured, resultFile written with correct YAML + summary, changedFiles extracted
     - timeout path: abort called, FAILED result, dispose called
     - error path in prompt
     - audit file written with expected fields
     - result markdown is parseable by verifyResult (integration-lite check)
   - Use `beforeEach` cleanup of temp dirs.

5. **Integration test updates**:
   - Add `describe("SDK worker path (BFLOW_USE_SDK_WORKER=1)", () => { ... })` blocks.
   - Because full SDK requires models/creds, the tests can either (a) stay mocked at the createAgentSession level (preferred for CI), or (b) document that real-path coverage is manual.
   - Ensure the existing subprocess tests (fakePi) continue to pass with flag=0 or unset.
   - Assert that when flag=1 the machine still reaches COMPLETED/VERIFIED states and result files appear in the expected .context/.../worker-results locations.

6. **Cross-reference & subject hygiene** (already partially done):
   - Research `informs` backfilled.
   - Index.md updated with plan row + next-step text (done in pre-write step).
   - Add a one-sentence note in the plan itself about the architecture review being the detailed design source.

7. **Typecheck / lint / build**:
   - `pnpm tsc --noEmit` (or equivalent) must pass, especially the new import of getModel.
   - Vitest type checks if any.
   - Run the b-flow test suite locally with both flag states.

8. **Handoff for review & execution**:
   - This plan + the architecture-review file together form the full spec.
   - After `/b-build` (or phased), run `/b-review` supplying the plan path.

## Verification

- [ ] All existing `vitest` tests in `extensions/b-flow/__tests__/` pass with `BFLOW_USE_SDK_WORKER` unset or 0 (subprocess path identical).
- [ ] New `sdk-worker.test.ts` passes 100% (mocks + synthesis correctness).
- [ ] With flag=1, a chunk queue run (via test or manual) produces a valid resultFile whose content is accepted by `verifyResult` and drives the machine to a verified state.
- [ ] No diff in XState machine definitions or chunk-queue-machine.ts (the dispatch is invisible to them).
- [ ] Audit JSON files continue to be written with the same shape and location.
- [ ] Tool scoping observable (e.g. via spy on the createAgentSession call args).
- [ ] Timeout/abort paths invoke `session.abort()` then `dispose()`.
- [ ] `tsc --noEmit` and any lint scripts clean.
- [ ] A human can flip the env var and observe (via logs or future UI) that a worker used the SDK path.

## Risks & Mitigations (refined from architecture review)

1. **SDK resource leaks across many create→dispose cycles** (highest uncertainty — depends on SDK internals).  
   **Mitigation**: Strict `finally { session.dispose() }` + `abort()` before dispose on error paths. Add a simple periodic memory/handles health check hook in the orchestrator in a follow-up. Monitor in real b-flow usage.

2. **getModel / model ID currency or provider differences** (haiku vs sonnet-4-6 etc.).  
   **Mitigation**: Fallback arrays + explicit logging of selected model. Test the selection function in isolation.

3. **Extension discovery cost or side-effects when workers load the same extensions** (including b-flow itself).  
   **Mitigation**: Acceptable for v1 (workers are narrow and short-lived). If hot, later supply a minimal resourceLoader that returns only needed tools.

4. **Test gap for "real" SDK execution** (creds, actual LLM calls).  
   **Mitigation**: Strong mock coverage of the contract + synthesis logic. Real runs are a Phase 2 concern and require the feature flag anyway.

5. **Future parallel workers would need coordination** (we deliberately chose sequential).  
   **Mitigation**: Document the decision in code + this plan. Concurrency is explicitly out of scope for Phase 1.

6. **Transitive import of `@mariozechner/pi-ai` in extension code**.  
   **Mitigation**: Already done elsewhere in the same `extensions/` tree (`completeSimple` import); the monorepo/workspace setup resolves it.

## Ralph Instructions

This is a **non-phased Ralph-ready plan** today, but it **strongly qualifies for phasing** (new core abstraction, 2 new files + 2-3 modified, core dormant feature with high future value, verification that spans unit + integration + compat matrix, risk around SDK internals).

**Preferred path**: After this plan is accepted, run `/skill:b-phase` (pointing at this plan or the subject folder). That will produce explicit, resume-safe phases with per-phase model hints, acceptance criteria, and Ralph mini-cycle instructions.

**If executing as a single unit anyway** (not recommended but possible):
1. `/b-build` (use `/b-build-hard` if any SDK API surprise appears during implementation)
2. `/b-review` — pass this plan file path as the acceptance contract
3. On any `iterate-*.md` from review: `/b-iterate` then re-review
4. **Critical**: `/b-save` (writes memory, updates draft-commit.md, stitches cross-refs, marks progress)
5. `ralph_done`

If interrupted mid-build, the plan + any partial iterate artifact + updated memory provide the resume point.

## Recommended Next Step

1. User reviews this plan (and the linked architecture-review for diagrams/code sketches).
2. If approved: `/skill:b-phase` (or directly `/b-build` if user explicitly wants single-cycle).
3. After successful build + review + save: the b-flow SDK worker is ready for broader testing and eventual default flip.

**Subject folder**: `.context/2026-05-30.b-flow-sdk-redesign/`
**Plan saved**: `plan-b-flow-sdk-redesign.md`
**Inputs used**: user invocation + 2026-05-30 research session + architecture review + full code inspection of b-flow worker layer + Pi SDK surface + prior b-flow memories.

This plan is now the canonical contract for the implementation.
