---
status: active
date: 2026-10-01
updated: 2026-11-16
subject: 2026-10-01.skill-command-viability
topics: [skills, commands, viability, cleanup, consolidation]
research: [research-low-viability.md]
iterations: []
memory: [viability-cleanup-phase-2-fold-duplicates-2026-11-16.md, viability-cleanup-phase-3-unify-b-grill-2026-11-16.md]
---
# Plan: Viability cleanup checklist

## User Goal

The maintainer can walk one checklist, change any recommendation in place, and apply or skip each item without losing track of what was decided.

Synthesized from the request to walk through and update the list, then expanded on 2026-11-16 to accept the full skill-overlap audit and unify `b-grill` around domain-docs-by-default (`--no-docs` to opt out).

## Goal

Turn the viability ranking and 2026-11-16 skill-overlap audit into a bounded, reversible catalog cleanup with accepted items marked `do`.

D1, F1–F8, G1, and M1–M5 are tracked here; [plan-viability-cleanup-phases.md](plan-viability-cleanup-phases.md) must be re-generated via `/skill:b-phase` to reflect the expanded F4–F8, revised G1, and M4–M5 scope.

## Context used / assumptions

- User-provided context: walk-through todo list they can update, based on the audit and the recommendations; 2026-11-16 directive to make `b-grill` use domain docs by default (requiring `--no-docs` to disable) and accept the rest of the proposed skill reductions.
- Session context: Jev `jev-1.13.0` scores, jq 1.8.2 mention counts (245 sessions, 670 user messages), prior audit `01a0c3e1`, and 2026-11-16 70-skill overlap audit across `skills/`, `prompts/`, and `extensions/`.
- Artifacts used: `research-low-viability.md`.
- Buck capability: full. Probe source: system available-skills catalog. Sentinels `b-build`, `b-review`, `b-save` present.
- This plan is one checklist on purpose. It exceeds the `b-phase` step-count threshold. Re-run `/skill:b-phase` when ready to execute in phased sessions.

## Decision Closure

Selected course: accept the proposed skill consolidations (`Status: do`) and unify the grill family into `skills/b-grill/` with domain-docs (`CONTEXT.md` + `docs/adr/`) enabled by default and `--no-docs` as the explicit opt-out flag. Deletes and folds stay one commit per todo or phase so `git revert <sha>` is the rollback.

Evidence: viability research in this subject; 2026-11-16 overlap audit across all 70 skills; catalog rows in `README.md` and `docs/buck-workflow.md`; `commands/` are symlinks to `prompts/`; `plugins/buck-workflow/skills/` is a physical Codex copy pinned by `scripts/codex-plugin.test.ts`; `skills/design-brief/` is not `skills/_shared/design-brief.jsonc`; `extensions/b-save/index.ts` is wired in `extensions/index.ts` while `extensions/b-save-improved/` no longer exists.

Excluded scope: `/b-build-hard`, `pi-rpc`, `skill-explainer`, `b-design-palette`, the 6 distinct review skills (`b-review`, `code-review-universal`, `adversarial-review`, `code-review`, `b-pr-review-2-issues`, `fix-pr`), the 3 visualization skills (`plan-synopsis`, `b-blueprint`, `b-present`), `extensions/b-kamal-release` unless X2 is set to `do`, and any rewrite of the shared design-language JSONC.

Next action: re-run `/skill:b-phase` to refresh phase files for F1–F8, G1, and M1–M5, then execute the `do` items.

## Assumptions Ledger

