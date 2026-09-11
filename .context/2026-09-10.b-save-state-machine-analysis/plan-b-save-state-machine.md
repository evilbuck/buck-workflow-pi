---
status: active
date: 2026-09-10
subject: 2026-09-10.b-save-state-machine-analysis
topics: [b-save, b-save-improved, state-machine, deterministic-checkpoint, omp-sdk, command-migration]
research: [research-b-save-state-machine.md, research/sources-omp-sdk.md]
iterations: []
memory: [../memory/b-save-state-machine-plan-2026-09-10.md, ../memory/b-save-phase-1-boundaries-2026-09-10.md, ../memory/b-save-phase-2-snapshot-2026-09-10.md]
---

# Plan: promote the deterministic b-save state machine and preserve legacy b-save

## User Goal

Buck Workflow users run the new deterministic checkpoint as `/b-save`, while the current prompt-driven workflow remains available as `/deprecated-b-save` for compatibility and fallback.

## Goal

Replace the current OMP `/b-save-improved` prototype with a resumable, journaled state-machine engine that implements the twelve `/b-save` responsibilities under the finalized deterministic/LLM/user/effect boundaries. After parity is demonstrated, atomically move the engine to `/b-save`, rename the current prompt-driven `/b-save` surface to `/deprecated-b-save`, and remove `/b-save-improved` so the final product exposes exactly the two requested commands.

## Context used / assumptions

- User-provided context: “keep both commands, but b-save becomes deprecated-b-save and this replacement becomes b-save.”
- Session context: the completed 2026-09-10 research and architecture Q&A define all twelve responsibility boundaries, state ownership, model isolation, failure policy, persistence, and migration constraints.
- Artifacts used:
  - `research-b-save-state-machine.md`
  - `research/sources-omp-sdk.md`
  - `../discussions/b-save-state-machine.md`
  - `../2026-08-26.deterministic-bsave/plan-bsave-improved-parity.md`
  - `../memory/deterministic-bsave-2026-08-26.md`
  - `../memory/deterministic-bsave-2026-08-27.md`
- Code inspected: `extensions/b-save-improved/index.ts`, its preflight/apply scripts and tests, `extensions/omp-models.ts`, `extensions/index.ts`, `skills/b-save/SKILL.md`, command/prompt wrappers, package wiring, and guardrails.
- OMP is the first implementation target. `@oh-my-pi/pi-coding-agent` public interfaces are authoritative; a harness-neutral engine is deferred.
- The legacy prompt implementation remains cross-harness under `/deprecated-b-save`.
- The Hindsight guarded-retain feasibility result changes only the Step 8 adapter: success enables the guarded adapter; failure records Hindsight as unsupported/failed. It never weakens the integrity boundary or blocks the durable `.context` checkpoint.
- No OMP execution mode is stamped by this plan. The plan exceeds the phasing threshold; `b-phase` should split it and recompute any OMP mode/budget recommendation.

## Scope

- Preserve the current prompt-driven save contract under `/deprecated-b-save`.
- Implement an OMP-first XState v5 engine with persisted, resumable run state.
- Cover all twelve save responsibilities with deterministic fast paths, typed model adjudication, explicit policy gates, deterministic validation, and post-apply external effects.
- Hash every decision input and invalidate only dependent proposals when the snapshot changes.
- Build a recoverable, journaled `.context/**` apply with whole-patch validation and per-file atomic replacement.
- Isolate scribe, evidence-auditor, and goal-classifier SDK sessions from tools, ambient skills/rules/context, extensions, MCP, LSP, and IRC.
- Deliver validated facts directly through `ctx.memory.status()/save()` for local and Mnemopi; enable Hindsight only if the public-SDK guarded-retain proof succeeds.
- Preserve explicit user gates for ambiguous subject selection and inferred backlog changes.
- Migrate command, skill, prompt, packaging, and documentation references in one cutover after parity.

## Out of scope

