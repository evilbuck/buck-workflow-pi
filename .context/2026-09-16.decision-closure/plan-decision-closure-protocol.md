---
status: active
date: 2026-09-16
subject: 2026-09-16.decision-closure
topics: [decision-closure, assumptions, risk, rollback, workflow]
research: []
iterations: []
spec: null
memory: [decision-closure-plan-2026-09-16.md]
---

# Plan: Decision Closure Across Buck Workflow

## User Goal

Buck Workflow users can see and validate material decisions, assumptions, and rollback posture before autonomous execution, without slowing routine work.

## Goal

Add one Buck-native, conditional decision-closure protocol and integrate it into grilling, planning, phasing, hard-mode building, and review. Preserve Buck’s existing execution model: routine work stays fast; material or hard-to-reverse decisions become explicit and reviewable.

## Context used / assumptions

- **User-provided context:** `../../3rd_party/rubber-duck/.context/discussions/agent-agnostic-vs-buck-workflow.md`, especially the recommendation to port decision closure, material-risk structure, pivot detection, and minimal-change reasoning rather than another always-on governance layer.
- **Confirmed user goal:** the `## User Goal` above was confirmed on 2026-09-16.
- **Hard content constraints:** ported skill text must not contain the word `duck` in any casing; concepts must be rewritten for Buck rather than copied verbatim from the source project.
- **Current Buck contracts inspected:** `skills/b-grill*/SKILL.md`, `skills/b-plan/SKILL.md`, `skills/b-phase/SKILL.md`, `skills/b-build/SKILL.md`, `skills/b-review/SKILL.md`, `skills/_shared/SKILL.md`, `docs/buck-workflow.md`, the Codex bundle inventory, and the bundle synchronization rule.
- **Existing behavior to preserve:** Light Grill remains discretionary; grill decision-domain metadata continues feeding `b-phase`; `b-build-hard` remains a mode of `b-build`; `b-review` remains an implementation review rather than a plan-quality review.
- **Distribution assumption:** `skills/` remains canonical. Changed shipped skill directories must be synchronized into `plugins/buck-workflow/skills/`; `b-grill-auto` is not in the curated Codex bundle.
- **Runtime assumption:** this is a portable skill-contract change. No extension state machine or automatic grill serializer changes are required unless implementation discovers that a runtime component parses a new field. Keep new records additive and body-based so existing readers remain compatible.
- **Open questions:** none blocking. Exact prose and heading names are implementation details, provided they satisfy the behavioral contract and content constraints below.

## Scope

### In scope

- Create a shared decision-closure protocol under `skills/_shared/` and register it in the shared resource index.
- Define conditional triggers for material decisions: hard-to-reverse changes, trust-boundary changes, data-loss or migration risk, accessibility impact, unresolved scope, new dependencies, new abstractions, and broad refactors.
- Define a Buck-native closeout record covering the selected decision, evidence, trade-offs, assumptions, unresolved risks, excluded scope, rollback or fallback, and next bounded action.
- Add pressure calibration and confirmed problem-reframing behavior to all portable grill variants.
- Make `b-plan` produce a status-bearing assumptions ledger and structured material-risk entries when a trigger applies; do not force extra questioning when evidence already closes the decision.
- Make `b-phase` assign every deferred or blocking assumption to the earliest phase that can validate it and reflect blocking validation in phase acceptance criteria and dependencies.
- Make `b-build` hard mode apply a minimal-change sequence when introducing dependencies, abstractions, or broad refactors, while respecting settled plan decisions unless current evidence contradicts them.
- Make `b-review` verify that blocking assumptions are resolved and material rollback or fallback claims have current-state evidence.
- Update the methodology narrative in `docs/buck-workflow.md` from one principle to two: durable work and visible material decisions.
- Synchronize every changed shipped skill directory into the self-contained Codex plugin bundle.

### Out of scope

- A standalone `b-risk` skill.
- Global per-edit approvals, rendered-diff checkpoints, file or line caps, mandatory stub-first work, or acceptance prompts after every change.
- Runtime changes to `extensions/b-grill-auto/` unless a newly introduced machine-readable field makes them necessary.
- Changes to prompt/command wrappers; they remain thin loaders for canonical skills.
- Replacing Light Grill, `b-grill-me`, existing phasing metadata, or the current build/review lifecycle.
- Source-project terminology, branding, templates, sentences, tables, or other verbatim text in ported skills.

## Behavioral contract

### Conditional closure

Routine, reversible work with clear evidence may record no closure section. A closure check is mandatory when any material trigger applies, but the check may complete without asking the user if the evidence and prior decisions already resolve it.

A completed closure record must establish:

1. the selected course and material trade-offs;
2. evidence supporting it;
3. assumptions with stable IDs and status `validated`, `deferred`, or `invalidated`;
4. whether each unresolved assumption blocks execution and how it will be validated;
5. material failure mode, impact, mitigation, and rollback or fallback;
6. intentionally excluded scope; and
7. the next bounded action.