| id | statement | status | blocking | evidence or validation_path |
|---|---|---|---|---|
| A-1 | `skills/design-brief/` is a skill, not the design-language file `skills/_shared/design-brief.jsonc` | validated | false | Separate paths. F1 forbids deleting the JSONC. |
| A-2 | A prompt delete that leaves `commands/<name>.md` fails `scripts/commands-mirror.test.ts` | validated | false | Docs and the symlink inventory. Any prompt delete removes both `prompts/<name>.md` and `commands/<name>.md` together. |
| A-3 | External move-out todos (`M1`, `M2`, `M5`) need an external filesystem destination before moving | deferred | false | Operator writes `Destination:` on M1, M2, and M5 before moving them out of the repo. M3 (`docs/cross-platform-pi-omp-loading.md`) and M4 (`node5-code-review` deletion) have in-repo resolution and are `do`. |
| A-4 | `/b-kamal-release` is not a confirmed delete | deferred | false | Jev fit 0.88, confidence 0.27. X2 stays `keep` until the operator changes it. |
| A-5 | `b-docs` and `GLOBAL_OR_PROJECT-AGENTS.md` cite `b-grill-with-docs/ADR-FORMAT.md` and `CONTEXT-FORMAT.md` | validated | false | Moving those format files into `skills/b-grill/` under G1 requires updating references in `skills/b-docs/SKILL.md`, `GLOBAL_OR_PROJECT-AGENTS.md`, and `AGENTS.md` in the same step. |

## Material Risks

- failure_mode: F1 deletes `skills/_shared/design-brief.jsonc` along with the skill.
  impact: blueprint and present HTML lose their token source.
  mitigation: F1 names the forbidden path and checks the file still exists.
  rollback_or_fallback: `git revert` of the F1 commit.
  validation_path: after F1, `test -f skills/_shared/design-brief.jsonc` and `npx vitest run skills/_shared/scripts/design-language.test.ts`.

- failure_mode: D1 deletes `prompts/omp-goal.md` before the 6-step completion-audit text is copied into `docs/buck-workflow.md`.
  impact: `b-review` loses the only write-up of that protocol (`docs/buck-workflow.md` currently points at the prompt).
  mitigation: D1 copies the protocol into the doc, then deletes the slash surface.
  rollback_or_fallback: `git revert` of the D1 commit.
  validation_path: `rg -n "6-step completion-audit" docs/buck-workflow.md` returns a hit that is not only a link to `prompts/omp-goal.md`.

- failure_mode: F3 deletes `crawl4ai` while `skills/b-research/SKILL.md` still says to invoke it.
  impact: research runs follow a missing skill.
  mitigation: same todo updates `b-research` first.
  rollback_or_fallback: `git revert` of the F3 commit.
  validation_path: `rg -n "skills/crawl4ai" skills/b-research/SKILL.md` returns no hit.

- failure_mode: F4 deletes `skills/b-save-improved/` without relocating `save-preflight.ts` and `save-apply.ts` or updating callers in `extensions/` and `skills/b-save/SKILL.md`.
  impact: `/b-save` and `buck-loop` save preflight/apply fail on missing script paths.
  mitigation: move `scripts/save-preflight.ts` and `scripts/save-apply.ts` (plus tests) to `skills/b-save/scripts/` and update all references before deleting `skills/b-save-improved/`.
  rollback_or_fallback: `git revert` of the F4 commit.
  validation_path: `rg -n "b-save-improved/scripts" skills/ extensions/` returns no hit, and save script tests pass.

- failure_mode: G1 deletes `skills/b-grill-with-docs/` without relocating `ADR-FORMAT.md` and `CONTEXT-FORMAT.md` and updating `skills/b-docs/SKILL.md`.
  impact: `b-docs` and `b-grill` reference missing format templates.
  mitigation: move `ADR-FORMAT.md` and `CONTEXT-FORMAT.md` into `skills/b-grill/`, update `skills/b-docs/SKILL.md` and `GLOBAL_OR_PROJECT-AGENTS.md`, and keep `prompts/b-grill-me.md` and `prompts/b-grill-with-docs.md` loading `../skills/b-grill/SKILL.md`.
  rollback_or_fallback: `git revert` of the G1 commit.
  validation_path: `test -f skills/b-grill/ADR-FORMAT.md && test -f skills/b-grill/CONTEXT-FORMAT.md` and `rg -n "b-grill-with-docs/(ADR|CONTEXT)-FORMAT" skills/ GLOBAL_OR_PROJECT-AGENTS.md AGENTS.md` returns no hit.

## Scope

All duplicate, half-migrated, helper-only, and repo-misfit skills identified in the viability ranking and the 2026-11-16 overlap audit. Each applied todo updates its `README.md` and `docs/buck-workflow.md` rows, `prompts/` + `commands/` symlinks when applicable, and the Codex bundle when that skill is in `scripts/codex-plugin.test.ts`.

