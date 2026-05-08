---
status: active
date: 2026-05-08
subject: 2026-05-08.b-grill-auto
topics: [b-grill-auto, typescript-extension, rpc-harness, model-orchestration, command-registration]
research: [research-b-grill-auto-review.md]
spec:
memory: [b-grill-auto-2026-05-08.md]
---

# Plan: b-grill-auto TypeScript Extension + RPC Harness

## Goal

Convert the `b-grill-auto` prototype (SKILL.md + Python helper) into a proper TypeScript extension that registers `/b-grill-auto` as a real Pi command, spawns a separate model via Pi RPC to answer grilling questions, manages session state, and writes structured grill session files to subject folders.

This plan covers **both** backlog items: `ts-extension-b-grill-auto` and `rpc-harness-b-grill-auto`.

## Context used / assumptions

- **User-provided context**: Two backlog items with detailed requirements, architecture suggestions, and open questions.
- **Session context**: Previous session (`b-grill-auto-2026-05-08.md`) established the prototype and identified that an extension is a better fit than a skill for runtime orchestration.
- **Artifacts used**:
  - `research-b-grill-auto-review.md` — identified gaps and recommended extension migration
  - `skills/b-grill-auto/SKILL.md` — current skill docs (reference for question taxonomy, session file format, metadata schema)
  - `skills/b-grill-auto/grill.py` — prototype Python RPC client (reference for protocol handling, but has bugs per research findings)
  - `extensions/index.ts` — existing Buck workflow extension (reference for command registration, state management, plan mode patterns)
  - `extensions/tmux-window-status.ts` — reference for state machine pattern and testability
  - Pi RPC docs (`docs/rpc.md`) — JSONL protocol: `prompt`, `abort`, events (`agent_end`, `turn_end`, `message_update`)
  - Pi extension docs (`docs/extensions.md`) — `registerCommand`, `sendUserMessage`, `sendMessage`, event handlers

- **Assumptions / open questions**:
  1. **Orchestrator = current session model**: The orchestrator that generates questions will be the main Pi session (via `sendUserMessage`). The RPC subprocess is only the *answerer*. This avoids needing a second RPC subprocess for the orchestrator.
  2. **Answerer = text-only, no tools**: The RPC answer model gets `--no-tools` to keep responses concise and parseable. If tool access is needed later, it can be added as a flag.
  3. **Structured JSON output from answerer**: The harness instructs the answerer to return JSON with known fields. The orchestrator parses and extracts.
  4. **Single grill session at a time**: No concurrent grilling sessions. State is one active session.
  5. **`openai-codex/gpt-5.4` is the default answerer model**: Configurable via args.
  6. **The existing `grill.py` has event parsing bugs** (per research): The new TS extension will implement correct RPC event handling from scratch, not port the Python code.

## Scope

### In scope

1. **RPC client module** (`extensions/b-grill-auto/rpc-client.ts`)
   - Spawn Pi RPC subprocess with configurable model/provider
   - JSONL protocol: send `prompt`, receive `agent_end` with messages
   - Abort and cleanup
   - Parse `agent_end.messages[].content[]` for text, thinking
   - Timeout handling

2. **Answerer harness** (`extensions/b-grill-auto/harness.ts`)
   - System prompt template for the answerer persona
   - Structured JSON output format (`answer`, `assumptions`, `risks`, `unknowns`, `follow_up`, `halted`)
   - Harness assembly: inject plan context + question + prior Q&A summary
   - JSON response parsing with fallback

3. **Grill session state** (`extensions/b-grill-auto/grill-state.ts`)
   - Track: question count, domains, divergences, answers, resolution statuses
   - Serialize/deserialize to `.context/workflow/grill-session.json`
   - Write `grill-auto-session-*.md` to subject folders on completion

