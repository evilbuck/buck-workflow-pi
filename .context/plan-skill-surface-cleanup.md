---
status: completed
date: 2026-09-21
subject: 2026-09-21.skill-command-extension-audit
topics: [cleanup, extensions, b-save, code-review, grill-me-dialog, tmux-window-status, b-grill-auto]
research: [research-skill-command-extension-audit.md]
iterations: []
spec:
memory: [dead-unwired-extensions-build-2026-09-21.md, bsave-code-review-build-2026-09-21.md]
---

# Plan: Skill / command / extension surface cleanup

## User Goal

Agents and humans using this package stop executing dead unwired extension code, follow one `/b-save` procedure, and write code-review artifacts into `.context/` instead of a machine-specific Windows path.

## Goal

Execute audit slices 1–2: delete three unwired extension modules, repair skill/docs that still call them, make `/b-save` a thin skill loader, and move `code-review` per-PR files onto the subject-folder convention.

## Context used / assumptions

- User-provided: “b-plan the cleanup based on the findings.”
- Session: five-scout audit on `master` @ `7dc2aaf`; ranked research already exists.
- Artifacts: `research-skill-command-extension-audit.md`, `research/notes-*.md`, backlog `items/skill-surface-cleanup.md`.
- `extensions/index.ts` does not import `grill-me-dialog`, `tmux-window-status`, or `b-grill-auto`.
- `prompts/` ↔ `commands/` is 43/43 symlinks (`scripts/commands-mirror.test.ts`). Do not break that.
- `extensions/buck-mode.test.ts` stays (slimdown + model auto-switch).
- Assumptions:
  - Slice 3 (project-specific skills, grill-family collapse, `thought-dump-writer`) stays a user call — not this plan.
  - Document `/code-review` dual identity in the prompt; do not rename the extension command.
  - Deleting unwired files requires dropping their `guardrails.json` complexity-inventory rows (`buildSessionBody@17`, `renderResult@15`, `handleWait@13`).

## Scope

1. Delete unwired extension modules and their tests.
2. Stop grill skills from calling the deleted `grill-me_dialog` tool (use file + user-message wait).
3. Update live docs that still list those files as present-but-unwired.
4. Close `test-b-grill-auto-extension.md`.
5. Fold unique `prompts/b-save.md` operational detail into `skills/b-save/SKILL.md`, then thin the prompt.
6. Replace `/mnt/c/Code/plans/` in `skills/code-review/SKILL.md` with `.context/` subject-folder paths matching `code-review-universal`.
7. One-liner in `prompts/code-review.md` for the extension vs skill dual.

## Out of scope

- Moving/deleting `node5-code-review`, `rails-app`, `llm-wiki-vault`, `manage-herdr-panes`.
- Collapsing `b-grill` / `b-grill-me` / `b-grill-auto` / `b-grill-with-docs`.
- Deduping `skills/b-grill/grill.py` vs `skills/b-grill-auto/grill.py`.
- Merging `thought-dump-writer` into `b-capture`.
- README Prompt Templates rows for `/product-tour`, `/git-clean-orphans`, `omp-*`.
- Renaming `/code-review` extension command.
- Stripping `code-review` “Notes on this project” (Supabase/Drizzle/oRPC) — leftover project prose, separate decision.
- Restoring `b-loop` / `b-flow`.
- Catalog-only AGENTS.md “Available Skills” rename.

## Affected files

| File | Change |
|---|---|
| `extensions/grill-me-dialog.ts` | Delete |
| `extensions/tmux-window-status.ts` | Delete |
| `extensions/tmux-window-status.test.ts` | Delete |
| `extensions/b-grill-auto/index.ts` | Delete dir (5 files: index, rpc-client, harness, grill-state, types) |
| `guardrails.json` | Remove complexity rows for deleted functions |
| `docs/extension-loading.md` | Drop unwired tree entries (`:131-133`) |
| `docs/buck-workflow.md` | Tombstone table `:514-515` → removed, skill remains |
| `README.md` | `:350` Unwired list → removed |
| `skills/b-grill-me/SKILL.md` | Doc mode: no `grill-me_dialog`; write file, ask user to edit, wait on next message |
| `skills/b-grill-with-docs/SKILL.md` | Same |
| `skills/b-grill/SKILL.md` | Same |
| `skills/b-grill-auto/SKILL.md` | Drop “historical extension directory” once the dir is gone |
| `.context/backlog/todo.md` | Check off live-test item; keep `skill-surface-cleanup` until this plan lands |
| `.context/backlog/items/test-b-grill-auto-extension.md` | `status: completed`, archive |
| `skills/b-save/SKILL.md` | Absorb prompt-only detail (frontmatter example, backlog archive path, phase/iterate substeps, write scope). Invert “prompt is the body” — skill is source of truth. |
| `prompts/b-save.md` | Thin loader like `prompts/b-commit.md` (`Load and follow skills/b-save/SKILL.md`). `commands/b-save.md` follows via symlink. |
| `skills/code-review/SKILL.md` | Step 6 + summary: `.context/YYYY-MM-DD.<pr>-<slug>/review-pr-<N>.md` (lifecycle initialize/activate). Keep `CODE-REVIEW.md` at repo root for no-arg local reviews. |
| `prompts/code-review.md` | Note: with the package extension loaded, `/code-review` runs `extensions/code-review-iteration/`; this prompt is the portable release-PR skill. |

## Implementation steps