## Out of scope

- Deleting `/b-build-hard` (intentional thin prompt wrapper over `b-build` hard mode).
- Collapsing the 6 portable review skills (`b-review`, `code-review-universal`, `adversarial-review`, `code-review`, `b-pr-review-2-issues`, `fix-pr`).
- Collapsing the 3 visualization skills (`plan-synopsis`, `b-blueprint`, `b-present`).
- Touching `extensions/b-kamal-release/` unless X2 is explicitly `do`.
- `product-tour`, `pi-rpc`, `skill-explainer`, or `b-design-palette` removal.

## Affected files

Touched only by the todo that names them:

- `prompts/omp-{goal,orchestrate,workflow}.md` and their `commands/` symlinks
- `skills/design-brief/`, `plugins/buck-workflow/skills/design-brief/`
- `skills/cross-platform-pi-omp-loading/slash-command-mirror/`
- `skills/crawl4ai/`, `plugins/buck-workflow/skills/crawl4ai/`, `skills/b-research/SKILL.md`
- `skills/b-save/`, `skills/b-save-improved/`, `skills/deprecated-b-save/`, `prompts/b-save-improved.md`, `prompts/deprecated-b-save.md`, `commands/deprecated-b-save.md`, `extensions/b-save/`, `extensions/buck-loop/`
- `skills/b-create-styleguide/`, `skills/b-create-ux-guide/`, `plugins/buck-workflow/skills/b-create-ux-guide/`
- `skills/git-clean-orphans/`, `plugins/buck-workflow/skills/git-clean-orphans/`, `prompts/git-clean-orphans.md`
- `skills/git-commit/`, `skills/git-commit-improved/`, `prompts/b-commit-improved.md`, `extensions/b-commit-improved/`
- `skills/b-memory-import/`, `skills/b-hindsight-import-projects/`, `plugins/buck-workflow/skills/b-hindsight-import-projects/`
- `skills/b-capture/`, `skills/thought-dump-writer/`, `plugins/buck-workflow/skills/thought-dump-writer/`
- `skills/code-review/SKILL.md`
- `skills/b-grill/`, `skills/b-grill-me/`, `skills/b-grill-with-docs/`, `plugins/buck-workflow/skills/b-grill-me/`, `plugins/buck-workflow/skills/b-grill-with-docs/`, `prompts/b-grill-me.md`, `prompts/b-grill-with-docs.md`, `skills/b-docs/SKILL.md`, `GLOBAL_OR_PROJECT-AGENTS.md`
- `skills/rails-app/`, `skills/llm-wiki-vault/`, `skills/cross-platform-pi-omp-loading/`, `skills/node5-code-review/`, `skills/manage-herdr-panes/`
- `prompts/b-kamal-release.md`, `prompts/product-tour.md` only if an X todo is set to `do`
- `README.md`, `docs/buck-workflow.md`, `scripts/codex-plugin.test.ts`, `AGENTS.md`

## How to update this list

Edit the todo. Do not renumber ids.

| Status | Meaning |
|---|---|
| `recommended` | Default from the audit. Not started. |
| `do` | Operator accepted the recommendation. Safe to apply. |
| `keep` | Operator rejected the recommendation. Leave the surface. |
| `skip` | Not this pass. |
| `done` | Applied and the done-when check passed. Check the box. |

One `done` todo per commit (or one cohesive phase commit after `/skill:b-phase`).

## Implementation steps

### Docs that pretend to be commands

- [x] **D1** Status: `done`
  - Action: stop shipping `/omp-goal`, `/omp-orchestrate`, and `/omp-workflow` as slash commands. Copy the goal-mode 6-step protocol and the harness no-op notes into `docs/buck-workflow.md` first. Then delete `prompts/omp-goal.md`, `prompts/omp-orchestrate.md`, `prompts/omp-workflow.md` and the matching `commands/` symlinks.
  - Why: writing scores 0.06 and 0.10, confidence 0.92–0.95. The bodies both enter a mode and say they cannot.
  - Done when: those six paths are gone; `npx vitest run scripts/commands-mirror.test.ts` passes; the protocol grep in R1's sibling risk (the omp-goal validation path above) hits the doc.
  - Verified 2026-10-03: all six prompt/command paths are absent, including dangling symlinks; `docs/buck-workflow.md:138-158` preserves the 6-step completion-audit and completion evidence rule; `npx vitest run scripts/commands-mirror.test.ts` passed all 4 tests. Save and commit remain separate checkpoints.