Closure is not ready while a blocking assumption remains unresolved or a material rollback/fallback claim has no validation path.

### Problem reframing

If answers or repository evidence show that the stated problem is wrong, the grill or plan flow must surface the mismatch and obtain explicit user confirmation before adopting the new framing. The artifact records both the prior framing and the confirmed replacement.

### Minimal-change sequence

Hard-mode build evaluates options in this order and stops when one safely satisfies the plan: confirm a change is needed, reuse a local pattern, use a platform-native capability, use an already-present package, minimize the patch, then introduce a new abstraction only when earlier options are insufficient.

## Affected files

| Path | Planned change |
|---|---|
| `skills/_shared/decision-closure.md` | New canonical conditional protocol, schemas, triggers, and cross-skill rules. |
| `skills/_shared/SKILL.md` | Register the new shared resource. |
| `skills/b-grill/SKILL.md` | Apply pressure calibration, confirmed reframing, and the closeout record to both modes. |
| `skills/b-grill-me/SKILL.md` | Apply the shared closeout contract to user-mode sessions. |
| `skills/b-grill-auto/SKILL.md` | Apply the shared closeout contract to model-assisted sessions without changing the runtime extension. |
| `skills/b-grill-with-docs/SKILL.md` | Apply the same closure contract while preserving domain-doc behavior. |
| `skills/b-plan/SKILL.md` | Add conditional closure, assumptions-ledger, and material-risk requirements to plan generation and templates. |
| `skills/b-phase/SKILL.md` | Route deferred/blocking assumptions into the earliest validating phase and its acceptance contract. |
| `skills/b-build/SKILL.md` | Add the conditional minimal-change sequence and settled-decision rule to hard mode. |
| `skills/b-review/SKILL.md` | Extend the completion matrix with assumption resolution and rollback/fallback evidence. |
| `docs/buck-workflow.md` | Document the second methodology principle and the conditional decision envelope. |
| `plugins/buck-workflow/skills/{_shared,b-grill,b-grill-me,b-grill-with-docs,b-plan,b-phase,b-build,b-review}/` | Synchronize full changed canonical directories into the Codex release bundle. |

No change is planned for `plugins/buck-workflow/skills/b-grill-auto/` because that skill is not in the curated bundle.

## Implementation steps

1. **Author the shared protocol in Buck vocabulary.** Define material triggers, closure-ready criteria, assumption IDs/statuses, material-risk fields, confirmed problem reframing, pressure calibration, and the minimal-change sequence. Update `_shared/SKILL.md` so other skills can load the protocol by filename.
2. **Wire the base and standalone grill skills.** Update `b-grill`, `b-grill-me`, `b-grill-auto`, and `b-grill-with-docs` to load the shared protocol, preserve existing question/domain/phasing metadata, and add one consistent closeout section rather than duplicating protocol prose.
3. **Integrate closure into planning.** In `b-plan`, place the closure check after draft/Light Grill evaluation and before final write. Add optional `Decision Closure`, `Assumptions Ledger`, and structured material-risk shapes to the recommended plan structure. Keep low-risk plans unchanged.
4. **Carry unresolved assumptions into phases.** In `b-phase`, map each deferred or blocking assumption ID to the earliest phase able to validate it. Add the validation to that phase’s context and acceptance criteria; create a HARD dependency when later work cannot proceed safely without resolution.
5. **Constrain hard-mode implementation choices.** In `b-build`, add a hard-mode-only decision step for new dependencies, abstractions, and broad refactors. Require current contradictory evidence before reopening a settled plan decision, and route genuine reframing back to planning instead of silently changing scope.
6. **Verify closure during review.** In `b-review`, extend the plan completion matrix to check blocking assumption resolution and evidence for material rollback/fallback claims. Treat unresolved in-plan blockers as implementation defects; report non-blocking deferred assumptions as warnings; route genuinely new scope through the existing out-of-plan path.
7. **Update the workflow narrative.** Add the visible-decisions principle and the accepted-decision-envelope flow to `docs/buck-workflow.md`. Keep the existing durable intent/record explanation and autonomous execution modes intact.
8. **Synchronize the Codex bundle.** Copy each changed canonical shipped skill directory in full to `plugins/buck-workflow/skills/`, preserving byte parity between canonical and bundled copies. Do not create a bundled `b-grill-auto` skill.
9. **Exercise the behavior and distribution contract.** Run disposable low-risk, migration-risk, reframing, phased-assumption, hard-build, and review scenarios; verify canonical/bundle parity, the forbidden-term constraint, the focused Codex plugin test, and the project’s deterministic check contract.

## Acceptance criteria

