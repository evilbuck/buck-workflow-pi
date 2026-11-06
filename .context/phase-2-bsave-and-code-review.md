---
status: completed
phase: 2
order: 2
plan: plan-skill-surface-cleanup.md
phases_overview: plan-skill-surface-cleanup-phases.md
difficulty: medium
model_hint: capable general model preferred — b-save absorb-then-thin has fidelity risk; code-review path swap is mechanical
buck_hint: /b-build
goal: "Make `/b-save` a thin skill loader with the skill as source of truth, and write code-review per-PR files under `.context/` instead of `/mnt/c/Code/plans/`."
files:
  - skills/b-save/SKILL.md
  - prompts/b-save.md
  - plugins/buck-workflow/skills/b-save/
  - skills/code-review/SKILL.md
  - prompts/code-review.md
from_plan_steps: [6, 7, 8]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] `prompts/b-save.md` loads `skills/b-save/SKILL.md` (≈13-line loader like `prompts/b-commit.md`)."
  - "[x] `skills/b-save/SKILL.md` still contains the 12 responsibilities plus the archive/phase/iterate/write-scope detail that today lives only in the prompt."
  - "[x] Skill `How It Works` treats the skill as canonical; the prompt only loads it."
  - "[x] `commands/b-save.md` still symlinks to `../prompts/b-save.md`."
  - "[x] Canonical `b-save` is byte-identical to `plugins/buck-workflow/skills/b-save/`."
  - "[x] `skills/code-review/SKILL.md` has zero `/mnt/c/Code/plans` strings; per-PR files go under `.context/` matching `code-review-universal` (`SKILL.md:181-183`)."
  - "[x] No-arg local reviews still write `CODE-REVIEW.md` at repo root."
  - "[x] `prompts/code-review.md` states the extension vs portable-skill dual. Do not rename the extension command."
completed_at: 2026-09-21
completed_by: b-build
---

# Phase 2: b-save Thin-Wrap and Code-Review Paths

## Context

Parent user goal: Agents and humans using this package stop executing dead unwired extension code, follow one `/b-save` procedure, and write code-review artifacts into `.context/` instead of a machine-specific Windows path.

This phase delivers the second and third outcomes. Dead-extension deletion is Phase 1 and is not required to start here (disjoint files), but the recommended order is Phase 1 first so complexity/coverage fail fast.

Out of scope here: README Prompt Templates rows (`/product-tour`, `/git-clean-orphans`, `omp-*`); renaming `/code-review`; stripping `code-review` “Notes on this project” (Supabase/Drizzle/oRPC).

## Implementation Details

1. Diff `prompts/b-save.md` vs `skills/b-save/SKILL.md`. Copy into the skill anything the prompt has that the skill lacks:
   - YAML frontmatter example (date, domains, topics, subject, artifacts, related, priority, status)
   - Backlog archive path: completed items leave `todo.md`, item `status: completed` + `completed: YYYY-MM-DD`, move to `archive/YYYY-MM/<slug>.md`, summary on `archive/completed.md`; new/deferred items get `items/<slug>.md` + linked checkbox; only auto-archive explicitly completed items
   - Phase consolidation 10a–e (read phase files, overview table, in-progress→completed + `completed_at`, stale overview, skip legacy single-file)
   - Iterate consolidation 11a–d (verify acceptance, mark completed, `artifacts:` include iterate files, back-fill plan `iterations:`)
   - Write scope: always write under `.context/`; step 8 may call `retain` / `learn`
   - “Execute all 12 steps” equivalent as the skill’s run instruction
   Keep existing skill content that the prompt already summarized (lifecycle closeout last, two memory layers, commit integration). Do not drop OMP retain/learn or non-OMP memory-skill re-index.

2. Flip `skills/b-save/SKILL.md` **How It Works** so the skill is the source of truth and `prompts/b-save.md` only loads it. Today it says the prompt body is executed and “no extension backing” — keep the no-extension fact, invert “prompt is the body”.

3. Replace `prompts/b-save.md` with a ~13-line loader matching `prompts/b-commit.md`:
   - YAML `description:`
   - `# B Save`
   - `$ARGUMENTS`
   - `Load and follow the \`b-save\` skill:` + fenced `skills/b-save/SKILL.md`
   `commands/b-save.md` follows via symlink. Do not replace the symlink with a physical file. `wc -l prompts/b-save.md` ≈ 13.

4. Recopy the full canonical `skills/b-save/` directory into `plugins/buck-workflow/skills/b-save/`. `code-review` is **not** in the curated Codex bundle — do not add it.

5. In `skills/code-review/SKILL.md` replace both `/mnt/c/Code/plans/review-PR-…` occurrences with the `code-review-universal` locations (`skills/code-review-universal/SKILL.md:181-183`):
   - GitHub PR mode → `.context/YYYY-MM-DD.<pr-number>-<kebab-title>/review-pr-<N>.md`; new folder → lifecycle `initialize` then `activate`
   - Keep `CODE-REVIEW.md` at repo root for no-arg local reviews
   Do not change `wiki/` / bun / Drizzle / oRPC notes in this pass.

6. Add a short dual-identity note to `prompts/code-review.md` (after the load-skill block or in the description): with the package extension loaded, `/code-review` runs `extensions/code-review-iteration/` (local Reviewer/Fixer loop); this prompt is the portable release-PR skill. Do not rename the extension command.

Absorb-then-thin. Do not delete prompt detail before it lives in the skill.

## Risks

- **b-save fidelity:** thinning without folding prompt detail loses the backlog archive path and phase/iterate substeps. Mitigation: step 1 is absorb-then-thin, not delete-then-hope.
- **Symlink break:** writing a physical `commands/b-save.md` fails `scripts/commands-mirror.test.ts`. Edit `prompts/b-save.md` only.
- **Codex drift:** `b-save` is a canonicalCopies member. Recopy after the skill edit.
- **`/code-review` surprise:** documenting dual identity does not remove the collision. Rename is out of scope.

## Verification

- `wc -l prompts/b-save.md` ≈ 13; file contains `Load and follow` + `skills/b-save/SKILL.md`.
- `test -L commands/b-save.md` and `readlink` → `../prompts/b-save.md`.
- Skill contains: frontmatter YAML example; `archive/YYYY-MM/`; `archive/completed.md`; 10a–e; 11a–d; write-scope.
- `rg /mnt/c/Code/plans skills/code-review/` — zero.
- `rg grill-me_dialog` is Phase 1’s job; do not regress it.
- `diff -rq skills/b-save plugins/buck-workflow/skills/b-save` — empty.
- `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts`
- `npm run guardrails:check` after the edit batch.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