### Fold a duplicate into the sibling that stays

- [x] **F1** Status: `done`
  - Action: delete `skills/design-brief/` and `plugins/buck-workflow/skills/design-brief/`. Point any "make a UI brief" instruction at `b-create-styleguide`. Remove `design-brief` from `scripts/codex-plugin.test.ts` `canonicalCopies`.
  - Do not touch: `skills/_shared/design-brief.jsonc`, `skills/_shared/themes/**/design-brief.jsonc`, or the design-language tests.
  - Why: distinct 0.10, confidence 0.92.
  - Done when: skill dirs are gone, JSONC file still exists, `npx vitest run scripts/codex-plugin.test.ts skills/_shared/scripts/design-language.test.ts` passes.
  - Verified 2026-11-16: `test ! -d skills/design-brief && test ! -d plugins/buck-workflow/skills/design-brief && test -f skills/_shared/design-brief.jsonc` passed; `skills/b-design-palette/SKILL.md` points at `b-create-styleguide`; `npx vitest run scripts/codex-plugin.test.ts skills/_shared/scripts/design-language.test.ts` passed (22/22 tests).

- [x] **F2** Status: `done`
  - Action: move any unique symlink steps from `skills/cross-platform-pi-omp-loading/slash-command-mirror/SKILL.md` into the parent `SKILL.md`, then delete the child directory. Update the parent link and `docs/buck-workflow.md` line that cites the child path.
  - Why: distinct 0.65, fit 1.08, 0 mentions.
  - Done when: the child directory is gone and the parent still states the `prompts/` ↔ `commands/` symlink rule.
  - Verified 2026-11-16: `test ! -d skills/cross-platform-pi-omp-loading/slash-command-mirror` passed; `skills/cross-platform-pi-omp-loading/SKILL.md` §3a documents the `commands/<name>.md -> ../prompts/<name>.md` symlink procedure and `scripts/commands-mirror.test.ts` guard.

- [x] **F3** Status: `done`
  - Action: fold the install/bootstrap section of `skills/crawl4ai/SKILL.md` into `skills/b-research/SKILL.md` as a short optional paragraph. Delete `skills/crawl4ai/` and `plugins/buck-workflow/skills/crawl4ai/`. Remove `crawl4ai` from the Codex allowlist.
  - Why: fit 1.26, confidence 0.78. It is third-party CLI notes.
  - Done when: `rg -n "skills/crawl4ai" skills/b-research` is empty, and the Codex test passes.
  - Verified 2026-11-16: `test ! -d skills/crawl4ai && test ! -d plugins/buck-workflow/skills/crawl4ai` and `! rg -n "skills/crawl4ai" skills/b-research/SKILL.md` passed; `npx vitest run scripts/codex-plugin.test.ts` passed.

- [x] **F4** Status: `done`
  - Action: consolidate `b-save`, `b-save-improved`, and `deprecated-b-save` into a single canonical `skills/b-save/`. Move `skills/b-save-improved/scripts/save-preflight.ts` and `save-apply.ts` (and their tests) into `skills/b-save/scripts/`. Update `skills/b-save/SKILL.md` to document both the `extensions/b-save/index.ts` deterministic path and the cross-platform script/prompt fallback (including `--dry-run`, `--archive-inferred`, `--subject`, `--no-retain`, `--model`). Update all script path references across `skills/`, `extensions/`, and tests. Repoint `prompts/b-save-improved.md` to `../skills/b-save/SKILL.md`. Delete `skills/b-save-improved/`, `skills/deprecated-b-save/`, `prompts/deprecated-b-save.md`, and `commands/deprecated-b-save.md` (and any Codex copies).
  - Why: three skills currently describe the same 12-step checkpoint with contradictory claims about extension backing (`extensions/b-save/index.ts` is the live extension; `extensions/b-save-improved/` no longer exists).
  - Done when: `test ! -d skills/b-save-improved && test ! -d skills/deprecated-b-save && test ! -e prompts/deprecated-b-save.md && test ! -L commands/deprecated-b-save.md && test -f skills/b-save/scripts/save-preflight.ts && test -f skills/b-save/scripts/save-apply.ts`, and `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts` passes.
  - Verified 2026-11-16: all deleted paths absent and `skills/b-save/scripts/save-preflight.ts` + `save-apply.ts` present; `! rg -n "b-save-improved/scripts" skills/ extensions/` passed; `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts skills/b-save/scripts/save-preflight.test.ts skills/b-save/scripts/save-apply.test.ts extensions/buck-loop/__tests__/sql-save-adapters.test.ts` passed.