4. **Command registration** (`extensions/b-grill-auto/index.ts`)
   - Register `/b-grill-auto` command with arg parsing
   - Args: `--model <provider/id>`, `--threshold <N>`, optional plan context path
   - Kickoff: read plan, create/join subject folder, spawn RPC, send first question
   - Orchestrator loop: the main Pi session (via `sendUserMessage`) generates questions, sends each to RPC answerer, records responses
   - Status UI: `ctx.ui.setStatus` to show grill progress

5. **Extension integration** (modify `extensions/index.ts`)
   - Import and wire the new module
   - Add to the existing extension's `export default function`

6. **Keep skill as documentation reference**
   - Do NOT delete `skills/b-grill-auto/`. It remains as documentation of the question taxonomy and session file format.
   - Add a note to SKILL.md pointing to the extension for runtime behavior.

### Out of scope

- Interactive mode (user interrupts at decision points)
- Resume interrupted sessions
- Multiple concurrent grilling sessions
- Tool access for the answerer model
- Summary report generation (beyond the session file)
- Changes to `b-phase` to consume grill-auto sessions (already handles `grill-session-*.md`)

## Affected files

| File | Action | Purpose |
|------|--------|---------|
| `extensions/b-grill-auto/index.ts` | **Create** | Command registration, orchestrator loop |
| `extensions/b-grill-auto/rpc-client.ts` | **Create** | Pi RPC subprocess client |
| `extensions/b-grill-auto/harness.ts` | **Create** | Answerer system prompt + JSON parsing |
| `extensions/b-grill-auto/grill-state.ts` | **Create** | Session state management |
| `extensions/b-grill-auto/types.ts` | **Create** | Shared types |
| `extensions/index.ts` | **Modify** | Import + wire new module |
| `skills/b-grill-auto/SKILL.md` | **Modify** | Add note pointing to extension |
| `skills/b-grill-auto/grill.py` | **No change** | Keep as prototype reference |

## Architecture

```
User types: /b-grill-auto @plan.md --model openai-codex/gpt-5.4
        │
        ▼
registerCommand("b-grill-auto", handler)
        │
        ├── Parse args (model, threshold, plan path)
        ├── Read plan content from file
        ├── Create/join subject folder
        ├── Initialize grill state
        ├── Spawn RPC subprocess: pi --mode rpc --no-tools --no-session --model gpt-5.4
        │
        ▼
sendUserMessage(orchestrator prompt) → current session model generates Q1
        │
        ├── Extension intercepts assistant response (agent_end event)
        ├── Sends Q1 to RPC subprocess via harness
        ├── RPC answerer returns structured JSON
        ├── Parse response, record in state
        ├── Determine next question branch
        │
        ├── Repeat until threshold hit or no more questions
        │
        ▼
Threshold reached → boundary assessment
        │
        ├── Write grill-auto-session-*.md to subject folder
        ├── Cleanup RPC subprocess
        ├── Notify user of results
        └── Recommend /b-phase if boundaries found
```

### Two-Model Split

| Role | Model | Mechanism |
|------|-------|-----------|
| Orchestrator (question generator) | Current session model | `sendUserMessage` in extension |
| Answerer | Configurable (default: `openai-codex/gpt-5.4`) | RPC subprocess |

### Orchestrator Protocol

The orchestrator (main session) receives a prompt that instructs it to:
1. Analyze the plan and generate the next grilling question
2. Output the question in a specific format: `GRILL_QUESTION: <question> | type: <scope|constraint|...> | domain: <domain>`
3. After the answer comes back, analyze it and decide the next question
4. Track question count and domains
5. At threshold, output a boundary assessment

This is a **hybrid approach**: the extension manages state, RPC, and file I/O, while leveraging the main session's LLM for question generation (which is already good at this from `b-grill-me`).

### Orchestrator Flow (detailed)

The extension uses `pi.sendUserMessage` to send prompts to the main session model. Each prompt includes:
- The plan content
- Current grill state (questions asked, domains, divergences)
- Instructions to generate exactly one question
- A request to output in structured format

When the main model responds, the extension intercepts via `pi.on("agent_end")`, extracts the question, sends it to the RPC answerer, and loops.