- Modifying, patching, forking, or requiring changes to OMP source.
- Exposing raw `retain` to a model or accepting post-execution payload checks as an integrity boundary.
- A harness-neutral state-machine adapter in this implementation; non-OMP users retain `/deprecated-b-save`.
- Reusing or reviving the deprecated general-purpose `b-flow` runtime.
- Inferring cross-references from subject co-location or changed-path overlap.
- Silently approving inferred backlog completions or new/deferred items.
- Removing `/deprecated-b-save` after the cutover.
- Unrelated quality backlog such as the existing repository-wide complexity burn-down.

## Affected files

### New state-machine engine

- `extensions/b-save/index.ts` — command adapter, UI policy gates, progress, and terminal reporting.
- `extensions/b-save/types.ts` — versioned run-manifest, snapshot, proposal, verdict, patch, journal, and effect contracts.
- `extensions/b-save/machine.ts` — XState states, events, guards, retries, resume transitions, and terminal outcomes.
- `extensions/b-save/snapshot.ts` — subject/session discovery, provenance, path containment, evidence extraction, hashes, and dependency invalidation.
- `extensions/b-save/roles.ts` — bounded scribe, evidence-auditor, goal-classifier, and optional Hindsight-delivery sessions.
- `extensions/b-save/apply.ts` — patch composition, validation, canonical upserts, write-ahead journal, atomic replacement, recovery, and idempotency.
- `extensions/b-save/effects.ts` — `ctx.memory` and non-OMP re-index effect adapters with explicit outcomes.
- `extensions/b-save/__tests__/**` — reducer/guard, role-validation, apply-recovery, effect, integration, and command-wiring coverage.

### Shared runtime and package wiring

- `extensions/omp-models.ts` and `extensions/omp-models.test.ts` — extend the existing restricted-session helper rather than creating a second model-session convention; support caller-owned system prompts, strict output schemas, empty ambient inputs, OMP-only switches, stable role IDs, and one retry from the original snapshot.
- `extensions/index.ts` — wire the new `/b-save` extension and remove `/b-save-improved` wiring at cutover.
- `package.json`, lockfile, and TypeScript configuration if required — make the verified OMP SDK type/runtime dependency explicit without affecting the legacy prompt path.

### Command migration

- `skills/deprecated-b-save/SKILL.md`, `prompts/deprecated-b-save.md`, and `commands/deprecated-b-save.md` — preserve the current prompt-driven workflow under its new explicit legacy name.
- `skills/b-save/SKILL.md`, `prompts/b-save.md`, and `commands/b-save.md` — describe and invoke the deterministic state-machine contract.
- `skills/b-save-improved/**`, `extensions/b-save-improved/**`, `prompts/b-save-improved.md`, and `commands/b-save-improved.md` — remain available until parity passes, then are removed in the same cutover that promotes the engine.

### Living documentation and catalogs

- `AGENTS.md`, `GLOBAL_OR_PROJECT-AGENTS.md`, `README.md`, `docs/buck-workflow.md`, `docs/extension-loading.md`, and `docs/oh-my-pi.md` — update the completion flow, runtime ownership, compatibility, fallback name, and installation/loading truth table.
- Any additional live `b-save-improved` or “`/b-save` is prompt-only” references found by the final reference sweep; historical `.context/**` records and brainstorms remain unchanged.

## Implementation steps

1. **Prove the public-SDK Hindsight boundary before engine construction.** Build a bounded executable experiment against the installed/researched `@oh-my-pi/pi-coding-agent` API. Verify whether a restricted nested session can receive one caller-owned capability whose opaque token is expanded to the prevalidated fact payload before native Hindsight retain executes. Record the API surface and observed result. If no public pre-execution gate exists, lock Step 8 to the explicit `unsupported` outcome; do not expose raw `retain`, patch OMP, or defer correctness to a post-execution check.

2. **Freeze the command and compatibility contract.** Define the final public surfaces as `/b-save` (new engine) and `/deprecated-b-save` (unchanged prompt-driven fallback), with `/b-save-improved` removed only after parity. Preserve compatible engine flags (`--dry-run`, `--subject`, `--no-retain`, `--model`, and explicit inferred-completion policy) and add a stable resume selector for non-terminal runs. Headless ambiguity must return a run ID and recovery instruction rather than guessing.