- [x] **F5** Status: `done`
  - Action: fold `b-create-ux-guide`'s non-interactive / section-scoped component inventory mode (`--inventory-only` or when the user asks for an analytical UX inventory without `AGENTS.md` wiring) and its HTML research guide deliverable into `skills/b-create-styleguide/SKILL.md`. Delete `skills/b-create-ux-guide/` and `plugins/buck-workflow/skills/b-create-ux-guide/`. Remove `b-create-ux-guide` from `scripts/codex-plugin.test.ts` `canonicalCopies`. Keep `b-design-palette` separate.
  - Why: `b-create-styleguide` already uses `b-create-ux-guide`'s 12-category component taxonomy and `design-brief.json` schema while adding interactive creation, foundation sections, and idempotent refresh.
  - Done when: `test ! -d skills/b-create-ux-guide && test ! -d plugins/buck-workflow/skills/b-create-ux-guide`, `b-create-styleguide/SKILL.md` documents the inventory-only mode, and `npx vitest run scripts/codex-plugin.test.ts` passes.
  - Verified 2026-11-16: `test ! -d skills/b-create-ux-guide && test ! -d plugins/buck-workflow/skills/b-create-ux-guide` passed; `rg -n -- "--inventory-only" skills/b-create-styleguide/SKILL.md` matched; `npx vitest run scripts/codex-plugin.test.ts` passed.

- [x] **F6** Status: `done`
  - Action: repoint `prompts/git-clean-orphans.md` directly to `../skills/git-cleanup/SKILL.md`. Delete the 17-line redirect skill `skills/git-clean-orphans/` and `plugins/buck-workflow/skills/git-clean-orphans/` (if present), and remove `git-clean-orphans` from `scripts/codex-plugin.test.ts` if listed.
  - Why: `skills/git-clean-orphans/SKILL.md` is purely a redirect to `git-cleanup`; keeping the prompt alias preserves `/git-clean-orphans` without exposing two identical skills in agent catalogs.
  - Done when: `test ! -d skills/git-clean-orphans`, `prompts/git-clean-orphans.md` references `skills/git-cleanup/SKILL.md`, and `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts` passes.
  - Verified 2026-11-16: `test ! -d skills/git-clean-orphans` and `rg -n "skills/git-cleanup/SKILL.md" prompts/git-clean-orphans.md` passed; `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts` passed.

- [x] **F7** Status: `done`
  - Action: fold `skills/git-commit-improved/` into `skills/git-commit/` (matching the `b-pr` pattern where one skill owns both the portable instructions and the deterministic `scripts/commit-preflight.ts`). Move `skills/git-commit-improved/scripts/*` into `skills/git-commit/scripts/`, update `extensions/b-commit-improved/` and `prompts/b-commit-improved.md` to reference `skills/git-commit/`, and delete `skills/git-commit-improved/` (plus any Codex copy).
  - Why: `b-pr` already proves one skill directory can back both `/b-pr` and `/b-pr-improved`; splitting `git-commit` and `git-commit-improved` across two skill folders is redundant.
  - Done when: `test ! -d skills/git-commit-improved && test -f skills/git-commit/scripts/commit-preflight.ts`, and `npx vitest run` for commit-improved / codex-plugin / commands-mirror passes.
  - Verified 2026-11-16: `test ! -d skills/git-commit-improved && test -f skills/git-commit/scripts/commit-preflight.ts` passed; `npx vitest run extensions/b-commit-improved/__tests__/wire.test.ts scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts` passed.

