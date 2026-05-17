---
status: active
date: 2026-05-17
subject: 2026-05-17.b-review-plan-path
topics: [b-review, plan-path, review, workflow, skills]
informs: [plan-b-review-plan-path.md]
---

# Research: b-review should accept a plan path and verify completed work

## Question

The user wants `b-review` to support being invoked with a path to a plan artifact. The review should not expect the user to provide a diff. Given a plan path, `b-review` should figure out what work was done and verify whether the plan was completed successfully.

## Active context

- Project architecture: canonical workflow logic lives in `skills/`; Pi slash commands in `prompts/` are thin wrappers that load skills.
- Current command wrapper: `prompts/b-review.md` already passes `$ARGUMENTS` before loading `skills/b-review/SKILL.md`, so a plan path can reach the model without TypeScript extension changes.
- Relevant backlog: only unrelated live `b-grill-auto` testing item is active.
- Recent memory: prompt-to-skill migration established skills as source of truth and prompts as wrappers.

## Key files inspected

- `skills/b-review/SKILL.md` — canonical review behavior.
- `prompts/b-review.md` — thin wrapper with `$ARGUMENTS`.
- `skills/b-plan/SKILL.md` — plan artifact shape and frontmatter (`research`, `spec`, `memory`).
- `skills/b-build/SKILL.md` — implementation flow, phased-plan behavior, memory updates, draft commit output.
- `.context/2026-05-15.tps-tracker-review/iterate-tps-tracker-review.md` — recent real b-review output showing review can operate without a plan, but frames the source as no plan/diff/context.
- `.context/workflow/current-session.json` — contains commands and broad `files_modified`, but file entries are session-wide and untimestamped, so useful as a hint, not authoritative proof.

## Findings

### 1. The prompt wrapper probably does not need functional changes

`prompts/b-review.md` includes `$ARGUMENTS` before the instruction to load `skills/b-review/SKILL.md`. That means `/b-review .context/.../plan-foo.md` can already pass the path into context.

A small description update could improve discoverability, but the behavior belongs in `skills/b-review/SKILL.md`.

### 2. The skill currently has a conceptual mismatch

`skills/b-review/SKILL.md` says:

- Review implementation changes.
- You do not review plans.
- Check scope adherence by finding active/relevant `plan-*.md` or `spec-*.md`.
- If no plan/spec is found, review against user request, diff, and code context.

The phrase “You do not review plans” is likely meant to prevent plan-quality review, but it conflicts with the desired invocation model where the plan is the acceptance source. The skill should say it does not critique the plan as a planning artifact unless asked; it uses the plan as the expected outcome / acceptance contract.

### 3. Explicit path resolution is missing

Current scope resolution starts with “Active subject folder” and then scans all subject folders. It does not say an explicit user-provided plan/spec path has priority.

Desired resolution order should begin with:

1. Explicit user argument path(s), especially `plan-*.md`, `plan-*-phases.md`, `phase-*.md`, or `spec-*.md`.
2. If the path is a subject folder, load its best matching active plan/spec.
3. Existing active-subject and global fallback rules.

The iterate artifact should be written to the subject folder containing the explicit plan path, not whatever active subject happens to be in session state.

### 4. “Diff” should be an evidence source, not an input contract

The user’s core complaint is that b-review appears to expect a diff. The revised skill should explicitly say:

- Do not require the user to provide a diff.
- If no diff exists, do not conclude no work was done.
- Build an evidence map from available sources, then verify the current target state against the plan.

Useful evidence sources, in priority order:

1. Explicit plan/spec/phase path and linked artifacts (`research`, `spec`, `plans`, phase files).
2. Current working tree: `git status`, `git diff`, `git diff --cached`, and changed file lists.
3. Subject-folder handoff artifacts: `draft-commit.md`, `iterate-*.md`, `tasks.md`, completed phase files, memory links.
4. `.context/workflow/current-session.json` as a hint for commands run and session-wide modified files, but not authoritative because `files_modified` is broad and lacks per-change timestamps.
5. Recent commits after the plan date, especially commits touching affected files. This matters if the implementation was already committed before review.
6. Plan-declared `Affected files` plus source inspection of those files to verify current behavior.
7. Tests and verification commands listed in the plan.

### 5. The review output needs a plan completion contract

When a plan path is provided, the review should report more than “issues/no issues.” It should include a compact completion matrix:

- Plan source path.
- Work evidence found: uncommitted diff, staged diff, commits, subject artifacts, inspected files.
- Implementation steps: complete / partial / missing / not verifiable.
- Verification items: passed / failed / not run / not applicable.
- Out-of-scope changes: none / list.
- Final verdict: plan complete, plan incomplete, or inconclusive.

This directly addresses “verify that the plan was completed successfully.”

### 6. Phased plans need explicit handling

`b-build` supports phased plans and discrete phase files. `b-review` should mirror that enough to avoid reviewing the wrong scope:

- If given `plan-*-phases.md`, review the active/current phase unless user asks for all phases.
- If given a discrete `phase-*.md`, review only that phase’s acceptance criteria.
- If phase frontmatter/status says completed, verify the current code actually satisfies criteria rather than trusting the checkbox.

## Recommended change shape

### `skills/b-review/SKILL.md`

Add or revise these sections:

1. **Invocation inputs**
   - Accept optional explicit arguments: plan path, spec path, subject folder, or freeform review target.
   - Explicit paths override active-subject scanning.

2. **Plan-as-acceptance-contract wording**
   - Replace “You do not review plans” with: “Do not critique the plan as a plan unless asked; use it as the acceptance contract for the implementation review.”