1. Confirm `extensions/index.ts` still has no imports of the three modules. Delete the files listed above. Do not touch `buck-mode.test.ts`.
2. Remove `guardrails.json` complexity-inventory entries for `extensions/b-grill-auto/grill-state.ts#buildSessionBody`, `extensions/grill-me-dialog.ts#renderResult`, `extensions/grill-me-dialog.ts#handleWait`. Shrink `baseline_size` by the number of removed rows (do not weaken other floors).
3. Rewrite Document Mode in `b-grill-me`, `b-grill-with-docs`, and `b-grill` to: create `.context/<subject>/grill-qa-<slug>-<n>.md`, tell the user the path, wait for a chat message that they are done. Delete `grill-me_dialog` calls. Fill the empty `### Non-interactive Mode` stub in `b-grill-me` with that same protocol (or remove the empty heading).
4. Update `docs/extension-loading.md` tree, `docs/buck-workflow.md` tombstone table, `README.md:350`. Point leftover “grill-auto” mentions at `skills/b-grill-auto/`. Historical `.context/` subject folders stay as record.
5. Complete `test-b-grill-auto-extension.md` (reason: extension deleted, skill remains) and archive per backlog rules. Do not archive `skill-surface-cleanup.md` until this plan is executed.
6. Diff `prompts/b-save.md` vs `skills/b-save/SKILL.md`. Copy into the skill anything the prompt has that the skill lacks (YAML frontmatter example; todo.md → `archive/YYYY-MM/` + `archive/completed.md`; phase steps 10a–e; iterate steps 11a–d; write-scope + “execute all 12”). Then replace `prompts/b-save.md` with a 13-line loader. Flip the skill’s “How It Works” so the skill is canonical and the prompt only loads it.
7. In `skills/code-review/SKILL.md` replace both `/mnt/c/Code/plans/review-PR-…` occurrences with the `code-review-universal` locations (`SKILL.md:181-183`). Do not change `wiki/` / bun / Drizzle notes in this pass.
8. Add a short dual-identity note to `prompts/code-review.md` (extension loaded → local Reviewer/Fixer loop; otherwise this skill).

## Acceptance criteria

- [x] `extensions/grill-me-dialog.ts`, `tmux-window-status.ts`, `tmux-window-status.test.ts`, and `extensions/b-grill-auto/` are gone.
- [x] `extensions/index.ts` still wires the same eight modules + model auto-switch. `buck-mode.test.ts` still passes.
- [x] No live `skills/` or `prompts/` instruction calls `grill-me_dialog`.
- [x] `guardrails.json` complexity inventory has no rows for deleted files; complexity_gate still passes.
- [x] `prompts/b-save.md` loads `skills/b-save/SKILL.md`; skill still contains the 12 responsibilities plus the archive/phase/iterate detail that today lives only in the prompt.
- [x] `commands/b-save.md` still symlinks to `../prompts/b-save.md`.
- [x] `skills/code-review/SKILL.md` has zero `/mnt/c/Code/plans` strings; per-PR files go under `.context/`.
- [x] `prompts/code-review.md` states the extension dual.
- [x] Live docs no longer describe the three modules as on-disk unwired code.
- [x] `test-b-grill-auto-extension` is completed/archived.

## Verification

- `rg grill-me-dialog\\|tmux-window-status\\|extensions/b-grill-auto` over `extensions/`, `skills/`, `prompts/`, `README.md`, `docs/`, `AGENTS.md`, `guardrails.json` — zero live hits except historical `.context/` and `docs/b-flow.md`-style tombstones if any remain by design.
- `rg grill-me_dialog skills/` — zero.
- `rg /mnt/c/Code/plans skills/code-review/` — zero.
- `npm test` / `npm run guardrails:check` after the edit batch (orchestrator, not mid-file).
- `npx vitest run extensions/buck-mode.test.ts` — pass.
- `test -L commands/b-save.md` and `readlink` → `../prompts/b-save.md`.
- `wc -l prompts/b-save.md` ≈ 13.

## Execution Instructions

This plan is large enough for `/skill:b-phase` (two slices, >5 files). If executed unphased:

1. `/b-build` against this plan (not hard — file deletes + bounded prose).
2. `/b-review` against this plan.
3. In-plan `iterate-*.md` → `/b-iterate` then re-review. Out-of-plan → separate `/b-plan`. Doc impact (README, `docs/extension-loading.md`, `docs/buck-workflow.md`) → `/b-docs` before `/b-save`.
4. `/b-save` then `/b-commit`.

OMP recommendation: `none` (two slices, no HARD four-phase chain, not an eval-cell audit).

## Risks

- **b-save fidelity:** thinning without folding prompt detail loses the backlog archive path. Mitigation: step 6 is absorb-then-thin, not delete-then-hope.
- **Complexity ratchet:** deleting hotspot files without inventory shrink fails complexity_gate. Mitigation: step 2.
- **Coverage:** `tmux-window-status.test.ts` only covers the deleted module; removing both should not drop global coverage. Confirm in guardrails verdict.
- **Doc-mode hang:** skills currently wait on a tool that never registers. After delete, unfixed skills would call a missing tool. Mitigation: step 3 in the same batch as the file delete.
- **`/code-review` surprise:** documenting dual identity does not remove the collision. Rename is out of scope.

## Recommended next step

This plan looks large enough to benefit from phasing. Run `/skill:b-phase` to split Slice 1 (deletes + grill docs + guardrails + backlog) and Slice 2 (`b-save` + `code-review`) into sequential phase files.
