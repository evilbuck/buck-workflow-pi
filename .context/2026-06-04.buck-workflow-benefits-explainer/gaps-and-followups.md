---
status: active
date: 2026-06-04
subject: 2026-06-04.buck-workflow-benefits-explainer
topics: [buck-workflow, gaps, followups, improvements]
---

# Gaps and Follow-ups

Separate notes for holes, confusing areas, or improvement ideas found while exploring Buck workflow. These are **not** intended for the stakeholder presentation unless explicitly promoted later.

## Gaps Found So Far

- [ ] **QMD collection helper unavailable in non-interactive shell** — bootstrap guidance references `get_qmd_collection`, but the shell function was not available in the bash tool. The workflow has manual fallback, but this may confuse agents following the docs literally.
- [ ] **Plan mode documentation appears stale vs extension code** — `docs/buck-workflow.md` says `/b-plan`, `/b-brainstorm`, `/b-explore`, `/b-research`, and grill commands automatically enable plan mode. `extensions/index.ts` currently activates Buck workflow mode for those commands but does not set `plan_mode_active`; comments say plan mode is manual-only via `/b-mode on|off` or `alt+p`. Need decide intended behavior and update either docs or code.
- [ ] **`/b-save` prompt says “Execute all 9 steps” after listing 10 responsibilities** — `extensions/index.ts` lists 10 responsibilities but the final instruction says 9. Minor but potentially confusing.
- [ ] **No standalone `skills/b-save/SKILL.md`** — this may be intentional because `/b-save` is an extension command, but the rest of the workflow is skill-backed. If people expect all major workflow pieces to be skills, consider documenting why save is extension-only or extracting the prompt into a reference/skill-like artifact. Backlog item created: `.context/backlog/items/extract-b-save-skill.md`.
- [ ] **`b-present` frontmatter description omits b-explore** — `skills/b-present/SKILL.md` “When to Use” includes after `b-explore`, but the frontmatter description mentions after b-plan/b-phase/b-brainstorm/b-research only. Minor discoverability inconsistency.
- [ ] **Bash inventory command hit `printf` option parsing issue** — while summarizing skill headers, `printf "--- %s ---\n"` was interpreted as an option in `sh`. Use `printf '%s\n' "--- $file ---"` for future shell snippets.
- [ ] **Memory validation found pre-existing files without YAML frontmatter** — `model-cycle-abort-plan-2026-05-09.md`, `pi-coding-agent-hang-2026-05-09.md`, and `pi-rpc-skill-2026-05-16.md` lack `---` frontmatter markers. Not part of this presentation work, but violates current memory quality guidance.

## Watchlist While Exploring

- [ ] Look for places where README, docs, skills, and extension behavior describe Buck workflow differently.
- [ ] Identify any unclear distinction between durable memory, subject folders, backlog, and workflow runtime state.
- [ ] Identify places where benefits are implied but not stated in user-facing terms.
