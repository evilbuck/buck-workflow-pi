# b-save State Machine Q&A

_Session: 2026-09-10_

_Source research: `.context/2026-09-10.b-save-state-machine-analysis/research-b-save-state-machine.md`_

## Architecture

`/b-save` currently defines twelve prompt-executed responsibilities across session discovery, subject resolution, durable memory, cross-references, backlog and artifact statuses, indexes, and optional memory integrations.

The candidate state-machine boundary separates deterministic observation, bounded semantic proposals, deterministic validation and apply, and isolated external effects. Existing `/b-save-improved` implements an earlier version of this split through preflight, scribe, auditor, apply, and a mainline `retain`/`learn` handoff. This discussion reassesses each responsibility rather than assuming that split is final.

Decisions are recorded incrementally in the Q&A entries below as they are finalized.

**Finalized decision:** `.context/workflow/current-session.json` is advisory evidence only. Deterministic preflight validates and reports it, while invocation arguments and the current filesystem state remain authoritative.

**Finalized decision (Step 2):** Subject resolution precedence is: an explicit subject, then exactly one eligible active/draft subject, then user choice when multiple qualify, then a dated branch-derived subject when none qualify. Loose artifacts move only with explicit or session-manifest provenance. Uncertain files are staged for review rather than moved.

**Finalized decision (Step 3):** Deterministic code owns memory paths, invariant metadata, schema, merge, and rendering. The LLM proposes semantic content only: goal, narrative, decisions, rationale, risks, leftovers, tags, priority, summary, and retain facts. Shipping and verification claims require traceable snapshot evidence. Valid drafts auto-apply only when warning-free; any validation, evidence, or merge ambiguity pauses for user review.

**Finalized decision (Step 4):** Cross-references are computed only from explicit frontmatter relationships and recorded provenance, never from subject co-location or LLM inference.

**Finalized decision (Step 5):** An LLM proposes backlog semantics with cited session evidence; deterministic code validates and performs archive/create mechanics. Cited explicit completions and explicit user-requested new/deferred items apply automatically. Inferred completions and inferred new items enter user review and never mutate silently.

**Finalized decision (Step 6):** Deterministic completion is allowed only when all canonical spec criteria are checked and required evidence references resolve; every other spec is audited by an LLM through the SDK. The SDK audit is binary complete/incomplete, not uncertain; complete requires traceable evidence, and incomplete identifies unmet criteria.

**Finalized decision (Step 7):** `.context/memory/index.md` has one canonical entry per memory filename. Deterministic upsert creates or replaces exactly one canonical entry for a given filename, moves it to the top, and preserves unrelated index content, so repeated saves never add duplicate entries.

**Finalized decision (Step 8):** After durable apply, the state machine delivers validated Step 3 semantic facts through OMP's public memory boundaries. `ctx.memory.save` is deterministic for `local` and `mnemopi`; Hindsight lacks `MemoryBackend.save` at the researched revision and returns `stored: 0`. For Hindsight, the SDK-agent fallback is allowed only behind a trusted pre-execution retain capability: the model receives an opaque delivery token, and trusted code maps it to the already validated facts before native `retain` runs. Raw built-in `retain` and post-execution payload checks are insufficient. The exact guarded-capability integration is a pre-implementation feasibility prerequisite; if unavailable, the effect fails closed as unsupported/failed. Delivery retries once after a valid gate exists; a second external-effect failure does not invalidate the durable checkpoint.

**Finalized decision (Step 9):** Non-OMP memory re-indexing is an LLM-owned, best-effort external-effect state. The state machine supplies the configured memory-skill path and the durable memory location; an agent loads and follows that skill, and failure is reported without invalidating the save. Note that `prompts/b-save.md` currently contains a contradictory skip condition (`not in OMP`) that must be corrected during any later implementation.

**Finalized decision (Step 10):** Deterministic completion applies only when canonical acceptance criteria are consistently checked and required evidence references resolve; otherwise an SDK LLM auditor adjudicates complete/incomplete. For phase/overview drift, the LLM interprets the detailed phase file, the overview, the criteria, and the review/memory evidence, then deterministic apply synchronizes both representations. `b-phase` calls the overview a lightweight index while the discrete phase file carries the detail; under drift, neither raw status nor checkboxes alone are authoritative.

