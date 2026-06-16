---
status: completed
date: 2026-06-16
subject: 2026-06-16.b-fix-rebase-conflict
topics: [rebase, merge-conflict, conflict-resolution, git, skill, context-aware]
research: []
iterations: []
spec: null
memory: [b-fix-rebase-conflict-skill-build-2026-06-16.md, b-fix-rebase-conflict-skill-review-2026-06-16.md]
---

# Plan: b-fix-rebase-conflict Skill

## User Goal

Developers facing large rebase or merge conflicts get an agent that resolves them
without losing functionality from either side — by reading commit messages, diffs,
and `.context/` artifacts to understand each side's intent, then producing a
semantic merge rather than a mechanical ours/theirs pick.

## Goal

Create a new buck-workflow skill `b-fix-rebase-conflict` that detects an active
rebase or merge conflict state, gathers structured context (conflict hunks, commit
intent, `.context/` artifacts) via a helper script, resolves each conflict by
reasoning over that context, stages the results, and presents a batch resolution
report — stopping at a manual gate before `git rebase --continue` / `git merge --continue`.

## Context used / assumptions

- **User-provided context**: the skill description and three design decisions
  confirmed via clarification: (1) handle both rebase and merge conflicts;
  (2) manual gate — no auto-continue; (3) batch-then-review interaction model.
- **Code inspected**:
  - `skills/b-plan/SKILL.md` — plan format, frontmatter, subject-folder rules.
  - `skills/b-pr/SKILL.md` + `scripts/pr-preflight.ts` — the canonical
    script-backed skill pattern (bun script does deterministic git plumbing,
    outputs JSON, LLM reasons over it). This is the direct structural template.
  - `skills/git-commit/SKILL.md` — git-interacting skill safety rules.
  - `skills/b-build/SKILL.md` — write-boundary model for a skill that modifies
    source code (not just `.context/`).
  - `skills/b-review/SKILL.md` — work-discovery protocol from git state.
  - `skills/_shared/subject-resolution.md` — shared subject-resolution protocol.
  - `package.json` — `pi.skills` / `omp.skills` glob `./skills`, so a new
    `skills/b-fix-rebase-conflict/` dir is auto-discovered. `pi.prompts` /
    `omp.commands` glob `./prompts` and `./commands`.
  - `commands/` — symlinks (`commands/*.md -> ../prompts/*.md`) for OMP
    command surface; `prompts/` is the single source of truth.
- **Assumptions**:
  - The skill targets projects using `git` with a standard working tree.
  - `.context/` artifacts are optional context enrichment, not a requirement —
    the skill must work on non-buck-workflow repos (graceful degradation).
  - `bun` is available (used by `b-pr`, `b-auto-fix`, `b-grill` scripts).
    The script must fail-open if bun is missing, falling back to inline git
    commands the LLM can run.
  - The skill resolves conflicts in working-tree files directly (like `b-build`
    modifies source), so its write boundary extends beyond `.context/`.

## Design Decisions (from clarification)

| Decision | Choice | Rationale |
|---|---|---|
| Conflict scope | Rebase + merge | Same conflict-marker mechanics; correct ours/theirs labeling per operation type doubles utility at no code cost. |
| Continuation gate | Manual — no auto-continue | Resolving a conflict incorrectly then auto-advancing to the next replayed commit compounds damage. User runs `git rebase --continue` after reviewing. |
| Interaction model | Batch then review | Resolve all conflicts autonomously using gathered context, stage them, present a full resolution report with per-file diffs. User reviews the whole batch at once. |

## Scope

- **SKILL.md** defining the conflict-resolution workflow, write boundary, safety
  rules, ours/theirs semantics for rebase vs merge, `.context/` integration,
  batch-then-review output format, and manual-gate handoff.
- **Helper script** `scripts/rebase-conflict-analyze.ts` (bun, TypeScript) that
  detects conflict state, extracts conflict hunks, gathers commit context, scans
  `.context/` artifacts, and outputs structured JSON — the deterministic plumbing
  layer (same pattern as `b-pr/scripts/pr-preflight.ts`).
