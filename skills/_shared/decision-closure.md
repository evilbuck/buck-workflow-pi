# Decision Closure Protocol

Use this protocol when a decision may materially affect safety, reversibility, scope, or later execution. This file is the canonical schema; integrating skills load it by filename and instantiate it rather than copying or redefining its fields.

## When closure applies

A closure check is REQUIRED when work includes any of these triggers:

- A change that is hard to reverse.
- A trust-boundary change.
- Data-loss, migration, or recovery risk.
- An accessibility impact.
- Scope that remains materially unresolved.
- A new dependency or abstraction.
- A broad refactor.

A trigger requires checking whether the decision is closed; it does not automatically require interviewing the user. Existing evidence and confirmed decisions may already settle it.

## Low-risk path

Routine, reversible, well-specified work with clear evidence stays lightweight. Record that evidence and proceed without a closure section, extra questions, or an assumptions ledger. Do not manufacture uncertainty to fill this schema.

## Closure-ready record

When triggered, one additive, body-based closeout section records:

1. **Selected course** — the chosen direction and material trade-offs.
2. **Evidence** — repository facts, tests, user decisions, or other support for the choice.
3. **Assumptions** — stable IDs, statuses, blocking state, and evidence or a named validation path for each unresolved assumption.
4. **Material risks** — each material failure mode, its impact, mitigation, and rollback or fallback.
5. **Excluded scope** — work intentionally not included.
6. **Next action** — one bounded action that can proceed under the recorded decision.

Closure is not ready while a blocking assumption is unresolved, or while a material rollback/fallback claim lacks a validation path. Do not add mandatory frontmatter fields or require a runtime serializer change; the record is additive prose in the artifact body.

## Assumption ledger fields

Use these fields for each assumption:

| Field | Rule |
|---|---|
| `id` | Unique for each assumption within the artifact; use `A-<n>` (for example `A-1`). Keep IDs stable across references and never renumber an ID after another section refers to it. |
| `statement` | One falsifiable or decision-relevant assumption. |
| `status` | Exactly `validated`, `deferred`, or `invalidated`. |
| `blocking` | Boolean. `true` means dependent execution cannot safely proceed until resolved. |
| `evidence` | Evidence supporting a validated or invalidated result; unresolved items instead name a concrete validation path. |
| `validation_path` | Required for every unresolved assumption (`deferred` or otherwise not yet evidenced); identify the check and where/when it will occur. |

An assumption is unresolved until evidence establishes its outcome. Closure is not ready if any unresolved assumption has `blocking: true`. A non-blocking unresolved assumption may remain deferred only with its validation path recorded.

## Material-risk fields

For every material risk, state:

- `failure_mode`: what can go wrong.
- `impact`: the consequential outcome.
- `mitigation`: how likelihood or impact is reduced.
- `rollback_or_fallback`: the recovery route if the risk occurs.
- `validation_path`: how the rollback or fallback is shown to work or remain available.

Where a trust boundary changes, explicitly cover the affected boundary and its failure consequence. Where rollback or recovery matters, name the specific recovery behavior and its validation path; a bare claim that rollback is possible is insufficient. The path can be an existing test, a reproducible check, or a named phase/action, but must be concrete enough to perform.

## Confirming a changed problem framing

If user answers or repository evidence contradict the stated problem, surface the mismatch before redirecting work. Obtain explicit user confirmation of the replacement framing. Record both the prior framing and confirmed replacement, plus the confirming evidence. Never silently substitute a different problem.

## Calibrating pressure

Match questioning pressure to materiality. Keep reversible local work light. For triggered work, probe unresolved decisions and weak evidence in proportion to their consequences; do not re-litigate evidence or decisions already closed. Light Grill remains discretionary and must not become a required interview.

## Hard-mode minimal-change sequence

For a proposed dependency, abstraction, or broad refactor, hard-mode build evaluates this sequence and stops at the first option that safely satisfies the plan:

1. Confirm the change is needed.
2. Reuse a local pattern.
3. Use a platform-native capability.
4. Use a package already present in the project.
5. Minimize the patch.
6. Introduce a new abstraction only if earlier options are insufficient.

Do not reopen a settled plan decision without current contradictory evidence. If new evidence changes the problem itself, return to planning for explicit confirmation rather than silently redirecting implementation.

## Rules for integrating skills

Load this file by filename wherever a material-decision contract is needed. Do not copy its schema into a consumer skill; refer to the relevant headings and instantiate the fields in that skill's own artifact or closeout.

- `b-grill`, `b-grill-me`, `b-grill-auto`, and `b-grill-with-docs` produce one closeout section using this schema when triggered. Preserve each skill's existing mode, metadata, and Light Grill behavior.
- `b-plan` may synthesize the assumption ledger and risk entries when an upstream closeout is absent; low-risk plans retain their existing shape.
- `b-phase` assigns each deferred or blocking assumption ID to exactly one earliest-capable phase. Blocking validation belongs in that phase's acceptance criteria and dependencies when later work cannot safely proceed.
- `b-build` hard mode applies the minimal-change sequence and preserves settled decisions absent current contradictory evidence.
- `b-review` checks resolution evidence for blocking assumptions and validation evidence for material rollback/fallback claims. It reviews implementation against the accepted plan, not the plan's quality. Unresolved in-plan blockers are defects; non-blocking deferred items are warnings; newly discovered scope follows the existing out-of-plan route.
