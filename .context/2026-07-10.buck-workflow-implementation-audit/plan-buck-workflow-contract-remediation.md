---
status: active
date: 2026-07-10
subject: 2026-07-10.buck-workflow-implementation-audit
topics: [buck-workflow, lifecycle, review-evidence, omp, portability, artifact-contracts, wrappers, packaging, documentation]
research: [research-workflow-implementation-audit.md]
iterations: []
memory: [buck-workflow-contract-remediation-phasing-2026-07-10.md, phase-1-review-gated-phase-state-build-2026-07-10.md, phase-2-save-owned-closeout-build-2026-07-10.md]
---

# Plan: Buck Workflow Contract Remediation

## User Goal

Buck Workflow maintainers and users can execute every supported workflow path from implementation through review, durable save, explicit staging, and commit without advancing the wrong phase, losing review evidence, invoking stale OMP APIs, or relying on documentation that disagrees with the installed package.

## Goal

Reconcile the executable lifecycle, current OMP runtime contract, portable build behavior, artifact schemas, wrapper architecture, package surfaces, and documentation identified by the 2026-07-10 whole-system audit. The result must preserve Buck Workflow's three-layer architecture: canonical skills, thin harness-native wrappers, and only minimal runtime hooks.

## Context used / assumptions

- **Explicit source**: [research-workflow-implementation-audit.md](research-workflow-implementation-audit.md).
- **Detailed evidence**: [research/notes-workflow-implementation-audit.md](research/notes-workflow-implementation-audit.md).
- **Umbrella backlog**: [../backlog/items/reconcile-buck-workflow-contracts.md](../backlog/items/reconcile-buck-workflow-contracts.md).
- **Related backlog absorbed by phases**: `plan-implementation-ledger.md`, `b-commit-final-step.md`, `multi-harness-symlink-installer.md`, and `test-b-grill-auto-extension.md`.
- No grill-session artifact exists in this subject. Phase boundaries come from the audit's dependency domains and three independent architecture reviews.
- Current maintained OMP observed by the audit is 16.3.15. Runtime-facing examples must be checked against the installed maintained version during implementation rather than trusting the old 15.10-era contract.
- Clean cutover: no deprecated aliases, duplicate ledgers, fallback orchestrators, or stale wrapper policy remain after their owning phase.
- Historical `.context/**` artifacts remain historical. Runtime-facing eval examples move to a normal canonical examples directory instead of rewriting prior execution history.
- The conservative resolution for incomplete `b-auto-fix` and `b-grill-auto` surfaces is retirement from the active installable skill tree. Recommissioning either executor requires a separate explicit runner contract; a stage-only or syntax-broken surface is not retained as “available.”

## Scope

- Review-owned pass/fail evidence and save-owned state closure for phased and non-phased work.
- Deterministic next-phase backlog promotion, session-memory completion, explicit staging, and subject-safe commit drafts.
- OMP eval-cell compatibility, runtime detection, execution-mode precedence, goal audit, and subject-aware model switching.
- Repository-adaptive build/test/UI/server discovery and conditional—not unconditional—approval.
- One machine-readable artifact registry with per-kind statuses, classifiers, validation severity, indexes, and relationship checks.
- Canonical-skill/thin-wrapper restoration for `b-save`, `b-pr`, and `b-pr-review-2-issues`.
- Honest resolution of incomplete advertised entrypoints; truthful `/b-blueprint`; completed b-flow deprecation.
- Installer/package/surface inventory truth generated from code, not hand-maintained counts.
- Reference and narrative documentation regenerated only after executable contracts are stable.

## Out of scope

- Reintroducing `b-flow`, a hidden extension state machine, synthetic OMP keyword activation, or any new extension-owned orchestrator.
- Lifting the intentional `b-loop` slash-command deferral. That remains owned by `.context/backlog/items/b-loop-skill-and-mirror.md`; this plan only documents the current skill-only truth.
- Rewriting historical `.context/**` execution artifacts solely to make old examples look current.
- Publishing a release, changing unrelated product features, or adding retry/telemetry behavior not required by the audit.
- Automatically staging user changes. Staging remains an explicit user-owned gate between `/b-save` and `/b-commit`.