**Finalized decision (Step 11):** An iterate belongs to the save only through explicit provenance: subject metadata, plan/addresses references, or session-manifest provenance; changed-path overlap is only an audit trigger. Deterministic completion is allowed when canonical criteria are consistently checked and required evidence resolves; non-mechanical or conflicting cases route to the binary SDK LLM auditor. Deterministic apply owns status, memory artifact inclusion, and plan iterations links.

**Finalized decision (Step 12):** The exact canonical User Goal heading and Technical chore waiver syntax are checked deterministically first; when exact matching fails, an SDK LLM fallback returns a typed present/waived/missing classification with quoted artifact evidence; deterministic validation converts that classification into the non-blocking warning outcome.

**Finalized decision (cross-cutting):** The state machine uses a hybrid persisted run manifest containing run identity, the selected subject, input hashes, validated proposals, user decisions, apply progress, and external-effect outcomes. Cheap observations may be recomputed. Every read input is content-hashed. Any drift before apply invalidates dependent proposals and re-runs affected observation and judgment states.

**Finalized decision (cross-cutting):** Deterministic mutation uses a journaled recoverable apply with whole-patch validation, before-image/write-ahead state, and per-file atomic replacement. Model work is grouped by role: scribe for memory, backlog semantics, and retain facts; evidence auditor for specs, phases, and iterates; goal classifier only on the Step 12 fallback; and the non-OMP re-index agent only for Step 9.

**Finalized decision (cross-cutting):** The state machine is OMP-first. It is designed against `@oh-my-pi/pi-coding-agent` and the OMP `ExtensionContext`/SDK as the primary target; harness-neutral portability is a later adapter concern, not the first implementation constraint.

**Finalized decision (cross-cutting):** Only OMP's shipped public API interfaces may be used. Modifying, patching, forking, or requiring upstream changes to OMP source is a hard non-option. The Hindsight proof must succeed through existing APIs; otherwise Hindsight delivery is explicitly unsupported/failed rather than weakening the security boundary.

**Finalized decision (cross-cutting):** Any condition that would otherwise pause for user review on machine-uncertainty grounds — evidence ambiguity, semantic ambiguity, merge ambiguity, inferred relationships, or ambiguous subject/artifact ownership where policy permits — routes to a bounded SDK LLM fallback that must return a closed decision with cited evidence, instead of pausing. Deterministic validation still owns closed schemas and rejects unsupported claims. Invalid fallback output retries under the established model-failure policy, then enters a resumable failed-model state rather than silently applying. Policy-required user decisions (choosing among multiple eligible subjects, approving inferred backlog completion and new items) are preserved unless the user explicitly supersedes them. Advisory warnings from optional external effects and Step 12 remain non-blocking.

**Finalized decision (cross-cutting):** Migration replaces `/b-save` with the new state-machine engine and retires `/b-save-improved` only after parity is demonstrated.

**Finalized decision (cross-cutting):** A model role retries once on failure, then enters a resumable failed-model state rather than silently applying; an explicitly configured model remains authoritative.

**Finalized decision (cross-cutting):** The core control-flow pattern is deterministic-first: try deterministic work; on failure call `sdk.llmCall(buildPromptFromError(e))`; then `deterministicHandle(modelOutput)`. Only typed expected `needs_judgment`/adjudication failures enter the LLM branch — stale-snapshot, path/containment, schema, I/O, and programmer errors remain deterministic failures. The LLM result is a typed proposal, and deterministic validation/handling owns the transition.

**Finalized decision (cross-cutting):** Every SDK LLM fallback is capability-constrained against prompt injection. Scribe, auditor, and goal-classifier roles use `restrictToolNames: true` with no tools, empty skills/rules/contextFiles/promptTemplates/slashCommands, disabled extension discovery, MCP, LSP, and IRC, a caller-owned minimal system prompt, and a strict output schema. `buildPromptFromError` maps typed error codes and bounded evidence IDs; repository/session content remains secret-redacted untrusted data. Hindsight delivery may expose one guarded retain capability only: the model receives an opaque delivery token, and trusted code binds it to the already validated facts before native `retain` executes. Raw built-in `retain` and post-execution argument checks are insufficient. The exact guarded-capability integration must be proven against the OMP SDK before implementation; if it cannot be enforced, the effect fails closed as unsupported/failed. Retries restart from the original sanitized snapshot.

