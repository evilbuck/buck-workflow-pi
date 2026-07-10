---
status: pending
phase: 3
order: 3
plan: plan-buck-workflow-contract-remediation.md
phases_overview: plan-buck-workflow-contract-remediation-phases.md
difficulty: hard
model_hint: strongest reasoning model available; staged-diff integrity and subject-safe commit selection
buck_hint: /b-build-hard
goal: "Make explicit staging and staged-reality validation part of every Buck closeout."
files:
  - skills/git-commit/SKILL.md
  - prompts/b-commit.md
  - skills/b-save/SKILL.md
  - skills/b-build/SKILL.md
  - skills/b-review/SKILL.md
  - skills/b-phase/SKILL.md
  - skills/b-plan/SKILL.md
  - skills/_shared/subject-resolution.md
from_plan_steps: [3]
depends_on: [2]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Every generated lifecycle loop states review → docs if needed → save → stage → commit"
  - "[ ] b-commit resolves an explicit/current subject rather than newest directory mtime"
  - "[ ] Existing draft commit content is validated against the staged file set and reviewed target"
  - "[ ] Unstaged save artifacts or mismatched subject drafts block or regenerate safely"
  - "[ ] No-auto-stage and protected-branch safeguards remain intact"
completed_at: null
completed_by: null
---

# Phase 3: Stage and Commit Safety

## Context

**Inherited parent goal**: Buck Workflow users can checkpoint accepted work without omitting the durable artifacts or committing under a stale/wrong subject message.

Phase 2 defines the post-save artifact set. This phase makes the human staging boundary explicit and hardens `git-commit`, which currently selects a draft by newest subject and skips diff analysis whenever that draft exists.

## Implementation Details

1. Preserve manual staging. Neither `b-save` nor `git-commit` runs broad `git add`; the user owns the stage decision.
2. Update every executable/generated lifecycle instruction in `b-build`, `b-review`, `b-phase`, `b-plan`, and save closeout to say `save → stage → commit`. Do not leave a direct save→commit bypass.
3. Resolve commit context in this order: explicit target/subject, active reviewed target from durable artifacts, then unambiguous shared subject resolution. Never use `ls -dt`, mtime, or lexicographically newest subject.
4. Make `draft-commit.md` carry subject/target identity and the expected implementation/durable path set or fingerprint produced during save.
5. Always inspect the staged diff, even when a draft exists. If staged reality differs:
   - reject a wrong-subject draft;
   - regenerate message material from staged reality when safe;
   - stop on unrelated or missing durable paths rather than silently omit them.
6. Keep protected branch checks aligned across skill and user-facing prompt, including `dev`.
7. Add staged-diff fixtures with two subjects, stale drafts, missing context artifacts, and unrelated files.

## Risks

- **False mismatch from generated context**: expected paths come from Phase 2's post-save checklist, not a pre-save snapshot.
- **Over-strict commits**: intentional extra staged files require explicit acknowledgement or fresh message generation, not automatic rejection without explanation.
- **Branch safety regression**: preserve main/master/dev/develop guards and force-with-lease boundaries.
- **Instruction drift**: Phase 14 updates narrative docs; this phase owns all executable skill templates now.

## Verification

- Two subject folders with different drafts and mtimes: explicit/current subject draft wins.
- Stale draft for subject A plus staged subject B implementation: A's draft is not used.
- Save produced new `.context` files but they are unstaged: flow stops at staging with exact missing paths.
- Correct staged implementation and durable set: draft seed plus staged analysis produces one commit message.
- Protected-branch fixture includes `dev`; no automatic stage occurs.
- Search the touched skill/template surfaces for direct `save → commit` paths and verify none remain outside historical text.

## Per-Phase Execution Loop

1. Run `/b-build-hard` against this phase file only.
2. Run `/b-review` against this exact phase file.
3. Iterate only in-plan defects; route new scope separately.
4. Run `/b-docs` if review flags documentation impact.
5. Run `/b-save` and inspect its expected path set.
6. Stage exactly the implementation and durable artifacts.
7. Run the hardened `/b-commit`; verify it used this subject and the staged reality.
8. If incomplete, leave `status: in-progress` and do not queue dependent build-policy work.
