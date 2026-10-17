---
status: completed
date: 2026-10-08
subject: 2026-10-08.sql-memory-turn-hook
topics: [review, turn-memory, hook]
---

# Plan Path Review: Phase 3 OMP Hook and Package Surface

### Plan Source
- File: `.context/2026-10-08.sql-memory-turn-hook/phase-3-hook-package.md`
- Goal: load the automatic SQL memory observer as an OMP package hook
- Baseline: `feat/sql-memory-hook` after `1565608`

### Evidence Sources
- Fresh `omp --no-session` in this repo notified `turn-memory: on` at `session_start`.
- `/extensions` opened Extension Control Center. Search `turn-memory` showed one hook row, `post:turn-memory`, Active, path `hooks/post/turn-memory.ts`.
- `loadAllExtensions` returned one hook hit for that path.
- `package.json` `files` includes `hooks`. `extensions/index.ts` does not mention `turn-memory`. `hooks/post` has one TypeScript file.
- Hook registers `session_start` and `agent_end` only. No `sendUserMessage` or `sendMessage`.

### Completion Matrix

| Step | Status | Evidence |
|------|--------|----------|
| session_start and agent_end only; skip willContinue; no initiated turns | ✅ complete | `createTurnMemoryHook` in `hooks/post/turn-memory.ts`; hook tests |
| unset URL does not load pg; writer import is lazy | ✅ complete | `defaultRemember` dynamic-imports `db.js` and `remember.js` only after the URL check |
| package includes hooks and OMP lists the hook once | ✅ complete | live `/extensions` inspector path once; inventory count 1 |

### Review Axes
- Spec axis worst finding: none after the live list.
- Standards axis: parallel reviewer flagged three defects. Fixed before this verdict.
  - Extraction abort now reaches session creation. An abort during `createAgentSession` disposes the session and does not prompt. Pinned in `extensions/omp-models.test.ts`.
  - Consumed identities are built once per window selection.
  - `turnMemoryPool` reuses one lazy getter per URL. Pinned in `hook.test.ts`.
- Cross-axis ranking: none.
- Standards pass: reviewer `Phase3Standards`, then the three fixes and a re-run of the focused tests.

### Guardrails Verdict
- Contract: durable, version 2
- Status: pass
- Gates: unit pass, functional skipped, lint skipped, patch pass, global ratchet pass, complexity pass
- Coverage 89.4 versus baseline 84. The runner proposed a baseline rewrite; this review did not apply it.

### Documentation Impact
- No new documentation impact. Phase 4 already documents the opt-out hook.

### How-to Impact
- No new how-to impact. `docs/howto/toggle-turn-memory.md` covers the off switch.

### Recommended Next Step
`/b-save` → `/b-commit`, then `close-verified` for the subject.
