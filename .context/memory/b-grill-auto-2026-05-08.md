---
date: 2026-05-08
domains: [tooling, skills, extension, rpc, typescript]
topics: [b-grill-auto, pi-rpc, openai-codex-gpt-5.4, model-orchestration, ts-extension, rpc-harness, command-registration]
subject: 2026-05-08.b-grill-auto
artifacts: [research-b-grill-auto-review.md, plan-b-grill-auto-extension.md, draft-commit.md]
related: [b-present-skill-2026-05-07.md, b-phase-model-hints-2026-05-02.md]
priority: high
status: active
---

# Session: 2026-05-08 - b-grill-auto

## Context
- Goal: create and review a new `b-grill-auto` skill that mirrors `b-grill-me` decision analysis but routes answers through a different Pi model over RPC.
- Current repo already uses model-routing ideas in buck workflow docs and extension code.

## Decisions Made
- Created `skills/b-grill-auto/SKILL.md` and `skills/b-grill-auto/grill.py` as a prototype implementation.
- Scoped the RPC default model for `b-grill-auto` only to `openai-codex/gpt-5.4`.
- Verified `openai-codex/gpt-5.4` exists in Pi's current model registry on this machine.
- Concluded that a TypeScript extension is likely a better long-term fit than a skill if dual-model orchestration becomes first-class.

## Implementation Notes
- Key files modified:
  - `skills/b-grill-auto/SKILL.md`
  - `skills/b-grill-auto/grill.py`
- Helper script now supports `provider/model` combined syntax in CLI args.
- Review found several gaps:
  - skill docs can overpromise runtime behavior
  - extension likely better than skill for orchestration, UI, and persistence
  - RPC answer model should probably get a small structured harness

## Next Steps
- [x] Implemented `b-grill-auto` as TypeScript extension with `/b-grill-auto` command.
- [ ] Test `/b-grill-auto` in live Pi session.
- [ ] Run `/b-review` for validation.

## Implementation (2026-05-08 build)

### Files Created
- `extensions/b-grill-auto/types.ts` — Shared interfaces: GrillConfig, GrillQuestion, DecisionDomain, AnswererResponse, GrillSessionState, etc.
- `extensions/b-grill-auto/rpc-client.ts` — `GrillRpcClient` class: spawns `pi --mode rpc --no-tools --no-session --provider X --model Y`, JSONL protocol, correct `agent_end` event parsing
- `extensions/b-grill-auto/harness.ts` — Answerer system prompt template, user prompt builder with plan+question+priorQA context, JSON response parser with 3-tier fallback (direct parse → code fence → any JSON → raw text)
- `extensions/b-grill-auto/grill-state.ts` — Session state management: init/addQuestion/recordAnswer/getPriorQASummary/assessBoundaries, writes `grill-session.json` to `.context/workflow/` and `grill-auto-session-*.md` to subject folder
- `extensions/b-grill-auto/index.ts` — Main extension: registers `/b-grill-auto` command, orchestrator loop via `sendUserMessage` + `agent_end` interceptor, status UI, auto-detects plan from `.context/` if no path provided

### Files Modified
- `extensions/index.ts` — Added `import { wire as wireGrillAuto }` and `wireGrillAuto(pi)` call
- `skills/b-grill-auto/SKILL.md` — Added note at top pointing users to `/b-grill-auto` extension for runtime behavior

### Architecture Decisions
- **Orchestrator = current session model** via `pi.sendUserMessage` (not a second RPC subprocess)
- **Answerer = RPC subprocess** with `--no-tools --no-session`
- **Default answerer model**: `openai-codex/gpt-5.4`
- **Output format**: orchestrator outputs `GRILL_QUESTION: <q> | type: <type> | domain: <domain>`, answerer outputs JSON
- **Single active session**: no concurrent grilling
- **Status UI**: `ctx.ui.setStatus("grill", "🔥 Q5/20 — N divergence(s)")`

### Key Design Notes
- RPC event parsing correctly extracts from `agent_end.message.content[]` (not streaming deltas)
- 3-tier JSON parsing fallback handles models that don't follow strict JSON output
- Orchestrator prompt instructs model to generate one question at a time with explicit format
- Session auto-detects plan from `.context/` subject folders if no `@file` arg provided
- Boundary assessment at threshold: analyzes domains to recommend phase splits
- All TypeScript compiles cleanly with `tsc --noEmit`