## Lifecycle invariants

1. `b-build` may move a phase from `pending` to `in-progress`; it may not declare the phase reviewed or completed.
2. A passing `b-review` writes one target-specific `review-pass-*.md`; an in-plan failure writes `iterate-*.md`. These outcomes are mutually exclusive for one review attempt.
3. `b-save` is the sole state closer. It consumes a valid review pass, completes the accepted unit, updates overview/plan/subject state, completes the session memory, and promotes exactly one next phase when one exists.
4. The durable closeout edge is `review → docs if required → save → stage → commit`.
5. `b-commit` resolves the explicit/current subject, inspects the staged reality, and never trusts newest-directory ordering or a stale draft blindly.
6. OMP modes remain user-toggled recommendations. Skills and docs may recommend or stamp a mode; they do not activate it.
7. Artifact statuses are scoped by artifact kind. There is no universal status vocabulary.
8. Installed surfaces may be complete and runnable, intentionally skill-only, or absent. They may not be advertised as runnable while incomplete.

## Affected files

| Area | Primary paths |
|---|---|
| Lifecycle | `skills/b-build/SKILL.md`, `skills/b-review/SKILL.md`, `skills/b-save/SKILL.md`, `skills/git-commit/SKILL.md`, `skills/_shared/subject-resolution.md`, `skills/b-phase/SKILL.md`, lifecycle prompts |
| OMP runtime | `skills/b-plan/SKILL.md`, `skills/b-loop/SKILL.md`, `skills/_shared/omp-autonomy.md`, `prompts/omp-*.md`, `docs/eval-kernel.md`, `examples/eval-kernel/**` |
| Runtime state | `extensions/index.ts`, `extensions/buck-mode.test.ts`, current-session/b-flow references |
| Portable build | `skills/b-build/SKILL.md`, `skills/b-review/SKILL.md`, `skills/_shared/project-verification-discovery.md` |
| Artifact contracts | `scripts/context-artifact-schemas.mjs`, `scripts/context-artifacts.mjs`, `scripts/context-artifacts.test.mjs`, `docs/context-artifacts.md` |
| Wrappers and surfaces | `skills/b-pr*/**`, `prompts/b-pr*.md`, `commands/b-pr*.md`, `skills/b-auto-fix/**`, `skills/b-grill-auto/**`, `skills/b-blueprint/**`, `extensions/b-flow/**` |
| Package/install | `package.json`, `scripts/install.mjs`, `scripts/install.test.mjs`, new surface-inventory helper/tests |
| Narrative policy | `README.md`, `docs/buck-workflow.md`, `docs/extension-loading.md`, `GLOBAL_OR_PROJECT-AGENTS.md`, `skills/cross-platform-pi-omp-loading/SKILL.md`, `AGENTS.md` |

## Implementation steps