- [x] **F8** Status: `done`
  - Action: (a) fold `skills/b-hindsight-import-projects/` into `skills/b-memory-import/` as its multi-project `--roots` mode (moving `skills/b-hindsight-import-projects/scripts/*` into `skills/b-memory-import/scripts/`) and delete `skills/b-hindsight-import-projects/`; (b) fold `skills/thought-dump-writer/` into `skills/b-capture/SKILL.md` as its single-file + per-turn git-checkpoint mode (`--single-file <path>`) and delete `skills/thought-dump-writer/`; (c) strip the leftover project-specific `## Notes on this project` section (lines 199–211 mentioning `wiki/`, Drizzle, and Supabase) from `skills/code-review/SKILL.md`. Update Codex copies and `scripts/codex-plugin.test.ts` as needed.
  - Why: removes two single-parent/mode-variant skills and cleans project-specific residue out of `code-review`.
  - Done when: `test ! -d skills/b-hindsight-import-projects && test ! -d skills/thought-dump-writer`, `rg -n "Drizzle|Supabase" skills/code-review/SKILL.md` returns no hit, and `npx vitest run scripts/codex-plugin.test.ts` passes.
  - Verified 2026-11-16: `test ! -d skills/b-hindsight-import-projects && test ! -d skills/thought-dump-writer && test -f skills/b-memory-import/scripts/import-projects.ts` and `! rg -n "Drizzle|Supabase" skills/code-review/SKILL.md` passed; `bun test skills/b-memory-import/scripts/import-projects.test.ts` (15/15) and `npx vitest run scripts/codex-plugin.test.ts` passed.

### Unify the grill family into `b-grill` (domain docs on by default, `--no-docs` to opt out)

- [x] **G1** Status: `done`
  - Action: consolidate `skills/b-grill/`, `skills/b-grill-me/`, and `skills/b-grill-with-docs/` into a single canonical `skills/b-grill/SKILL.md`:
    1. Make **domain-documentation awareness (`CONTEXT.md` + `docs/adr/` challenge, glossary sharpening, and inline updates) the default behavior** of `b-grill` in user mode.
    2. Require an explicit **`--no-docs`** flag to skip `CONTEXT.md` / `docs/adr/` lookups and inline documentation writes.
    3. Merge the `workflow_state` access header, Jev `turn_class` classification (`direct_answer`, `addendum`, `arbitrary`), Material Decision Closeout, Metadata Tracking, Document Mode, Workflow-Kernel Cell auto-derive, and `--mode user|auto` (`grill.py`) into `skills/b-grill/SKILL.md`.
    4. Move `skills/b-grill-with-docs/ADR-FORMAT.md` and `skills/b-grill-with-docs/CONTEXT-FORMAT.md` into `skills/b-grill/`, and update all references in `skills/b-docs/SKILL.md`, `GLOBAL_OR_PROJECT-AGENTS.md`, and `AGENTS.md`.
    5. Repoint `prompts/b-grill-me.md` and `prompts/b-grill-with-docs.md` to load `../skills/b-grill/SKILL.md` (`b-grill-me.md` runs default docs-aware user mode and passes through `--no-docs` when supplied; `b-grill-with-docs.md` remains a backwards-compatible alias for the default user mode).
    6. Delete `skills/b-grill-me/` and `skills/b-grill-with-docs/` (plus `plugins/buck-workflow/skills/b-grill-me/` and `plugins/buck-workflow/skills/b-grill-with-docs/`), and update `scripts/codex-plugin.test.ts`, `README.md`, and `docs/buck-workflow.md`.
  - Why: eliminates ~400 lines of three-way copy-paste drift while making domain-doc alignment the standard grilling contract unless `--no-docs` is passed.
  - Done when: `test -d skills/b-grill && test -f skills/b-grill/grill.py && test -f skills/b-grill/ADR-FORMAT.md && test -f skills/b-grill/CONTEXT-FORMAT.md && test ! -d skills/b-grill-me && test ! -d skills/b-grill-with-docs`, `rg -n "--no-docs" skills/b-grill/SKILL.md` hits, and `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts` passes.
  - Verified 2026-11-16: `skills/b-grill/` (and `plugins/buck-workflow/skills/b-grill/`) contains `SKILL.md`, `grill.py`, `ADR-FORMAT.md`, and `CONTEXT-FORMAT.md`; `skills/b-grill-me/` and `skills/b-grill-with-docs/` (and Codex copies) are deleted; `rg -n -- "--no-docs" skills/b-grill/SKILL.md` matches; `! rg -n "b-grill-with-docs/(ADR|CONTEXT)-FORMAT" skills/ GLOBAL_OR_PROJECT-AGENTS.md AGENTS.md docs/buck-workflow.md` passed; `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts` passed (10/10 tests).

