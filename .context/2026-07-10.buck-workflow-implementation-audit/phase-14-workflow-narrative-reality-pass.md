---
status: pending
phase: 14
order: 14
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: medium
model_hint: capable general model; broad semantic documentation alignment and diagram verification
buck_hint: /b-build
goal: "Make the public workflow narrative match the final executable lifecycle and installed surfaces."
files:
  - README.md
  - docs/buck-workflow.md
  - docs/extension-loading.md
  - docs/pi.md
  - docs/oh-my-pi.md
  - AGENTS.md
  - GLOBAL_OR_PROJECT-AGENTS.md
  - prompts/b-commit.md
  - package.json
from_plan_steps: [14]
depends_on: [7, 13]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Primary diagrams use unique node IDs, route presentation correctly, and end at explicit stage → commit"
  - "[ ] README does not call build→review complete or send plans to implementation review"
  - "[ ] Live /b-* wrappers, skill-only surfaces, and regular exceptions are described accurately"
  - "[ ] b-review write exceptions, conditional docs, protected branches, and closeout order agree everywhere"
  - "[ ] Markdown/link/diagram diagnostics and final touched verification suite pass"
completed_at: null
completed_by: null
---

# Phase 14: Workflow Narrative Reality Pass

## Context

**Inherited parent goal**: Buck Workflow users can follow README and workflow diagrams end to end without bypassing durability, invoking the wrong component, or discovering a missing command.

This phase is deliberately last. It consumes final lifecycle behavior, portable build policy, generated artifact/status references, and installed-surface inventory. It does not redesign contracts in prose.

## Implementation Details

1. Repair both primary Mermaid diagrams:
   - unique node IDs;
   - presentation remains a planning output and does not route directly to implementation review;
   - build/review/iterate/docs/save branches are semantically correct;
   - explicit user-owned staging precedes `/b-commit`;
   - every completion path reaches the real boundary.
2. Rewrite README flows so `/b-build → /b-review` is not “done” and `/b-plan → /b-review` is not presented as plan review. Preserve toolkit flexibility without weakening the durability invariant.
3. Document actual `/b-phase`, `/b-grill-me`, and `/b-grill-with-docs` wrappers; distinguish b-loop's intentional skill-only surface and all regular-wrapper exceptions from Phase 13 inventory.
4. State `b-review` accurately: implementation review is read-only except lifecycle artifacts (`iterate-*` on in-plan failure, `review-pass-*` on pass).
5. Align conditional `/b-docs`, save-owned closeout, explicit staging, one-phase/one-commit, next-phase promotion, and interruption resume language across project/global/harness docs.
6. Align protected branch lists, including `dev`, in user-facing summaries.
7. Update package/README short descriptions if they still end at save or omit commit.
8. Refresh last-updated markers only after semantic parity checks pass.

## Risks

- **Docs become a second policy source**: reference canonical skills/shared contracts and generated tables; do not restate algorithmic details gratuitously.
- **Diagram renders but means the wrong thing**: inspect rendered topology, not only Mermaid syntax.
- **Flexibility wording reopens bypasses**: optional stages may be skipped; durability/review/stage/commit gates for accepted work remain explicit.
- **Historical docs**: exclude immutable brainstorm/research artifacts from current-policy sweeps.

## Verification

- Render/inspect both Mermaid diagrams: unique nodes, no presentation→review edge, and all accepted paths end stage→commit.
- Markdown/LSP diagnostics and internal-link checks are clean for all touched current docs.
- Compare every flow against Phase 13 reference data and canonical lifecycle skills.
- Search current-policy surfaces for obsolete “done at review,” direct save→commit, skill-only mislabels, omitted `dev`, and “you are now in mode” claims; historical artifacts are excluded.
- Run the final touched test set for extension, artifact, installer, and surface inventory; broad suite is appropriate because this plan spans the package.

## Per-Phase Execution Loop

1. Run `/b-build` against this phase file only; treat generated references as inputs, not prose to reinterpret.
2. Render diagrams and run Markdown/link/parity checks.
3. Run `/b-review` against this exact phase file.
4. Iterate any in-plan documentation mismatch and repeat semantic checks.
5. Run `/b-docs` if review identifies additional living-documentation impact.
6. Run `/b-save`, stage all final narrative/generated/durable artifacts, then `/b-commit`.
7. Complete the parent plan/overview/subject only when every phase acceptance criterion and final parity check passes.