---

## Q: Step 1 — what authority should .context/workflow/current-session.json have?

**Decision: Advisory evidence.** Parse and schema-check it deterministically, emit stale reasons, and never use it alone to select the subject or session. Invocation arguments and the current filesystem snapshot are authoritative. This avoids resuming the wrong work when the file points to an older completed session, while preserving useful runtime metadata.

---

## Q: Step 2 — how should subject resolution and loose-artifact consolidation work?

**Decision:** Resolve subjects by explicit input first, then a unique eligible active/draft subject. Ask the user when several qualify; create a dated branch-derived subject only when none qualify. Move loose artifacts only when structured provenance ties them to the selected subject. Stage uncertain files for review; do not use an allowlist sweep or an LLM ownership guess as authority.

---

## Q: Step 3 — what should the LLM author, how should claims be grounded, and when should the draft apply?

**Decision:** The LLM owns semantic content only: goal, narrative, decisions, rationale, risks, leftovers, tags, priority, summary, and retain facts. Deterministic code owns paths, dates, subject, artifact links, allowed statuses, schema validation, merging, and rendering. Every shipping or verification claim must cite observed snapshot evidence; unsupported claims fail validation. A clean draft applies automatically, but warnings or evidence/merge ambiguity enter a user-review state.

---

## Q: Step 4 — which plan/spec files should receive the new memory reference?

**Decision: Explicit relationships only.** Deterministic code follows plan/spec frontmatter and recorded artifact provenance, computes safe relative paths, and unions references idempotently. Subject co-location alone does not imply a relationship. Missing relationships are staged for review rather than guessed by an LLM.

---

## Q: Step 5 — how should backlog completions and new/deferred items be handled?

**Decision:** The LLM extracts candidate backlog changes and cites the session statement supporting each one. Deterministic validation accepts cited explicit completions and explicit user requests, then performs idempotent archive/create mechanics. Inferred completions and inferred follow-ups enter user review; they never archive or create items silently.

---

## Q: Step 6 — when does a spec complete, and how is uncertainty handled?

**Decision:** Deterministic code may complete a spec only when every canonical criterion is checked and all required verification references resolve. Every non-mechanical case routes to an LLM auditor through the SDK. The audit contract is binary: `complete` or `incomplete`; it may not return `uncertain`. A `complete` verdict must carry traceable evidence, while `incomplete` identifies the unmet criteria. Invalid or unsupported model output is a technical validation failure, not a completion verdict.

---

## Q: Step 7 — how should reruns update .context/memory/index.md?

**Decision: Canonical upsert at top.** The memory filename is the stable key. Deterministic apply creates or replaces exactly one canonical entry, moves it to the top, and preserves unrelated index content. Repeated saves never add duplicate entries.

---

## Q: Step 8 — who executes native-memory delivery, and what happens on failure?

**Decision:** After the durable .context apply, the state machine delivers the validated LLM-drafted facts directly through the OMP `ExtensionContext.memory` (`MemoryRuntimeContext`) public API. `ctx.memory.save` works deterministically for the `local` and `mnemopi` backends. Backend and tool routing are deterministic. Delivery retries once; a second failure does not invalidate the durable checkpoint and is reported as a visible failed external effect.

`ctx.memory` is wired into every extension context and is the correct public direct API. `ctx.memory.save` works for local and Mnemopi. Hindsight lacks `MemoryBackend.save` at the researched revision, so `ctx.memory.save` returns `stored: 0`. The chosen Hindsight SDK-agent fallback is conditional on a trusted pre-execution retain capability: the model receives only an opaque delivery token, and trusted code expands it to the already validated facts before native `retain` runs. Raw restricted built-in `retain` is not sufficient because it leaves payload control with the model. A non-error `tool_execution_end` confirms delivery only. If the SDK cannot provide the gate, record the effect as unsupported/failed; never queue model-altered facts. This remains an LLM-mediated best-effort external effect, not deterministic. `ctx.invokeTool` is same-tool-only and is not itself a delivery path. Source: `.context/2026-09-10.b-save-state-machine-analysis/research/sources-omp-sdk.md` (can1357/oh-my-pi @ `3b3a6dc9`).

