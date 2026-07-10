---
status: pending
phase: 10
order: 10
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: medium
model_hint: capable general model; bounded canonicalization with cross-harness loader verification
buck_hint: /b-build
goal: "Make PR skills the only policy sources while preserving necessary harness loaders."
files:
  - skills/b-pr/SKILL.md
  - prompts/b-pr.md
  - commands/b-pr.md
  - skills/b-pr-review-2-issues/SKILL.md
  - prompts/b-pr-review-2-issues.md
  - commands/b-pr-review-2-issues.md
from_plan_steps: [10]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[ ] b-pr and b-pr-review-2-issues skills contain the sole executable policies"
  - "[ ] Prompt and command entrypoints are thin loaders without independent procedures"
  - "[ ] The .context secret-leak exception lives in the canonical review-to-issues skill"
  - "[ ] Intentional regular-file command wrappers remain portable and documented for inventory"
  - "[ ] Pi and OMP invocations resolve to equivalent canonical behavior"
completed_at: null
completed_by: null
---

# Phase 10: Canonical PR Wrappers

## Context

**Inherited parent goal**: Buck Workflow users receive the same PR behavior regardless of whether Pi prompts or OMP commands invoke it.

Most wrappers are thin. `b-pr` and `b-pr-review-2-issues` duplicate policy, and the secret-leak exception exists only in one wrapper. The two OMP command files are intentional regular loaders for portable skill-directory resolution; thinness does not require turning them into broken symlinks.

## Implementation Details

1. Compare each prompt/command procedure against its canonical skill and move every executable rule into the skill.
2. Reduce `prompts/b-pr.md` and `prompts/b-pr-review-2-issues.md` to argument forwarding plus skill loading.
3. Keep `commands/b-pr.md` and `commands/b-pr-review-2-issues.md` as regular thin loaders if OMP needs the runtime-resolved skill path. Remove duplicated policy from them.
4. Move the rule “`.context/**` comments are skipped except an actionable secret-leak report” into `skills/b-pr-review-2-issues/SKILL.md`.
5. Ensure argument/PR-context behavior is equivalent across Pi and OMP entrypoints.
6. Produce inventory metadata Phase 12 can classify as `thin regular wrapper`, not an unexplained exception.

## Risks

- **Portable path regression**: preserve `<skill_dir>` resolution required by OMP; thin wrapper does not mean symlink at any cost.
- **Security exception loss**: test the secret-leak case and ordinary context-skip case behaviorally.
- **Argument drift**: explicit PR URL/number and no-argument resolution must reach the same skill inputs on both harnesses.

## Verification

- Pi `/b-pr` and OMP `/b-pr` loader smokes reach `skills/b-pr/SKILL.md` with identical arguments.
- Same for `b-pr-review-2-issues`.
- Review comment on ordinary `.context/**` is skipped; a comment identifying leaked credentials remains actionable.
- No prompt/command contains a second procedural copy after cutover.
- Command files remain regular only where runtime path resolution requires it.

## Per-Phase Execution Loop

1. Run `/b-build` against this phase file only.
2. Run both harness loader smokes and security-classification cases.
3. Run `/b-review` against this exact phase file.
4. Iterate in-plan loader/policy drift.
5. Run `/b-docs` if documentation impact is flagged.
6. Run `/b-save`, stage implementation and durable artifacts, then `/b-commit`.
7. If either harness resolves differently, leave `status: in-progress`.