### Move or remove project/environment-specific skills from the portable package

For external moves (`M1`, `M2`, `M5`), fill `Destination:` before executing the move (A-3). `M3` and `M4` have in-repo resolution and are ready now.

- [ ] **M1** Status: `do` Destination:
  - Action: move `skills/rails-app/` to `Destination:` once specified. Drop the README row and Codex copy if any.
  - Why: fit 0.33, 0 mentions. One app's footguns (`pp-*`, `snapselect`, `magic_links`).
  - Done when: the skill is not under this repo's `skills/` and the destination has the file.

- [ ] **M2** Status: `do` Destination:
  - Action: move `skills/llm-wiki-vault/` to `Destination:` once specified. Drop the README row and the `AGENTS.md` vault-wiki paragraph.
  - Why: distinct 3.72, fit 0.21, confidence 0.82. Unique job tied to `~/Documents/second brain`.
  - Done when: this repo no longer contains the skill or the `AGENTS.md` advertisement.

- [ ] **M3** Status: `do` Destination: `docs/cross-platform-pi-omp-loading.md`
  - Action: move the parent skill body (after F2) to `docs/cross-platform-pi-omp-loading.md`. Delete `skills/cross-platform-pi-omp-loading/`. Update docs that link the skill path.
  - Why: fit 1.00, confidence 1.00. Maintainer meta documentation, not a runtime task skill.
  - Depends on: F2 `done`.
  - Done when: no `skills/cross-platform-pi-omp-loading/` directory, and `docs/cross-platform-pi-omp-loading.md` exists.

- [ ] **M4** Status: `do` Destination: `delete (superseded by b-review and code-review-universal)`
  - Action: delete `skills/node5-code-review/` (and any Codex copy if present) and remove its catalog rows from `README.md` and `docs/buck-workflow.md`.
  - Why: viability 0.19, fit 0.08 (confidence 0.93). Hardcoded to the `node5` project and superseded by portable reviewers.
  - Done when: `test ! -d skills/node5-code-review` and `rg -n "node5-code-review" README.md docs/` returns no live catalog hits.

- [ ] **M5** Status: `do` Destination:
  - Action: move `skills/manage-herdr-panes/` to `Destination:` once specified (e.g. personal `~/.agents/skills/` or Herdr repo) and drop its README row.
  - Why: requires `HERDR_ENV=1`; environment-specific cookbook in a portable workflow package.
  - Done when: `skills/manage-herdr-panes/` is moved to `Destination:` and removed from `README.md`.

### Decide, do not apply the default

- [ ] **X2** Status: `keep`
  - Surface: `/b-kamal-release` plus `extensions/b-kamal-release/`. Fit confidence 0.27. One mention. Wired in `extensions/index.ts`.
  - Leave it. Set Status to `do` only with a written destination and a note that the extension wire must be removed in the same commit.

- [ ] **X3** Status: `keep`
  - Surface: `product-tour`. Partially scored (fit 1.99 only). Unused here, not a duplicate.
  - Leave it.

## Acceptance criteria