- **Prompt wrapper** `prompts/b-fix-rebase-conflict.md` (source of truth).
- **Command symlink** `commands/b-fix-rebase-conflict.md` for OMP.
- **README.md** additions: skill table row, prompt-template table row, workflow
  routing entry.

## Out of scope

- Auto-running `git rebase --continue` / `git merge --continue` (manual gate by design).
- Interactive per-conflict approval mode (could be a future enhancement).
- Cherry-pick conflict support (mechanically similar, but not in the confirmed scope).
- Re-running the full test suite after resolution (the skill runs lightweight
  verification — build/typecheck if a command exists — and recommends
  `/b-review` for full validation).
- Submodule conflict resolution.

## Conflict Semantics (critical — must appear in SKILL.md)

The ours/theirs label **inverts** between rebase and merge. Getting this wrong
silently drops the user's work.

| Operation | `<<<<<<< HEAD` (ours) | `>>>>>>> branch` (theirs) |
|---|---|---|
| `git merge incoming` | Current branch (where you are) | The incoming branch being merged in |
| `git rebase upstream` | **Upstream / base** (what you're rebasing onto) | **Your branch** being replayed |

In a rebase, the commit being replayed is treated as "theirs" and the upstream
as "ours". The skill **must** detect which operation is in progress and label
sides correctly in its analysis output and resolution report.

## Affected files

| File | Action | Purpose |
|---|---|---|
| `skills/b-fix-rebase-conflict/SKILL.md` | **Create** | Main skill: workflow, resolution strategy, safety, output |
| `skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts` | **Create** | Deterministic git plumbing: conflict detection, hunk extraction, context gathering, JSON output |
| `prompts/b-fix-rebase-conflict.md` | **Create** | Prompt-template wrapper (source of truth for slash command) |
| `commands/b-fix-rebase-conflict.md` | **Create** | Symlink → `../prompts/b-fix-rebase-conflict.md` (OMP command surface) |
| `README.md` | **Edit** | Add skill to Skills table, Prompt Templates table, Workflow Routing section |

## Implementation steps

### 1. Create `skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts`

Follow the `pr-preflight.ts` structure exactly:
- `#!/usr/bin/env bun` shebang.
- `execGit()` / `execMaybe()` helpers (same pattern).
- Exit codes: `0` = conflicts found + JSON output; `1` = error (not a git repo, no conflict state, bun missing); `2` = no active conflict (clean working tree, nothing to resolve).

**Detection phase:**
- Check for rebase in progress: existence of `.git/rebase-merge/` OR `.git/rebase-apply/`.
- Check for merge in progress: existence of `.git/MERGE_HEAD`.
- If neither: exit `2` with message "no active rebase or merge conflict".
- Determine operation type: `"rebase"` or `"merge"`.

**Conflict extraction phase:**
- `git diff --name-only --diff-filter=U` → list of conflicted files.
- For each conflicted file, read the file and parse conflict markers
  (`<<<<<<<`, `=======`, `>>>>>>>`) into structured hunk objects:
  ```typescript
  interface ConflictHunk {
    startLine: number;      // line of <<<<<<< marker
    endLine: number;        // line of >>>>>>> marker
    oursLabel: string;      // label after <<<<<<< (e.g. "HEAD")
    theirsLabel: string;    // label after >>>>>>> (e.g. "feature/x")
    oursContent: string;    // lines between <<<<<<< and =======
    theirsContent: string;  // lines between ======= and >>>>>>>
    contextBefore: string;  // ~5 lines before the conflict (non-conflicted)
    contextAfter: string;   // ~5 lines after the conflict (non-conflicted)
  }
  ```

**Context gathering phase:**
- Merge-base: `git merge-base HEAD <the other ref>`.
  - For rebase: the commit being replayed is in `git rev-parse REBASE_HEAD` (if
    available); the base is HEAD.
  - For merge: `MERGE_HEAD` is the incoming ref.
- Commits touching each conflicted file on each side:
  - `git log --oneline <merge-base>..HEAD -- <file>` (ours).
  - `git log --oneline <merge-base>..<other-ref> -- <file>` (theirs).
- Full commit messages (subjects + bodies) for the top commit on each side
  touching the file — these carry the most intent.

**`.context/` artifact scan** (reuse the pattern from `pr-preflight.ts`
lines 223–294):
- Scan `.context/YYYY-MM-DD.*/` subject folders for `plan-*.md`, `spec-*.md`,
  `memory/*.md`.
- For each artifact: extract title, goal/user-goal, status, topics.
- Output as `contextArtifacts[]` so the LLM can read them for intent.
- If `.context/` does not exist: `contextArtifacts: []` (graceful degradation).

**Output JSON shape:**
```typescript
interface AnalyzeOutput {
  operation: "rebase" | "merge";
  repoRoot: string;
  conflictedFiles: ConflictedFile[];
  contextArtifacts: ContextArtifact[];
}
interface ConflictedFile {
  path: string;
  hunks: ConflictHunk[];
  oursCommits: CommitInfo[];   // commits on our side touching this file
  theirsCommits: CommitInfo[]; // commits on their side touching this file
}
```

**Fail-open for bun missing:** if `bun` is not on PATH, the script cannot run.
The SKILL.md documents a fallback: the LLM runs the equivalent `git` commands
inline (status, diff, log) and parses conflict markers from the raw file reads.
This keeps the skill usable without bun, just less ergonomic.

### 2. Create `skills/b-fix-rebase-conflict/SKILL.md`

**Frontmatter:**
```yaml
---
name: b-fix-rebase-conflict
description: Resolve large rebase or merge conflicts by reasoning over commit messages, diffs, and .context/ artifacts to produce semantic merges that preserve both sides' functionality. Detects conflict state, gathers structured context, resolves in batch, stages results, and stops at a manual gate.
---
```

**Sections** (following repo conventions):

1. **Title + one-line summary.**
2. **When to Use** — rebase or merge in progress with conflicts; large/multi-file
   conflicts where mechanical resolution risks dropping functionality; any
   project with or without `.context/`.
3. **Prerequisites** — `git`; `bun` (optional, for the analysis script; falls
   back to inline git commands).
4. **Write Boundary** —
   - **Allowed**: Edit conflicted working-tree source files to resolve conflicts.
     Stage resolved files (`git add`). Write resolution report to `.context/`.
   - **Blocked**: Running `git rebase --continue`, `git merge --continue`,
     `git commit`, `git rebase --abort`, or any git operation that advances or
     aborts the rebase/merge. Committing to protected branches. Modifying
     non-conflicted files (unless the resolution requires a refactor in an
     adjacent non-conflicted region — note this explicitly in the report).
5. **Invocation** — `/b-fix-rebase-conflict` (no args; detects conflict state
   automatically). Notes the manual gate.
6. **Procedure** (phased, mirrors b-pr's phased structure):

   **Phase 1: Detect conflict state.** Run the analysis script:
   ```bash
   bun skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts
   ```
   - Exit `2` (no conflict) → report "no active conflict" and stop.
   - Exit `1` (error) → if bun missing, fall back to inline git commands
     (`git status`, `git diff --name-only --diff-filter=U`, read conflicted
     files, parse markers). Otherwise surface error and stop.
   - Exit `0` → parse JSON output, proceed to Phase 2.

   **Phase 2: Read context artifacts.** If `contextArtifacts[]` is non-empty,
   read the most relevant plan/spec/memory files (prioritize active subject
   folders whose topics overlap with the conflicted files' areas). Extract:
   - What each side of the branch was trying to accomplish (user goal, scope).
   - Verification criteria (what behavior must survive the merge).
   This is the enrichment layer that makes the resolution semantic rather than
   mechanical. Skip silently if no `.context/` exists.

   **Phase 3: Resolve conflicts (batch).** For each conflicted file:
   1. For each conflict hunk, build a resolution model:
      - **Intent (ours)**: what the our-side commits changed and why (from
        commit messages + diffs + `.context/` artifacts).
      - **Intent (theirs)**: what the their-side commits changed and why.
      - **Conflict root cause**: why the 3-way merge failed (same lines edited,
        structural change, rename, etc.).
      - **Resolution**: the merged result that preserves both sides' functionality.
        Prefer semantic merge (combine both intents) over picking one side.
        If the two sides are genuinely mutually exclusive (e.g., deleted vs
        modified), state the conflict explicitly and pick the side that matches
        the `.context/`-documented intent, noting the dropped side.
   2. Apply the resolution by editing the working-tree file — remove all
      conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) and write the merged
      content. Use the edit tool for surgical edits, or write tool if the file
      is fully rewritten.
   3. Stage the resolved file: `git add <file>`.

   **Phase 4: Verification.** After all files are resolved and staged:
   - Confirm no conflict markers remain: search all conflicted files for
    `^<<<<<<<`, `^=======`, `^>>>>>>>` — must be zero matches.
   - Confirm no unmerged paths: `git diff --name-only --diff-filter=U` → empty.
   - Run lightweight verification if available:
     - If a build/typecheck/lint command exists in `package.json` scripts or
       `AGENTS.md`, run it. Report pass/fail.
     - Do NOT run the full test suite — recommend `/b-review` for that.
   - If verification fails: report the failure, do not proceed to the gate
     handoff. Recommend `/b-iterate` or manual fixing.

   **Phase 5: Resolution report.** Present a structured report:
   ```markdown
   ## Conflict Resolution Report

   **Operation**: rebase | merge
   **Conflicts resolved**: N files

   ### <file-1>
   - **Conflicts**: M hunks
   - **Our side intent**: <from commits + artifacts>
   - **Their side intent**: <from commits + artifacts>
   - **Resolution strategy**: <semantic merge / kept ours / kept theirs / refactor>
   - **Key decision**: <why this resolution preserves both sides>

   ### <file-2>
   ...

   ## Verification
   - Conflict markers remaining: 0
   - Unmerged paths: 0
   - Build/typecheck: pass | fail | not available

   ## Next Step
   Review the resolutions above. If satisfied:
     git rebase --continue   (or: git merge --continue)
   If a resolution is wrong, edit the file and re-stage with `git add`.
   For full validation, run /b-review.
   ```

   **Phase 6: Manual gate.** Do NOT run `git rebase --continue` or
   `git merge --continue`. Hand off to the user. The report's "Next Step"
   section gives the exact command.

7. **Resolution Strategy** (the core logic section):
   - **Semantic merge first**: understand both sides' intent and write code that
     incorporates both. This is the default and the primary value of the skill.
   - **Structural awareness**: read surrounding context (imports, types, callers)
     to ensure the merged code is syntactically and semantically valid. Use
     `lsp` diagnostics after resolving if available.
   - **Artifact-guided**: when `.context/` artifacts exist, use them as the
     source of truth for intent. A plan's user goal answers "which side's
     behavior matters more" when the two are genuinely incompatible.
   - **Conservative on deletion**: if one side deleted code and the other
     modified it, do not silently pick either. Surface the conflict in the
     report and pick the side matching documented intent, explicitly noting
     what was dropped.
   - **Never invent**: if intent cannot be determined (no useful commit
     messages, no artifacts, ambiguous diff), mark the resolution as
     "low-confidence" in the report and recommend manual review.

8. **Conflict Semantics reference table** (the ours/theirs inversion table
   from the plan above — critical to include verbatim in the SKILL.md).

9. **Safety Rules:**
   - Never run `git rebase --continue` / `git merge --continue` / `git commit`.
   - Never run `git rebase --abort` / `git merge --abort`.
   - Never modify non-conflicted files unless a resolution requires a refactor
     in adjacent code — and always note this in the report.
   - Never push.
   - Always stage resolved files (`git add`) so the user can continue immediately.
   - Always verify zero conflict markers remain before reporting done.

10. **Output format** — the resolution report from Phase 5, plus:
    - Changed files list.
    - Draft commit message (Conventional Commits) for when the user continues
      the rebase and needs to amend — optional, only for merge conflicts where
      the user will commit.

11. **Recommended Next Steps:**
    - User runs `git rebase --continue` (or `git merge --continue`).
    - Run `/b-review` for full validation of the merged result.
    - Run `/b-save` if this was part of a buck-workflow session.
    - If the rebase has more commits to replay and new conflicts appear, re-run
      `/b-fix-rebase-conflict`.

### 3. Create `prompts/b-fix-rebase-conflict.md`

Standard prompt-template wrapper (same shape as `prompts/b-build.md`):
```markdown
---
description: Resolve rebase or merge conflicts by reasoning over commit intent and context artifacts
---

# B-Fix-Rebase-Conflict

$ARGUMENTS

Load and follow the `b-fix-rebase-conflict` skill:

\`\`\`
skills/b-fix-rebase-conflict/SKILL.md
\`\`\`
```

### 4. Create `commands/b-fix-rebase-conflict.md`

Symlink to the prompt (same as all other b-* commands):
```bash
ln -s ../prompts/b-fix-rebase-conflict.md commands/b-fix-rebase-conflict.md
```

### 5. Update `README.md`

Three additions:
- **Skills table** (~line 168–200): add row:
  `| \`b-fix-rebase-conflict\` | Resolve large rebase/merge conflicts by reasoning over commit messages, diffs, and .context/ artifacts |`
- **Prompt Templates table** (~line 143–165): add row:
  `| \`/b-fix-rebase-conflict\` | \`b-fix-rebase-conflict\` | Resolve rebase/merge conflicts with context-aware semantic merges |`
- **Workflow Routing section** (~line 210–217): add entry:
  `| \`/b-fix-rebase-conflict → git rebase --continue → /b-review\` | Large rebase/merge conflicts |`

## Verification

- **Script syntax**: `bun skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts`
  runs without a TypeScript compile error (bun runs TS natively; verify with a
  no-conflict repo → should exit `2` cleanly).
- **Conflict-marker parsing**: create a temporary repo with a synthetic conflict
  (two branches editing the same lines), run the script, verify the JSON output
  contains correct hunk structures with properly separated ours/theirs content.
- **Skill completeness**: SKILL.md contains all required sections — write
  boundary, ours/theirs semantics table, safety rules, manual-gate handoff,
  `.context/` integration, resolution strategy, output format.
- **Symlink resolves**: `readlink -f commands/b-fix-rebase-conflict.md` points
  to `prompts/b-fix-rebase-conflict.md`.
- **README accuracy**: the new skill appears in all three README sections.
- **No auto-continue**: grep the SKILL.md for `--continue` — it must only appear
  in the "manual gate" / "next step" handoff context, never in a procedure step
  the skill executes itself.

## Ralph Instructions

This is a non-phased Ralph-ready plan. Treat the whole plan as one unit:
1. Run `/b-build-hard` against this plan (ambiguous, multi-file, new skill — use hard mode).
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` to consolidate memory, draft commits, and review/iteration artifacts.
5. Run `/b-commit` to checkpoint durable state before `ralph_done`.
6. If interrupted before completion, leave a clear note in memory and resume from the active plan or newest iterate artifact.

## Risks

- **Ours/theirs inversion**: the single most dangerous failure mode. If the
  script or skill mislabels sides, it silently drops the user's work. Mitigation:
  the script detects operation type from git internals (not from markers alone)
  and labels sides in the JSON; the SKILL.md includes the inversion table
  verbatim; the resolution report always states "our side intent" and "their
  side intent" so the user can catch a mislabel.
- **Script fragility on conflict-marker parsing**: edge cases (nested markers,
  markers inside strings, `diff3` conflict style with `|||||||` base section).
  Mitigation: the script handles standard 2-way and diff3 styles; the
  fail-open fallback (LLM reads raw files) covers exotic cases.
- **Semantic merge producing broken code**: the LLM might write merged code that
  doesn't compile. Mitigation: Phase 4 runs build/typecheck; Phase 5 reports
  verification status; `/b-review` recommended for full validation.
- **Large conflict batches**: a rebase with 50+ conflicted files could exhaust
  the context window. Mitigation: process files in order; the script outputs
  compact JSON (hunk content, not full files); the skill can note "N files
  remaining" if the batch is truncated and recommend re-running.
- **Non-conflicted refactors**: a good semantic merge sometimes needs to edit
  code outside the conflict markers (e.g., update a call site). This violates
  the default "only touch conflicted files" boundary. Mitigation: the skill
  allows it but requires explicit notation in the resolution report.