3. **Define the versioned run model and state topology.** Add closed TypeScript/TypeBox contracts for run identity, selected subject, advisory session evidence, content hashes, evidence records, semantic proposals, user decisions, complete patch sets, journal progress, external-effect outcomes, and terminal errors. Persist each run under `.context/workflow/b-save/<run-id>/`; keep the manifest compact, keep before-images only as long as recovery requires, and reject unknown schema versions instead of coercing them.

4. **Replace preflight with an authoritative snapshot layer.** Migrate the proven containment, slug, status, digest, and parser logic from `save-preflight.ts` into typed functions. Resolve subject precedence exactly as researched; move loose artifacts only with explicit provenance; enumerate plans/specs/phases/iterates/backlog/index inputs; redact and bound untrusted text; hash every consumed input; and map each proposal to its input dependencies.

5. **Harden and centralize bounded semantic roles.** Extend `runOmpModelSession` so scribe, evidence auditor, and goal classifier run with no tools and no ambient skills, rules, context files, prompts, commands, extensions, MCP, LSP, or IRC. Use caller-owned system prompts, strict output schemas, bounded evidence IDs, configured model precedence, one retry from the original sanitized snapshot, and a resumable `failed_model` outcome. Models may propose semantic content and closed verdicts only; they never emit writable paths, commands, or mutations.

6. **Implement deterministic-first responsibility evaluation.** Encode the twelve contracts as deterministic rules that either return a closed result or raise a typed `NeedsJudgmentError`. Route only expected semantic uncertainty to the appropriate role, then validate citations and transitions deterministically. Preserve user decisions for multiple eligible subjects and inferred backlog changes; schema, containment, stale-snapshot, I/O, and programmer errors remain hard deterministic failures.

7. **Compose and apply one recoverable patch set.** Generate memory content, explicit cross-references, backlog archive/create deltas, spec/phase/iterate status changes, phase-overview projection repairs, canonical memory-index upserts, subject-index updates, and artifact moves from validated state. Validate the full patch before writing, recheck dependent hashes, journal before-images and per-file progress, replace files atomically, and support resume/rollback after injected mid-apply failure. Reruns must not duplicate headings, links, index entries, archive summaries, or backlog rows.

8. **Run optional effects only after durable success.** Call `ctx.memory.status()/save()` directly for local and Mnemopi and validate backend/result counts. Use the guarded Hindsight adapter only if Step 1 proves it; otherwise record `unsupported`. Retry a delivery once, record `succeeded | failed_nonblocking | unsupported | skipped`, and never invalidate the durable checkpoint. Keep non-OMP re-indexing in an isolated best-effort adapter for future harness support, but do not claim the new engine is portable in this release.

9. **Wire resumable command UX and observability.** Drive the engine from `extensions/b-save/index.ts`, persist after every meaningful transition, present policy choices through OMP UI, and return actionable headless instructions. Report selected subject, run ID, resumed/invalidated states, durable files, staged user decisions, warnings, and effect outcomes. Never collapse a failed model, failed apply, unsupported effect, or completed durable save into the same success message.

10. **Demonstrate parity before the atomic command cutover.** Run fixture and live-OMP scenarios covering all twelve responsibilities, stale-input invalidation, model retry/exhaustion, prompt-injection content, user gates, interrupted apply recovery, rerun idempotency, and supported/unsupported memory backends. Compare observable `.context` outputs against the current prompt contract and `/b-save-improved` strengths. Only after the parity checklist passes: preserve the old prompt implementation as `/deprecated-b-save`, register the engine as `/b-save`, remove `/b-save-improved`, and verify that exactly the two requested command names resolve.

11. **Migrate documentation and packaging without historical rewrites.** Update live catalogs, loading docs, bootstrap completion guidance, and command descriptions to make the engine/fallback split explicit. Run a repository reference sweep for live `b-save-improved` and prompt-only `/b-save` claims, update every current caller, leave historical `.context/**` evidence intact, and re-read the README tail after table edits to prevent truncation.