---

## Q: Step 9 — how should non-OMP memory re-indexing fit the state machine?

**Decision: LLM interprets the configured skill.** After durable apply, a bounded agent state loads the configured non-OMP memory skill and follows its indexing protocol. This effect is intentionally non-deterministic and best-effort; success, failure, and skip are recorded explicitly, and failure does not invalidate the durable save. The current prompt's instruction to skip when 'not in OMP' contradicts the non-OMP heading and must be corrected later.

---

## Q: Step 10 — when may phases complete, and how should phase/overview drift resolve?

**Decision:** A phase completes deterministically only when its canonical acceptance criteria are consistently checked and required evidence references resolve. Any conflicting, duplicated, incomplete, or non-mechanical criteria route to a binary SDK LLM audit. When the phase file and overview disagree, the auditor interprets the detailed phase record, overview, and review/memory evidence, then deterministic apply writes the verdict to the phase frontmatter and repairs the overview projection. Research basis: `skills/b-phase/SKILL.md` describes the overview as a lightweight index and phase files as the detailed record; `.context/2026-07-26.b-init-guardrails/phase-4-check-skill.md` demonstrates why raw checkbox parsing is insufficient by containing duplicate unchecked/checked criteria in an otherwise completed phase.

---

## Q: Step 11 — how should iterate artifacts be scoped and completed?

**Decision:** Explicit provenance establishes scope: subject metadata, plan/addresses references, or the session manifest. Changed-file overlap may trigger review but never establishes ownership by itself. An iterate completes deterministically only when canonical criteria are consistently checked and required evidence resolves; otherwise the binary SDK LLM auditor decides complete/incomplete with evidence. Deterministic apply updates status, includes completed iterates in memory artifacts, and stitches the plan's `iterations:` references.

---

## Q: Step 12 — how should User Goal and technical-chore waivers be recognized?

**Decision:** Use exact canonical syntax as the deterministic fast path. If it does not match, an SDK LLM fallback classifies the artifact as present, waived, or missing and quotes the supporting text. Deterministic validation accepts only that closed result shape and emits the final non-blocking warning. The transition from the validated classification is deterministic even though fallback interpretation uses an LLM.
---

## Q: How should the state machine persist and protect in-flight decisions?

**Decision:** Use a hybrid run manifest. Persist the run ID, selected subject, snapshot hashes, validated LLM proposals, user decisions, apply progress, and external-effect outcomes; recompute cheap observations on resume. Content-hash every input consumed by a decision. If any input changes before apply, reject the stale proposal and re-run only the dependent observation and judgment states against the new snapshot.

---

## Q: How should apply recovery and LLM work be structured?

**Decision:** Deterministic apply validates the complete patch set, records recoverable before-image/write-ahead state in the run manifest, and replaces each file atomically. A failed run resumes or rolls back from the journal instead of exposing an untracked partial checkpoint. LLM work is role-based: one scribe handles memory, backlog semantics, and retain facts; one evidence auditor handles specs, phases, and iterates; Step 12 invokes a goal classifier only after exact matching fails; Step 9 invokes a configured-skill agent only in non-OMP mode.

---

## Q: Correction — OMP-first target and Step 8 Hindsight gap

**Decision:** Two evidence-based corrections supersede earlier wording. (1) The state machine is OMP-first: it targets `@oh-my-pi/pi-coding-agent` and the OMP `ExtensionContext`/SDK; harness-neutral portability is later adapter work. (2) `ctx.memory.save` works for `local` and `mnemopi`, while Hindsight lacks `MemoryBackend.save` and returns `stored: 0`; `ctx.invokeTool` is same-tool-only. Hindsight therefore uses the SDK-agent fallback only if a trusted pre-execution capability can map an opaque delivery token to the already validated facts before native `retain` runs. Raw restricted `retain` plus `tool_execution_end` observation is not an integrity boundary. Proving this gate is a pre-implementation prerequisite; otherwise the effect fails closed as unsupported/failed. Source: `.context/2026-09-10.b-save-state-machine-analysis/research/sources-omp-sdk.md`.