- [ ] Low-risk, reversible, well-specified plans can complete without an added closure interview or assumptions ledger.
- [ ] Every material trigger produces a closure check; it asks only when evidence or prior decisions cannot resolve the issue.
- [ ] Closure records use stable assumption IDs, allowed statuses, blocking state, and an evidence or validation path.
- [ ] Material risks name failure mode, impact, mitigation, and rollback or fallback; trust-boundary and rollback coverage are explicit where applicable.
- [ ] A discovered problem-framing mismatch cannot silently redirect work; the user confirms the replacement framing and both framings are recorded.
- [ ] All four portable grill skill variants use the shared protocol without duplicating its full schema.
- [ ] `b-plan` emits the new records only when triggered and leaves Light Grill’s discretionary behavior intact.
- [ ] `b-phase` assigns each unresolved assumption to exactly one earliest-capable phase and blocks dependent work when required.
- [ ] `b-build` hard mode evaluates the minimal-change sequence before adding a dependency or abstraction and does not reopen settled decisions without contradictory evidence.
- [ ] `b-review` distinguishes unresolved in-plan assumptions from non-blocking warnings and new out-of-plan discoveries, and requires evidence for material rollback/fallback claims.
- [ ] Ported canonical skill files and their Codex mirrors contain no case-insensitive occurrence of the word prohibited by the user.
- [ ] No complete donor sentence, table, template, or branded label is copied into the ported skills; all language is authored for Buck’s concepts and workflow boundaries.
- [ ] Canonical changed shipped skill directories and their Codex bundle copies are identical after synchronization.
- [ ] No standalone risk skill, global approval layer, or runtime extension change is introduced.
- [ ] `docs/buck-workflow.md` states both methodology principles and explains that autonomous execution stays inside an accepted decision envelope.

## Verification

1. **Forbidden-term scan:** run a case-insensitive whole-word scan across the changed canonical skill files and their Codex mirrors; expect zero matches.
2. **Originality review:** compare each changed skill section with the source discussion and source-project skill sections. Confirm behavior is preserved at the concept level while sentences, templates, labels, and structure are independently authored.
3. **Shared-reference check:** verify every integrating skill resolves `skills/_shared/decision-closure.md` and does not embed a second copy of the protocol.
4. **Bundle parity:** compare the changed canonical directories against their `plugins/buck-workflow/skills/` counterparts; expect no differences. Exclude `b-grill-auto`, which is not curated for the bundle.
5. **Focused packaging test:** run `npx vitest run scripts/codex-plugin.test.ts` from the Buck Workflow repository.
6. **Behavior scenarios in a fresh loaded session:** exercise:
   - a routine local edit that skips closure;
   - a destructive migration plan that records blocking assumptions and rollback evidence;
   - a grill answer that invalidates the original problem and requires confirmation;
   - phasing that assigns a deferred assumption to the earliest validating phase;
   - hard-mode dependency/abstraction work that stops at an earlier safe option; and
   - review of a plan with a still-blocking assumption and an unsupported rollback claim.
7. **Deterministic check contract:** if implementation changes only Markdown and `.context/**`, record the repository’s docs-only gate skip. If any runtime or test code changes, run `/b-guardrails-check` and require a passing verdict or an explicit recorded override.

## Risks

| Failure mode | Impact | Mitigation | Rollback / fallback |
|---|---|---|---|
| Conditional closure becomes routine ceremony. | Common plans slow down and Buck loses its autonomous bias. | Keep explicit trigger categories and a low-risk skip path; include a smoke scenario proving no extra interview. | Remove the integrating references while retaining the shared protocol for later refinement. |
| Skills interpret assumption status differently. | Planning, phasing, build, and review disagree about readiness. | Put IDs, statuses, blocking semantics, and closure-ready rules in one shared file; integrating skills reference rather than restate them. | Revert consumers together to the prior independent contracts. |
| Automated grill output lacks enough semantic state for a native closure record. | `b-grill-auto` sessions may rely on `b-plan` to synthesize missing closure details. | Keep the portable record additive and body-based; make `b-plan` tolerate absent upstream closure and construct its own ledger. | Remove the `b-grill-auto` integration only and plan runtime serializer support separately if demanded. |
| Source-project language leaks into Buck. | Violates the user’s explicit constraint and weakens Buck’s conceptual coherence. | Re-author from behavioral requirements, run the forbidden-term scan, and perform an originality review before acceptance. | Rewrite the affected sections; do not ship partial copied text. |
| Canonical skills and the Codex bundle drift. | Different harnesses enforce different decision contracts. | Copy full changed directories and compare them before the focused plugin test. | Restore bundle copies from canonical directories. |
| Review overreaches into plan-quality review. | `b-review` starts reopening accepted decisions instead of checking implementation. | Limit review to evidence for the plan’s own blocking assumptions and declared material rollback/fallback claims. | Remove the added matrix rows without changing the planning records. |

## Recommended next step

This plan looks large enough to benefit from phasing. Run `/skill:b-phase` against this plan to create sequential, independently verifiable phases with dependency analysis, per-phase model hints, and resume-safe execution instructions.