1. **Review-gated state and durable pass evidence.** Keep built phases `in-progress`; prefer the single `in-progress` phase during resolution; define one `review-pass-<target-stem>.md` artifact carrying reviewed target, verdict, completion matrix, verification evidence, documentation impact, out-of-plan follow-ups, and a deterministic implementation fingerprint. Do not create a competing implementation ledger.
2. **Save-owned closeout transaction.** Move all executable save behavior into the canonical skill, thin the prompt, consume valid review-pass evidence, close phase/overview/plan/subject state deterministically, complete the current session memory, and promote/archive phase backlog items correctly.
3. **Explicit staging and commit safety.** Encode `save → stage → commit` in every generated lifecycle loop; replace newest-subject draft lookup; validate draft subject/scope against the staged diff; preserve no-auto-stage and protected-branch safeguards.
4. **OMP eval-kernel compatibility.** Update generated cells and runtime-facing examples to `completion()`, the current `agent(..., agent="task")` signature, and injected helpers; remove package metadata as runtime proof; execute a generated cell in the real maintained OMP kernel.
5. **One OMP execution-mode contract.** Centralize harness detection, mode precedence, first-turn preconditions, and goal completion audit; make `b-plan`, `b-loop`, `b-review`, and OMP observation prompts consume it while preserving the b-loop mirror deferral.
6. **Subject-aware runtime state.** Make model switching resolve the actual explicit/active subject and `in-progress` phase; remove deprecated orchestration/session ownership assumptions from shared resolution; make ambiguity a safe no-op rather than a newest-folder guess.
7. **Project-adaptive build discovery.** Discover configured unit/integration/browser tools, UI boundaries, and dev-server commands from the target repository before prescribing verification. Stop treating all JS/TS as UI and stop hardcoding Vitest, Playwright, npm, tmux, and localhost.
8. **Conditional approval and skill-side session cleanup.** Approved plan/phase inputs proceed directly; only material unresolved interface or verification tradeoffs ask the user. Remove stale plugin-auto-tracking and `current-session.json.goal` assumptions from build/review surfaces.
9. **Complete artifact registry and integrity validation.** Extend the registry substrate introduced for review-pass to every current artifact kind; fix overview classification, per-kind statuses, typed severity, generated indexes, link/backlink checks, and phase overview/file/table consistency.
10. **Restore canonical PR wrappers.** Make `b-pr` and `b-pr-review-2-issues` skills the sole policy sources, preserve required regular-file command loaders, and move the `.context/**` secret-leak exception into the canonical review-to-issues skill.
11. **Resolve misleading and legacy entrypoints.** Retire incomplete `b-auto-fix` and `b-grill-auto` from the active skill surface, preserve history outside discovery, add the promised `/b-blueprint` prompt/command mirror, remove live b-flow fallbacks, and mark retained b-flow source explicitly archival.
12. **Make installer/package/surface inventory executable truth.** Verify all declared harness surfaces in temporary homes, remove dead runtime dependencies, and generate a checked inventory that distinguishes symlinks, intentional regular wrappers, skill-only deferrals, and absent retired surfaces.
13. **Regenerate reference contracts.** Generate artifact/status tables and loading inventory from their registries; align bootstrap, cross-platform authoring guidance, b-flow history, and b-loop skill-only documentation with executable truth.
14. **Regenerate workflow narrative last.** Repair Mermaid semantics, completion boundaries, README flows, wrapper discoverability, review write-boundary wording, protected branches, and final stage/commit diagrams after every prior contract is stable.

## Dependency summary

- Steps 1 → 2 → 3 are a HARD lifecycle chain. Step 4 then HARD-depends on Step 3 because both edit `b-plan`; Step 5 HARD-depends on Step 4's current runtime contract.
- Step 6 SOFT-depends on Step 5's terminology and HARD-depends on Step 1's `in-progress` precedence.
- Step 7 HARD-depends on Step 3 because both edit lifecycle instructions in `b-build`; Step 8 HARD-depends on Steps 5–7.
- Step 9 HARD-depends on Steps 1–3 so it can register the final review-pass, phase, memory, and draft contracts once.
- Step 10 is independent and may run alongside the first lifecycle/runtime wave.
- Step 11 HARD-depends on Step 6 for the final subject/session ownership decision.
- Step 12 HARD-depends on Steps 2, 3, 10, and 11 so its inventory describes final active surfaces.
- Step 13 HARD-depends on Steps 5, 6, 8, 9, and 12.
- Step 14 HARD-depends on Steps 7 and 13 and is deliberately last.

## Audit finding coverage