3. **Work discovery protocol**
   - Instruct the skill to infer what changed using git status/diff/staged diff, commits since plan date, subject artifacts, workflow session hints, and direct source inspection.
   - Make diff optional and non-authoritative.

4. **Plan completion review protocol**
   - Parse goal/scope/out-of-scope/affected files/implementation steps/verification/risks.
   - Build a step-by-step completion map.
   - Run or recommend verification according to plan.
   - Flag missing evidence separately from confirmed failures.

5. **Output contract for plan-path review**
   - Include plan path, evidence sources, completion matrix, issues/warnings, verdict, and next step.

### `prompts/b-review.md`

Optional small doc tweak only:

- Change description to mention optional plan/spec path input.
- Optionally add one sentence: “Arguments may be a plan/spec/subject path to verify against.”

No extension or package changes appear necessary for this behavior.

## Handling committed work

Committed files are first-class implementation evidence, not a review blocker. `b-review` should treat the plan as the acceptance contract and evaluate the repository's current target state, whether the changes are uncommitted, staged, or already committed.

Recommended protocol:

1. Establish the review baseline:
   - Prefer the branch point from upstream/main when available, e.g. `git merge-base HEAD @{upstream}` or the project default branch.
   - If no upstream is available, use the commit immediately before the plan date as a weaker baseline.
   - Also record the plan date and subject folder to narrow history.
2. Build the committed evidence set:
   - `git log --since=<plan-date> --name-status -- <affected-files>` for plan-declared files.
   - `git diff <baseline>..HEAD -- <affected-files>` to recover the effective patch even when the working tree is clean.
   - `git show --stat` / `git show --name-status` for likely build commits, especially commits touching affected files or mentioning the subject/plan in the message.
3. Merge this with normal evidence:
   - Working tree and staged diff still matter for follow-up edits.
   - Subject artifacts (`draft-commit.md`, `iterate-*.md`, `tasks.md`, phase files, memory links) help identify intent.
   - Direct source inspection verifies the final behavior in `HEAD`.
4. Judge against the plan, not against diff presence:
   - A clean working tree can still be a complete implementation if committed changes plus current source state satisfy the plan.
   - If no matching commit is found but current code satisfies the plan, mark the step complete with “source-state evidence”; optionally warn that traceability is weak.
   - If commits touch files outside the plan scope, inspect whether they are necessary support work or out-of-scope changes.
5. Report committed evidence explicitly:
   - Include a “Committed evidence” line listing commit SHAs or commit range.
   - Include uncommitted/staged evidence separately.
   - Use the same completion matrix: complete / partial / missing / not verifiable.

The key rule: committed work moves the evidence source from `git diff` to `git diff <baseline>..HEAD`, commit inspection, and final source-state verification. It does not change the plan completion criteria.

## Handling multiple Buck workflow sessions on one branch

If a branch contains multiple `/b-*` workflow sessions, branch-wide diff is too broad to treat as the reviewed implementation. `b-review <plan-path>` should narrow evidence to the specific plan/session before judging completion.

Recommended narrowing protocol:

1. Use the explicit plan path as the primary scope anchor:
   - Subject folder name and date, e.g. `.context/YYYY-MM-DD.subject/`.
   - Plan frontmatter: `date`, `subject`, `topics`, `research`, `spec`, `memory`.
   - Plan body: goal, affected files, implementation steps, verification.
2. Prefer explicit cross-links over heuristics:
   - Plan `memory:` entries created by `b-save`.
   - Memory `artifacts:` and `subject:` fields.
   - `draft-commit.md` in the same subject folder.
   - Phase files or `tasks.md` in the same subject folder.
3. Filter commits by plan/session indicators:
   - Commits after the plan date that touch plan affected files.
   - Commits whose messages mention the subject, scope, symbols, or draft commit title.
   - Commits referenced by memory or draft artifacts if available.
4. Avoid using the whole branch diff as proof:
   - Use branch diff only as a candidate pool.
   - Exclude commits/files clearly tied to other subject folders or unrelated plan topics.
   - Flag overlapping files as “shared evidence” and inspect source state directly.
5. Verify current source state per plan step:
   - Even if commit attribution is messy, the final question is whether current `HEAD` satisfies this plan's acceptance criteria.
   - If source state satisfies the plan but attribution is unclear, mark completion as verified with weak traceability.
   - If branch contains unrelated changes, report them separately as out-of-scope branch changes, not necessarily review failures.

Longer-term improvement: `b-build`/`b-save` could record a plan-specific implementation ledger with commit SHAs, touched files, verification commands, and completion notes. That would make `b-review <plan-path>` deterministic even on long-lived branches with many workflow sessions.

## Risks / unknowns

- If the implementation has already been committed and the plan date is old, commit-range inference can be noisy. The skill should combine commit history with affected-file inspection rather than rely only on `git log`.
- Baseline selection can be ambiguous on long-lived branches. Prefer upstream merge-base when available; otherwise state the fallback used.
- Multiple workflow sessions on the same branch can interleave changes to the same files. In that case, use current source-state verification for plan completion and report commit attribution as uncertain.
- `.context/workflow/current-session.json` accumulates long-lived file modification state; use it only as a hint.
- If plan affected files are inaccurate, source inspection may miss work in undocumented files. The skill should still use git evidence and search for plan-specific symbols/terms.
- Running every verification command in a plan can be expensive. The skill should run the narrowest useful checks and report any skipped checks explicitly.

## Suggested next workflow step

Use `b-plan` to create a bounded implementation plan for updating `skills/b-review/SKILL.md` and optionally `prompts/b-review.md`, then `b-build` to make the change.
