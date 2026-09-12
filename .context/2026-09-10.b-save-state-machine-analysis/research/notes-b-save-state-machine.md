# Rolling notes: b-save state-machine analysis

### Canonical surfaces and prior work

Files examined:
- `skills/b-save/SKILL.md`
- `prompts/b-save.md`
- `skills/_shared/subject-resolution.md`
- `.context/workflow/current-session.json`
- `.context/memory/deterministic-bsave-2026-08-26.md`
- `.context/memory/deterministic-bsave-2026-08-27.md`

Findings:
- `skills/b-save/SKILL.md` is the compact contract; `prompts/b-save.md` contains the operative detail. Both enumerate twelve responsibilities and must remain synchronized.
- The current `/b-save` is prompt-driven: the LLM discovers state, judges completion, writes files, and invokes optional memory tools directly.
- Existing `/b-save-improved` is material prior art, not a blank slate: deterministic preflight gathers state, a scribe and auditor supply judgment, deterministic apply performs writes, and native `retain`/`learn` remains a mainline-agent action.
- Existing prior work also exposes hazards relevant to a state machine: stale `current-session.json`, path containment through ancestor symlinks, slug validation, index idempotency, and conservative loose-artifact selection.
- The requested analysis should therefore evaluate the canonical twelve-step workflow independently, while comparing each boundary to `/b-save-improved` rather than assuming its split is correct.

Questions raised:
- Is the target a replacement for both `/b-save` and `/b-save-improved`, or a new design whose migration is decided later?
- Should LLM judgments be emitted as explicit proposals that deterministic transitions validate, rather than granting the model direct mutation authority?
- Which non-blocking warnings and optional integrations belong inside the core state machine versus post-commit effects?

### Existing deterministic split

Files examined:
- `skills/b-save-improved/SKILL.md`
- `skills/b-save-improved/scripts/save-preflight.ts`
- `skills/b-save-improved/scripts/save-apply.ts`
- `extensions/b-save-improved/index.ts`
- `.context/2026-08-26.deterministic-bsave/plan-bsave-improved-parity.md`
- `.context/2026-08-26.deterministic-bsave/review-bsave-improved-parity.md`

Findings:
- Existing code classifies steps 1, 2, 4, 7, 9, and 12 as primarily deterministic; steps 3 and 5 use a no-tools scribe; steps 6, 10, and 11 use an evidence-seeking auditor; step 8 is a deterministic routing decision followed by a mainline tool call using model-drafted facts.
- Deterministic preflight emits facts rather than conclusions: subject candidates, session-staleness reasons, open backlog items, spec/phase/iterate metadata, phase-table drift, loose artifacts, memory backend, and missing user goals.
- Deterministic apply validates paths and slugs, then performs idempotent memory, index, cross-reference, backlog, status, table, subject-index, and artifact-consolidation mutations.
- Prior parity work proved that deterministic mechanics alone do not preserve record quality: the model-facing digest must retain the user's goal and verification activity, while apply must carry auditor evidence into durable artifacts.
- The current split is a useful baseline, not the answer. Several nominally LLM-owned decisions can become rules if their evidence contract is made explicit; several nominally deterministic transitions still need user gates when evidence is ambiguous.

### OMP-first SDK verification

Sources examined:
- <https://omp.sh/docs/sdk>
- <https://omp.sh/docs/memory>
- <https://omp.sh/docs/extension-authoring>
- `can1357/oh-my-pi` source at commit `3b3a6dc9bbd85102ce19d0b1c11bf6870915f6ec`
- `research/sources-omp-sdk.md`

Findings:
- OMP-first development must import `@oh-my-pi/pi-coding-agent`. The earlier upstream-Pi SDK inspection is not authoritative for this design.
- An OMP extension receives `ctx.memory?: MemoryRuntimeContext`, wired to the current session. Its public `status/search/save` contract is the correct deterministic state-machine boundary.
- `ctx.memory.save()` works directly for local memory (writes normalized lessons to `learned.md`) and Mnemopi (writes scoped structured memory).
- The Hindsight backend does not implement optional `MemoryBackend.save()` at this revision, so `ctx.memory.save()` returns `stored: 0`. Hindsight persistence is currently available through the model-facing `retain` tool and internal session state only.
- `ctx.invokeTool` is not a general tool dispatcher; it exists only for same-tool native delegation. `createAgentSession()` can constrain tools but still makes delivery model-mediated.
- Recommended OMP-first architecture: standardize Step 8 on `ctx.memory.status()/save()` and make Hindsight save support an SDK prerequisite. Otherwise Hindsight must remain an explicit unsupported or non-deterministic fallback state.
- Architecture Q&A outcome (superseded during Phase 5): the non-deterministic Hindsight nested-agent fallback was **rejected** — rule 8 reports Hindsight save as `unsupported` (see `experiments/hindsight-guarded-retain`), matching the locked decision that Hindsight is unsupported on OMP 18.1.17. The validate-observed-result / retry-once / report-without-invalidating behavior is retained for the supported backends (local, Mnemopi).

### LLM fallback guardrails

- The user's canonical pattern is deterministic attempt → typed `NeedsJudgmentError` → bounded `sdk.llmCall` → deterministic validation/handling. Arbitrary exceptions do not enter the model path.
- OMP restricted sessions support an exact built-in whitelist and disable MCP/discovered extras. Classifier/scribe/auditor roles get no tools; Hindsight delivery gets one guarded retain capability.
- Ambient skills, rules, context files, templates, commands, extensions, MCP, LSP, and IRC are explicitly disabled for role sessions.
- Evidence is bounded, secret-redacted untrusted data identified by stable IDs. Strict schemas, citation checks, and snapshot hashes fail closed on prompt injection or drift.
- Hindsight delivery must not rely on post-execution argument comparison: native retain queues during execution. Give the model only an opaque delivery token and require a trusted pre-execution gate to bind it to the validated facts; if the SDK cannot enforce that, record a failed/unsupported effect.
- Retry once from the original sanitized snapshot; never feed prior model prose into the retry.