## Acceptance criteria

- [ ] `/b-save` is the deterministic OMP state-machine command; `/deprecated-b-save` preserves the prior prompt-driven workflow; `/b-save-improved` no longer resolves after parity cutover.
- [ ] The new engine covers all twelve save responsibilities and records a stable outcome for each applicable responsibility.
- [ ] Filesystem/invocation state is authoritative and `current-session.json` is reported only as validated advisory evidence.
- [ ] Every model role has a closed schema, bounded cited evidence, no mutation authority, no ambient capabilities, one retry, and a resumable failure state.
- [ ] Only typed semantic uncertainty reaches a model; containment, schema, stale-input, I/O, and programmer failures never do.
- [ ] Multiple-subject selection and inferred backlog changes remain explicit user policy gates, including in headless recovery output.
- [ ] Every decision input is hashed; pre-apply drift invalidates and reruns only dependent work.
- [ ] Apply validates one whole patch, journals before-images/progress, uses atomic file replacement, and recovers from a simulated mid-apply failure without silent partial success.
- [ ] Repeated runs produce no duplicate memory-index entries, references, headings, archive summaries, or backlog links.
- [ ] Local and Mnemopi delivery use `ctx.memory`; Hindsight uses only a proven pre-execution guarded capability or reports `unsupported`; raw model-controlled retain is impossible.
- [ ] External-effect failure is visible and non-blocking after a successful durable `.context` save.
- [ ] Prompt-injection text in repository/session evidence cannot change role instructions, tool access, writable paths, payloads, or state transitions.
- [ ] Live catalogs and docs describe the new `/b-save` ownership and `/deprecated-b-save` fallback without rewriting historical `.context/**` artifacts.
- [ ] The repository guardrails contract passes after the completed code and documentation batch.

## Verification

- Run focused Vitest suites for `extensions/b-save/**` and `extensions/omp-models.test.ts`, including pure transition tests and failure injection.
- Run integration fixtures in temporary repositories for subject selection, all twelve responsibility outputs, cross-reference/provenance rules, canonical index upsert, backlog user gates, hash invalidation, journal recovery, and rerun idempotency.
- Run the Step 1 OMP SDK experiment against the actual installed OMP revision and preserve evidence of either guarded delivery or fail-closed unsupported behavior.
- Launch a clean OMP session with the package linked, invoke `/b-save` against a disposable project, interrupt and resume one run, and inspect the resulting `.context` files and effect report.
- Invoke `/deprecated-b-save` in a clean harness session to confirm the legacy prompt contract still loads under the renamed surface.
- Verify command discovery after cutover: `/b-save` and `/deprecated-b-save` resolve; `/b-save-improved` does not.
- Run the repository’s durable guardrails contract via `/b-guardrails-check`; a failing gate blocks completion.
- Re-run live-reference searches for `b-save-improved`, `deprecated-b-save`, and prompt-only `/b-save` statements; classify historical records as intentional exceptions.

## Risks

- **Guarded Hindsight delivery may be impossible through the shipped public SDK.** The safe result is an explicit unsupported effect, not a weaker retain path.
- **The OMP-first import may break Pi package loading if wired unconditionally.** Keep the legacy prompt independent and capability-gate OMP runtime imports; verify package loading in both declared harnesses.
- **Command-name cutover can shadow or duplicate prompt/extension surfaces.** Perform it only after parity and verify loader-native discovery in fresh sessions.
- **Journal recovery can corrupt unrelated work if path or freshness checks are incomplete.** Constrain all writes to validated `.context/**` targets and abort on any changed before-image.
- **The current monolith contains proven edge-case handling that can be lost during migration.** Port behavior by invariant and fixture, not by wholesale rewrite or filename-level replacement.
- **The plan spans more than eight steps and more than five directories.** Phase it before implementation so the Hindsight proof, engine core, apply/effects, cutover, and verification remain independently reviewable.
