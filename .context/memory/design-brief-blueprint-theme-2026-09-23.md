---
date: 2026-09-23
domains: [skill, docs, design-system]
topics: [design-brief, blueprint-theme, shared-skill, guardrails-override]
related:
  - skills/_shared/design-brief.jsonc
  - skills/_shared/themes/blueprint/design-brief.jsonc
priority: medium
status: active
subject: null
artifacts:
  - skills/_shared/themes/blueprint/design-brief.jsonc
  - skills/_shared/themes/README.md
  - skills/_shared/SKILL.md
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

- `bunx vitest run skills/_shared/scripts/design-language.test.ts` — 16/16 pass, unaffected (this addition doesn't touch the pinned default-brief pipeline).
- `skills/b-guardrails-check/scripts/check.mjs` on the repo root returns `status: fail` (`global_ratchet`/`unit_test_gate`), **not caused by this change**. Confirmed pre-existing by stashing all of this session's edits and re-running on clean `cf086f4`: **10 tests fail across 3 files** even with nothing changed —
  - `scripts/serve-presentations.test.ts` (5 failures) — `resolveRequestPath` compares a `realpathSync`'d target against a non-realpath'd root; macOS `os.tmpdir()` sits under `/var/folders/...`, a symlink to `/private/var/folders/...`, so every legitimate nested request path fails containment and 403s. I fixed this (realpath the root too, one try/catch) and updated the two test expectations that hardcoded the non-realpath'd form — full green (26/26) in isolation — **then reverted both files** to keep this session's diff isolated to the theme addition, since fixing it did not by itself get the overall gate to pass (two more pre-existing, unrelated failing files remained) and a partial unrelated fix has no contract value on its own.
  - `scripts/hooks.test.mjs` (4 failures) — same `/tmp` → `/private/tmp` realpath-vs-lexical mismatch for `resolveHooksDir`, plus one unrelated `stat -c %a` (GNU-only flag; fails silently as an empty string on macOS BSD `stat`).
  - `extensions/code-review-iteration/__tests__/git-ops.test.ts` (1 failure) — disposable detached worktree cleanup; not investigated (out of scope for this task).
- Net: this task's actual diff (`skills/_shared/themes/**`, `skills/_shared/SKILL.md`) is guardrails-neutral — it neither introduces nor fixes any of the 10 pre-existing failures. The `unit_test_gate`/`global_ratchet` `fail` verdict predates this session and spans an unrelated macOS path-handling class of bug across three subsystems; fixing all of it was judged disproportionate scope for a design-brief addition. **Explicit user override requested and pending** for this gate; record the user's decision here once given (fix as separate follow-up work vs. accept override).
