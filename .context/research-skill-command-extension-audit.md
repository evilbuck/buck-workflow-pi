---
status: active
date: 2026-09-21
subject: 2026-09-21.skill-command-extension-audit
topics: [audit, skills, prompts, commands, extensions, cleanup, overlap, deprecation]
informs: [plan-skill-surface-cleanup.md]
---

# Skill / command / extension cleanup audit

Branch: `master` @ `7dc2aaf`. Read-only. Five scouts + mainline verification.

## Summary

The live surface is large but mostly intentional layering, not rot.

| Layer | Count | Health |
|---|---:|---|
| `skills/` | 64 dirs (incl. `_shared`) | 4 project-specific; grill/review families overlap; `_shared` is a library |
| `prompts/` = `commands/` | 43 / 43 | **1:1 symlinks, test-enforced.** 2026-09-11 divergence is gone |
| Wired extensions | 8 wires + inlined model switch | Healthy |
| Unwired extension files | 3 modules | **Safe delete** |

Already gone (do not restore): `skills/b-loop/`, `extensions/b-flow/`, `xstate`. Tombstone: `docs/b-flow.md`.

## Tier 1 — safe deletes (dead code)

Verified: `extensions/index.ts` does not import any of these.

| Path | Why |
|---|---|
| `extensions/grill-me-dialog.ts` | Would register `grill-me_dialog`. Never wired. Slimdown 2026-06-05 left it on disk. |
| `extensions/tmux-window-status.ts` + `.test.ts` | Same. README already lists tmux status as unwired. |
| `extensions/b-grill-auto/` (5 TS files) | Would register `/b-grill-auto`. Never wired. Live path is `skills/b-grill-auto/` + `grill.py`. |

Also close `.context/backlog/todo.md` item “Test b-grill-auto extension in live Pi session” — there is no wired command to test.

Keep `extensions/buck-mode.test.ts`. There is no `buck-mode.ts`; the test pins the 2026-06-05 slimdown (no `/b-mode`, `/b-restrict`, `/b-save` as extension commands) and is the only coverage of inlined model auto-switch.

## Tier 2 — broken or drifted (fix, don’t delete)

| Issue | Evidence | Action |
|---|---|---|
| `/b-save` prompt is thick | `prompts/b-save.md` is 68 lines of inline procedure; **does not load** `skills/b-save/SKILL.md`. Every other workflow prompt is a 13-line loader. | Thin-wrap the skill. |
| `code-review` writes off-tree | `skills/code-review/SKILL.md:138,192` hardcodes `/mnt/c/Code/plans/review-PR-…`. | Write under `.context/` like `code-review-universal`. |
| `/code-review` name collision | Extension `registerCommand("code-review")` (local Reviewer/Fixer). Prompt loads release-PR skill. README documents the dual; **the prompt body does not**. Fresh checkout without the extension ≠ loaded-extension session. | One-liner in `prompts/code-review.md`, or rename the extension command. |
| Duplicate `grill.py` | `skills/b-grill/grill.py` and `skills/b-grill-auto/grill.py`. | One copy after grill cleanup. |
| README Prompt Templates table incomplete | Skills table lists `product-tour` and `git-clean-orphans`; both have thin prompts; Prompt Templates table (`README.md:220-250`) omits them. Also omits `/b-build-hard`, `/b-docs`, `omp-{goal,orchestrate,workflow}`. | Add rows or point at Extension-Backed / Pure Prompt / OMP-stub sub-tables. |
| `AGENTS.md` “Available Skills” | Only names `llm-wiki-vault`, `b-save`, `b-memory-import`. | Rename to “Notable Skills” + pointer to README. |

Rejected scout claim: catalogs C9 said `README.md:294` marks `b-diagnose` as skill-only. It does not. `/b-diagnose` is in the Prompt Templates table.

## Tier 3 — project-specific in a portable package (user call)

These ship in `skills/` of the npm package and have **no in-package callers** (README catalog lines only).