**Key design decision**: The orchestrator does NOT run in its own RPC subprocess. It uses `pi.sendUserMessage` and `pi.on("agent_end")` to interact with the current session model. This avoids double subprocess management and lets the user see the grilling in real-time.

### State File

Location: `.context/workflow/grill-session.json`

```typescript
interface GrillSession {
  id: string;
  planPath: string;
  planContent: string;
  subjectFolder: string;
  answererModel: { provider: string; model: string };
  threshold: number;
  questions: GrillQuestion[];
  domains: DecisionDomain[];
  divergences: ModelDivergence[];
  status: "active" | "completed" | "aborted";
  createdAt: string;
  completedAt: string | null;
}
```

### Session Output File

Written to subject folder as `grill-auto-session-<topic>.md` on completion. Format matches existing `b-grill-me` session files for `b-phase` compatibility.

## Implementation steps

### Step 1: Create types (`extensions/b-grill-auto/types.ts`)

Define all shared interfaces:
- `GrillConfig` — command args parsed result
- `GrillSession` — session state
- `GrillQuestion` — question + answer + resolution
- `DecisionDomain` — domain tracking
- `ModelDivergence` — divergence record
- `AnswererResponse` — parsed JSON from answerer
- `RPCEvent` — typed RPC event union

### Step 2: Create RPC client (`extensions/b-grill-auto/rpc-client.ts`)

Implement `GrillRpcClient` class:
- `constructor(model, provider)` — stores config
- `start()` — spawns `pi --mode rpc --no-tools --no-session --provider X --model Y`
- `sendPrompt(message): Promise<AgentEndResult>` — sends `prompt` command, collects events until `agent_end`, returns parsed result
- `abort()` — sends `abort` command
- `close()` — kills subprocess
- Internal: JSONL reader using `StringDecoder` + buffer splitting on `\n` (not readline, per RPC docs warning)
- Internal: event accumulator for `agent_end` message collection
- Error handling: timeout, malformed JSON, process crash
- **Correct event parsing** (fixing the Python bugs):
  - Collect text from `agent_end.messages[].content[].text`
  - NOT from streaming deltas (those are for display only)
  - `agent_end` contains the full message list

### Step 3: Create answerer harness (`extensions/b-grill-auto/harness.ts`)

Implement:
- `buildSystemPrompt(): string` — returns the answerer persona prompt
- `buildUserPrompt(planContent, question, priorQA): string` — assembles the user message with context
- `parseResponse(raw: string): AnswererResponse` — parses JSON, with fallback to text extraction
  - Try `JSON.parse` first
  - If fails, try to find JSON block in markdown code fence
  - If still fails, return `{ answer: raw, assumptions: [], risks: [], unknowns: [], follow_up: null, halted: false }`

### Step 4: Create grill state module (`extensions/b-grill-auto/grill-state.ts`)

Implement:
- `initSession(config, planContent, subjectFolder): GrillSession`
- `addQuestion(session, question, type, domain): GrillSession`
- `recordAnswer(session, questionIdx, response): GrillSession` — records answer, checks for divergence
- `getDomainSummary(session): DecisionDomain[]`
- `getPriorQASummary(session, lastN): string` — condensed prior Q&A for context
- `assessBoundaries(session): BoundaryAssessment` — evaluates at threshold
- `writeSessionFile(session): void` — writes `grill-auto-session-*.md`
- `readSession(path): GrillSession | null` — reads from `.context/workflow/grill-session.json`
- `writeSessionState(session): void` — writes to `.context/workflow/grill-session.json`
- `clearSessionState(): void` — removes state file

### Step 5: Create main extension module (`extensions/b-grill-auto/index.ts`)

Implement `wire(pi: ExtensionAPI)` function (follows `wireTmuxStatus` pattern):

1. **Register command**:
   ```typescript
   pi.registerCommand("b-grill-auto", {
     description: "Auto-grill a plan using a different AI model as answerer",
     getArgumentCompletions(prefix) { /* model, threshold completions */ },
     handler: async (args, ctx) => { /* kickoff */ },
   });
   ```