| Finding | Owning phase |
|---|---|
| 1. Build completes Phase N before review | Phase 1 |
| 2. Passing review has no durable evidence | Phase 1 |
| 3. Save omits subject/plan closeout | Phase 2 |
| 4. Save→commit omits staging | Phase 3 |
| 5. Draft selection is newest/stale unsafe | Phase 3 |
| 6. Generated OMP cells use obsolete API | Phase 4 |
| 7. OMP runtime detection uses package metadata | Phases 4–5 |
| 8. `b-build` hardcodes one repository stack | Phase 7 |
| 9. `b-build` always asks for approval | Phase 8 |
| 10. Model switch selects unrelated subject | Phase 6 |
| 11. Session ownership is unclear | Phases 6 and 8 |
| 12. Artifact validation is incomplete | Phase 9 |
| 13. Phase overviews are misclassified | Phase 9 |
| 14. Status vocabularies conflict | Phases 9 and 13 |
| 15. Canonical-skill/thin-wrapper drift | Phases 2 and 10 |
| 16. OMP recommendation/audit logic is duplicated | Phase 5 |
| 17. Workflow diagrams are semantically broken | Phase 14 |
| 18. README completion claims are unsafe | Phase 14 |
| 19. Live wrappers are documented as skill-only | Phases 12–14 |
| 20. Loading counts/manifest docs are stale | Phases 12–13 |
| 21. Cross-platform guidance describes removed behavior | Phase 13 |
| 22. `b-auto-fix` advertises execution it does not perform | Phase 11 |
| 23. `b-grill-auto` delegates to an unwired command; its helper is currently syntax-invalid | Phase 11 |
| 24. `/b-blueprint` is advertised but unwired | Phase 11 |
| 25. `b-loop` is intentionally skill-only but undiscoverable in docs | Phase 13; mirror remains separate |

Lower-priority audit gaps are assigned as follows: phased backlog promotion, memory completion, and QMD optionality → Phase 2; protected-branch summaries → Phases 3/14; review write-boundary wording → Phases 1/14; OMP observation-stub wording → Phase 5; b-pr secret exception → Phase 10; b-flow fallback/dependency/banner → Phases 6/11/12; native file-discovery guidance in `b-phase` → Phase 7.

## Verification

- Two-phase lifecycle fixture: build leaves Phase 1 `in-progress`; no-argument review resolves Phase 1; pass writes one review-pass; save closes Phase 1 and promotes Phase 2; failure writes iterate only.
- Final/non-phased lifecycle fixture: pass + save completes plan/spec/subject and current memory; pre-pass save refuses completion.
- Two-subject staged-diff fixture: explicit/current subject wins over mtime; stale draft cannot override staged reality; unstaged save artifacts block before commit.
- Real OMP kernel: run one generated cell and one canonical example against the maintained runtime.
- Extension tests: multiple active subjects, explicit older phase, `in-progress` precedence, completed-newest subject, and ambiguous no-op.
- Portable-build scenarios: this repo resolves its configured Vitest/Playwright stack; a non-UI JS/TS fixture does not trigger browser/server requirements; an approved phase does not ask redundantly; an ambiguous ad-hoc task still asks.
- Artifact tests: every artifact kind classifies and validates; overview files use the overview schema; typed severity and relationship failures are deterministic.
- Wrapper/load smokes: Pi and OMP resolve thin wrappers to the same canonical skills; b-blueprint works in both mirrors; retired surfaces are absent.
- Installer tests use isolated temporary homes and verify exact per-harness surface sets, idempotency, no-clobber behavior, and generated inventory.
- Final documentation validation checks Markdown diagnostics, links, Mermaid semantics, generated-table parity, and the touched test suite.

## Risks

- **State transition split**: review owns the verdict; save owns mutation. Mitigation: the review-pass artifact is the only bridge, and save refuses checkbox/chat inference.
- **Fingerprint invalidation**: context files change after review. Mitigation: fingerprint the reviewed implementation scope separately from later durable `.context` writes and invalidate the pass on implementation changes.
- **Legacy phase formats**: single-file phased plans may not expose the same state. Mitigation: either migrate them in Phase 2 or fail explicitly; do not silently guess.
- **OMP drift**: helper APIs may move again. Mitigation: current-runtime smoke is executable and examples live outside historical context.
- **Destructive surface retirement**: external users may call incomplete skills. Mitigation: Phase 11 searches package/docs/external references before removal; any verified supported consumer forces a separate recommission plan rather than a silent deletion or shim.
- **Generated truth adoption**: hand-edited docs can drift again. Mitigation: Phase 12/13 add contract tests or generation checks, and Phase 14 consumes those outputs rather than maintaining counts manually.