| Skill | Binding |
|---|---|
| `node5-code-review` | Hardcoded “node5 project”; self-describes as complement to `code-review`. Strongest delete/move candidate. |
| `rails-app` | App tokens (`pp-*`, `snapselect`, `magic_links`). |
| `llm-wiki-vault` | Vault path `/home/buckleyrobinson/Documents/second brain`. |
| `manage-herdr-panes` | Requires `HERDR_ENV=1`. |

`/b-kamal-release` is extension-only (no skill fallback). Keep if Kamal deploys are in-scope for this package; otherwise it is the only `/b-*` with no portable path.

## Tier 4 — overlap that is mostly intentional

Do **not** collapse these without an explicit product decision.

**Review (keep distinct):** `b-review` (workflow gate) ≠ `code-review-universal` (language-depth + GitHub post) ≠ `code-review` + `code-review-iteration` (local loop) ≠ `b-pr-review-2-issues` (comments → plan) ≠ `fix-pr` (comments → act). Only `node5-code-review` is junk in this family.

**Improved twins (keep both):** portable skill/prompt + deterministic extension.

- `/b-save` ↔ `/b-save-improved`
- `/b-commit` (`git-commit`) ↔ `/b-commit-improved`
- `/b-pr` ↔ `/b-pr-improved`

**Grill (real overlap, no single DELETE):** four skills (`b-grill`, `b-grill-me`, `b-grill-auto`, `b-grill-with-docs`). Unified shell is catalogued (`README.md:321`, `docs/buck-workflow.md:65,733-743`). Children have the actual prompts (`/b-grill-me`, `/b-grill-with-docs`). Scouts disagreed on which child to delete. Recommendation: delete **unwired extensions** (Tier 1); leave the four skills until you pick a canonical entry.

**Capture:** `thought-dump-writer` explicitly carves out vs `b-capture` (single living file + git checkpoint vs multi-file raw tree). Tension with the 2026-09-18 lock “`b-capture` has no sibling.” Flag, don’t auto-merge.

**Keep-distinct (documented boundaries):** explore/research/arch-qa/skill-explainer/crawl4ai; recap/handoff/save; memory-import vs hindsight-import-projects; b-docs/b-howto/writing-for-agents; b-diagnose vs code-smells; b-blueprint vs b-present; tracker pipeline (init-tracker → triage → issue-create → auto-fix, plus b-backlog); design-brief / ux-guide / styleguide / codebase-design.

**`_shared`:** loadable `SKILL.md` that is a library (`skill://_shared/…`). Keep files; stop listing it as a user skill.

## What is healthy

- 32/43 prompts are thin `Load and follow skills/<name>/SKILL.md` wrappers.
- `omp-{goal,orchestrate,workflow}` are intentional no-op stubs (`AGENTS.md`).
- `b-build-hard` → `b-build` with hard difficulty.
- Wired: tps-tracker, plan-artifact (opt-in), b-pr/commit/save-improved, b-kamal-release, code-review-iteration, buck-loop, model auto-switch.
- Helpers in use: `subprocess.ts`, `state-machine.ts`, `omp-models.ts`, `extension-activity.ts`.
- Tombstones for b-flow / b-mode / b-loop / memory-manager / spec-progress are consistent. No live `/b-flow` or `/skill:b-loop`.
- Codex plugin is a **curated 31/64** subset, test-enforced — not drift.

## Recommended next slice

One cleanup plan, in this order:

1. Delete the three unwired extension modules (Tier 1) + close the grill-auto live-test backlog item.
2. Thin `prompts/b-save.md`; fix `code-review` output path; document `/code-review` dual in the prompt.
3. User call on project-specific skills (move vs keep-as-reference).
4. Catalog rows only after 1–3 so README is not churned twice.

## Scout notes (detail)

- `research/notes-inventory.md`
- `research/notes-skills.md` — 64-skill table; **over-deletes** `b-grill`, `crawl4ai`, `skill-explainer`, `pi-rpc` (those have catalog/callers).
- `research/notes-prompts-commands.md`
- `research/notes-extensions.md`
- `research/notes-overlap.md`
- `research/notes-catalogs.md` — C9 (`b-diagnose` skill-only) is **false**.