- [ ] Every todo is `keep`, `skip`, or `done`. None left at `recommended` or `do`.
- [ ] Each `done` todo has its done-when check recorded as passed in the todo body.
- [ ] `skills/_shared/design-brief.jsonc` still exists.
- [ ] `skills/b-grill/SKILL.md` is the single canonical grill skill with domain docs enabled by default, `--no-docs` documented to opt out, and `ADR-FORMAT.md` + `CONTEXT-FORMAT.md` co-located in `skills/b-grill/`.
- [ ] `skills/b-save/SKILL.md` is the single canonical save skill with `save-preflight.ts` and `save-apply.ts` under `skills/b-save/scripts/`.
- [ ] `npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts` passes after the last `done` todo that touches those surfaces.
- [ ] README and `docs/buck-workflow.md` do not name a skill or command this plan deleted.

## Verification

Per todo, the done-when line is the check. After the last applied todo, run:

```bash
npx vitest run scripts/commands-mirror.test.ts scripts/codex-plugin.test.ts
rg -n "skills/design-brief/|skills/b-grill-me/|skills/b-grill-with-docs/|skills/crawl4ai|skills/b-save-improved/|skills/deprecated-b-save/|skills/b-create-ux-guide/|skills/git-clean-orphans/|skills/git-commit-improved/|skills/b-hindsight-import-projects/|skills/thought-dump-writer/|skills/node5-code-review/|prompts/omp-goal|prompts/omp-orchestrate|prompts/omp-workflow" README.md docs/buck-workflow.md
```

The `rg` must not hit a path this plan deleted. Hits for `prompts/b-grill-me.md`, `prompts/b-grill-with-docs.md`, and `design-brief.jsonc` are expected.

## Execution Instructions

Recommended next step: re-run `/skill:b-phase` to regenerate the discrete phase files for F1–F8, G1, and M1–M5, then execute phase by phase with `/b-build`.

1. Re-run `/skill:b-phase` so `plan-viability-cleanup-phases.md` and `phase-N-*.md` match the updated plan.
2. Apply each phase or `do` todo, run its done-when check, mark `done`, and commit.
3. For external moves (`M1`, `M2`, `M5`), confirm `Destination:` before moving files out of the repo.

## Risks

- A half-updated README row points at a deleted skill. Each todo owns its rows so a stopped walk stays consistent for `done` items only.
- Relocating scripts (`save-preflight.ts`, `save-apply.ts`, `commit-preflight.ts`) or format templates (`ADR-FORMAT.md`, `CONTEXT-FORMAT.md`) without updating every caller breaks runtime execution. Grep across `skills/`, `extensions/`, `prompts/`, and `GLOBAL_OR_PROJECT-AGENTS.md` before deleting old directories.

## Revision Log

### 2026-11-16 — Accept 2026-11-16 overlap audit and unify `b-grill` around domain-docs by default (`--no-docs` opt-out)
- Added: F4 (`b-save` + `b-save-improved` + `deprecated-b-save` → `b-save`), F5 (`b-create-ux-guide` → `b-create-styleguide`), F6 (`git-clean-orphans` skill redirect removal), F7 (`git-commit-improved` → `git-commit`), F8 (`b-hindsight-import-projects` → `b-memory-import`, `thought-dump-writer` → `b-capture`, and `code-review` project-notes cleanup), M4 (`node5-code-review` deletion), M5 (`manage-herdr-panes` move-out tracking), A-5 (`ADR-FORMAT.md`/`CONTEXT-FORMAT.md` relocation assumption), and material risks for F4 and G1.
- Modified: Set F1–F3, G1, and M1–M3 statuses from `recommended` to `do`; rewrote G1 so `skills/b-grill/SKILL.md` is the single canonical grill skill with domain-docs (`CONTEXT.md` + `docs/adr/`) enabled by default and `--no-docs` required to disable doc awareness (folding `b-grill-me` and `b-grill-with-docs` into `b-grill` while keeping their prompt wrappers).
- Removed: X1 (`manage-herdr-panes` keep entry) promoted to M5 (`do`, pending `Destination:`) (explicit); G1's prior "delete `b-grill` shell and keep three grill skills" course replaced by single `b-grill` skill with docs-by-default (explicit).
- Inputs: request prompt, 2026-11-16 70-skill overlap audit in session context.