2. **Command handler**:
   - Parse args: `--model`, `--threshold`, positional plan path or `@file` reference
   - Default model: `openai-codex/gpt-5.4`
   - Default threshold: 20
   - Read plan content (from arg path, or detect from `.context/` subject folder)
   - Create/join subject folder
   - Initialize session state
   - Spawn RPC client
   - Send first orchestrator prompt via `sendUserMessage`

3. **Orchestrator loop** (via `pi.on("agent_end")`):
   - Check if there's an active grill session
   - Extract the generated question from assistant response
   - Send question to RPC answerer
   - Record answer, update state
   - If below threshold: send next orchestrator prompt
   - If at threshold: run boundary assessment, write session file, cleanup, notify

4. **Cleanup**:
   - On completion: write session file, close RPC, clear state
   - On error: close RPC, write partial session, clear state
   - On session shutdown: close RPC if running

5. **Status UI**:
   - `ctx.ui.setStatus("grill", "🔥 Q5/20 — 1 divergence")` during grilling
   - Clear on completion

### Step 6: Wire into existing extension (`extensions/index.ts`)

```typescript
import { wire as wireGrillAuto } from "./b-grill-auto/index.js";

// In the export default function:
wireGrillAuto(pi);
```

### Step 7: Update skill docs (`skills/b-grill-auto/SKILL.md`)

Add a note at the top:
```markdown
> **Note**: For runtime behavior, use the `/b-grill-auto` extension command. This SKILL.md remains as documentation for the question taxonomy, session file format, and metadata schema.
```

### Step 8: Test and verify

- Start Pi, run `/b-grill-auto @.context/2026-05-08.b-grill-auto/plan-b-grill-auto-extension.md`
- Verify RPC subprocess spawns with correct model
- Verify questions are generated and sent
- Verify responses are received and parsed
- Verify session file is written on completion
- Verify cleanup (no orphan processes)
- Test error case: model not found, timeout, abort

## Verification

- [ ] `/b-grill-auto` command is registered and appears in command list
- [ ] RPC subprocess starts with `--no-tools --no-session` and correct model
- [ ] First question is generated from plan content
- [ ] Question is sent to RPC answerer via harness
- [ ] JSON response is received and parsed correctly
- [ ] Session state is persisted to `.context/workflow/grill-session.json`
- [ ] Multiple questions cycle through orchestrator loop
- [ ] At threshold, boundary assessment runs
- [ ] `grill-auto-session-*.md` is written to subject folder
- [ ] RPC subprocess is cleaned up on completion
- [ ] RPC subprocess is cleaned up on error/abort
- [ ] Status UI shows progress during grilling
- [ ] Errors (model not found, timeout) are handled gracefully

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| RPC subprocess hangs or crashes | Medium | Timeout (120s per question), abort on error, cleanup on session shutdown |
| Answerer returns malformed JSON | Medium | Fallback parser: try JSON, then code fence extraction, then raw text |
| Orchestrator (main model) doesn't follow structured output format | Medium | Use very explicit format instructions, parse with regex fallback |
| `agent_end` event shape differs from docs | Low | Test with actual Pi RPC first, handle both `messages[]` and `message` shapes |
| Two concurrent prompts to main session (grill + user) | Low | Extension checks for active grill state; user can abort with Ctrl+C |
| Model `openai-codex/gpt-5.4` not available on all machines | Medium | Configurable via args; clear error if model not found |
| Extension loading order / import issues | Low | Follow exact pattern from existing `wireTmuxStatus` |

## Recommended next step

Run **`/b-build`** for implementation. This plan is well-scoped with clear file boundaries and testable steps. No high-risk architectural unknowns — the RPC protocol is documented, the extension API patterns are established in the existing codebase, and the question taxonomy is already defined.

If preferred, run **`/skill:b-phase`** first to break this into 2-3 phases (e.g., Phase 1: RPC client + harness, Phase 2: State + command, Phase 3: Integration + testing).
