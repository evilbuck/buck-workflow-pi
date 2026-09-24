---
date: 2026-09-23
domains: [skill, docs, design-system]
topics: [design-brief, blueprint-theme, shared-skill, guardrails-override]
related:
  - skills/_shared/design-brief.jsonc
  - skills/_shared/themes/blueprint/design-brief.jsonc
priority: medium
status: completed
subject: null
artifacts:
  - skills/_shared/themes/blueprint/design-brief.jsonc
  - skills/_shared/themes/README.md
  - skills/_shared/SKILL.md
  - plugins/buck-workflow/skills/_shared/themes/blueprint/design-brief.jsonc
  - plugins/buck-workflow/skills/_shared/SKILL.md
---

# Second design-brief theme: blueprint

## Outcome

Added `skills/_shared/themes/blueprint/design-brief.jsonc` — a second, dark
"architectural blueprint" design language, alongside (not replacing) the
canonical warm-paper `skills/_shared/design-brief.jsonc`. Reference
implementation is `presentations/ai-factory-planning-deck.html` in the
Employ/AI-Factory repo (a 12-sheet live facilitation deck), authored earlier
in the same session.

- Same schema as the default brief (`source`, `token_groups`, `typography`,
  `layout`, `components`, `interaction_states`, `modes`, `responsive`,
  `mermaid`, `accessibility`, `assumptions`, `ambiguities`); parses cleanly
  through the existing `stripJsonComments` loader.
- New file lives at `themes/<name>/design-brief.jsonc` (not
  `themes/blueprint.jsonc`) so every theme — default included — shares the
  same filename, differing only by directory.
- `skills/_shared/design-brief.jsonc`, `scripts/render-design-tokens.ts`,
  `scripts/design-language.test.ts`, and both existing consumer templates
  (`b-blueprint`, `b-present`) are untouched. The blueprint theme has zero
  consumers today; its own `ambiguities` entry documents what a `--brief`-flag
  extension to the renderer would need if a second consumer ever needs
  generated-token splicing.
- `themes/README.md` documents both themes and the rule for adding another;
  `SKILL.md` gained one pointer row plus a short paragraph.

## Decisions

- User explicitly rejected overwriting/renaming the canonical `design-brief.jsonc` — the new theme is strictly additive.
- Filename must contain `design-brief` per the user's literal request ("codify this in a design-brief.jsonc"); resolved as `themes/blueprint/design-brief.jsonc` rather than `themes/blueprint.jsonc`.

## Verification / Guardrails

- `bunx vitest run skills/_shared/scripts/design-language.test.ts` — 16/16 pass throughout (this addition never touches the pinned default-brief pipeline).
- First discovered this branch surfaced 10 pre-existing, unrelated macOS `/tmp`-symlink realpath test failures (`serve-presentations.test.ts`, `hooks.test.mjs`, `git-ops.test.ts`) that predate 2026-09-23. Per explicit user decision, fixed all three on a separate branch, `fix/macos-tmp-symlink-realpath` (commit `a0bf7b5`, based on `master`) — full detail in `.context/backlog/archive/2026-09/macos-tmp-symlink-test-failures.md`.
- Rebased this theme branch onto `a0bf7b5` so it carries the fix rather than merely coexisting with it elsewhere.
- Rebasing surfaced a second, genuine gate: `scripts/codex-plugin.test.ts`'s curated-bundle parity contract requires `plugins/buck-workflow/skills/_shared/` to be a byte-identical, path-identical physical mirror of `skills/_shared/`. Adding `themes/` and editing `SKILL.md` broke that parity (2 failures: recursive path parity, byte-identity) until the same two changes were copied into the bundle mirror.
- **Final verified state**, run serially (vitest, then guardrails, with no branch checkout/rebase in between): full suite 942/942; `/b-guardrails-check` `status: pass` — `unit_test_gate` pass, `global_ratchet` pass, `complexity_gate` pass, coverage 85.6%.