---

## Q: When should a pause-for-review become a bounded SDK LLM fallback instead?

**Decision:** Machine uncertainty never pauses the machine by itself. Any condition that would otherwise stop for user review on uncertainty grounds — evidence ambiguity, semantic ambiguity, merge ambiguity, inferred relationships, or ambiguous subject/artifact ownership where policy permits — instead invokes a bounded SDK LLM fallback that must return a closed decision with cited evidence, rather than pausing. Deterministic validation still owns the closed schema and rejects unsupported claims. Invalid fallback output retries under the established model-failure policy, then enters a resumable failed-model state instead of silently applying.

This draws a hard line between policy-required user decisions and machine uncertainty. Choosing among multiple eligible subjects, approving inferred backlog completion, and approving inferred new/deferred items remain explicit user gates and are preserved unless the user's statement clearly supersedes them. Advisory warnings from optional external effects and the Step 12 goal/waiver classification remain non-blocking and are unaffected.

---

## Q: How does the state-machine engine replace `/b-save`, and what happens to `/b-save-improved`?

**Decision:** Migration replaces `/b-save` with the new state-machine engine. `/b-save-improved` is retired only after parity is demonstrated against the new engine; it remains in place until then rather than being removed up front.

---

## Q: What is the model-failure policy for a model role?

**Decision:** A model role retries once on failure, then enters a resumable failed-model state instead of silently applying an answer it could not produce. An explicitly configured model remains authoritative over any inferred default.

---

## Q: What is the core control-flow pattern for adjudication?

**Decision:** The state machine is deterministic-first. It tries deterministic work; on a failure that qualifies for adjudication it calls `sdk.llmCall(buildPromptFromError(e))`, then feeds the model output to `deterministicHandle(modelOutput)`. Only typed expected `needs_judgment`/adjudication failures enter the LLM branch: stale-snapshot, path/containment, schema, I/O, and programmer errors remain deterministic failures and never invoke the LLM. The LLM result is a typed proposal; deterministic validation and handling own the transition back into the machine.

---

## Q: How are SDK LLM fallbacks hardened against prompt injection?

**Decision:** Every SDK LLM fallback is capability-constrained. Scribe, auditor, and goal-classifier sessions use `restrictToolNames: true` with no tools. They also receive empty skills/rules/contextFiles/promptTemplates/slashCommands, disabled extension discovery, MCP, LSP, and IRC, a caller-owned minimal system prompt, and a strict output schema. Hindsight delivery is not allowed to expose raw built-in `retain`; it may expose one guarded capability only if trusted code owns the payload before execution. The exact guarded-capability integration remains an OMP SDK feasibility prerequisite.

`buildPromptFromError` maps typed error codes and bounded evidence IDs; it never concatenates arbitrary exception text or repository instructions into authority. Evidence is untrusted data: secrets are redacted, size is bounded, and citations and output are validated deterministically. Any unexpected tool call, payload mismatch, or unsupported claim fails closed. Retry restarts from the original sanitized snapshot, never from prior model output.

For Hindsight, post-execution argument comparison is not sufficient: native Hindsight `retain` queues the payload before `tool_execution_end`, so comparing arguments after the fact cannot prevent model-altered content from being stored. The guardrail therefore requires a trusted pre-execution capability gate — preferably the model receives only an opaque delivery token that a trusted `retain` wrapper/capability expands to the already validated facts and validates before delegating to native `retain`, with `tool_execution_end` confirming success only. `tool_execution_start` is emitted immediately before execute and is not a documented veto boundary, so post-event validation is not relied on for integrity. If the OMP SDK cannot provide that pre-execution gate, the effect fails closed and is recorded as unsupported/failed rather than storing model-altered content. The scribe, auditor, and goal-classifier roles remain zero-tool restricted sessions.
