---
status: completed
date: 2026-09-11
updated: 2026-09-11
subject: 2026-09-11.html-deliverable-design-language
topics: [review, iteration, design-language, patch-coverage]
informs: []
addresses: index.md
completed: 2026-09-11
from_review: b-review
---

# Iteration: html-deliverable-design-language

## Source
- Reviewed after: `/b-build`
- Plan: none (`index.md` used as acceptance contract)
- Spec: none

## Critical Issues

### 1. `--write` path has no tests — patch gate 66% vs 90%
- **File**: `skills/_shared/scripts/render-design-tokens.ts:127-165`
- **Problem**: Vitest covers render/parse/extract/load (8 tests, all green). `spliceGeneratedBlock`, `writeConsumers`, and `main` (`--write` / `--css` / `--mermaid` / default print) are never called. Coverage on this file is 64.61% lines (uncovered 128–162). Guardrails patch gate against `origin/master` is **66.2% / 90%** (`patch_gate: fail`). The file is the only new production TypeScript in the diff, so this is the patch miss. `--write` itself works (this review: `already up to date`).
- **Proposed fix**: Keep the 90% threshold. Export nothing extra if a subprocess test is cleaner. Add tests that:
  1. Call `spliceGeneratedBlock` — happy path replaces the marked block; missing marker throws `no generated:… block to replace`.
  2. Drive `bun skills/_shared/scripts/render-design-tokens.ts --css` / `--mermaid` / no-flag and assert stdout equals `renderTokenBlock` / `renderMermaidInit` / both.
  3. Drive `--write` against a **temp copy** of a consumer (do not mutate the repo files): stale inner text → file updates; already-matching file → stdout `already up to date` and mtime/bytes unchanged.
  Target: `skills/_shared/scripts/design-language.test.ts` (already in the vitest `skills/**/scripts/**/*.test.ts` glob).

## Warnings

### 1. Mermaid hex is a second hand-maintained palette inside the brief
- **File**: `skills/_shared/design-brief.jsonc` `mermaid.config.themeVariables` vs `token_groups`
- **Problem**: CSS tokens generate the `:root` block. Mermaid init is generated from a separate object whose hex currently matches tokens (`primaryBorderColor` = `--accent` = `#0f766e`, etc.) but nothing pins that. `edit the brief, run --write` does **not** update diagram colours if only `--accent` changes. Byte-compare still passes.
- **Suggested approach**: Either derive `themeVariables` from named tokens in the renderer, or add one assertion: every hex in `themeVariables` is a value in `brief.tokens`. Do not add a second loop over consumers.

### 2. TOC link-click drops `aria-expanded`
- **File**: `skills/b-blueprint/references/blueprint-template.html:421` and `skills/b-present/references/briefing-package-patterns.md:518-520`
- **Problem**: Button click sets `aria-expanded` correctly (Playwright covers that). Clicking a nav link removes `.open` and resets the caret text but does not set `aria-expanded="false"`. Brief `interaction_states.collapse_toggle` says aria-expanded tracks state.
- **Suggested approach**: In the link handler, also `btn.setAttribute('aria-expanded', 'false')`. Same one-liner in both copies.

### 3. Three consumer lists, test does not import `CONSUMER_FILES`
- **File**: `render-design-tokens.ts:22-25`, `design-language.test.ts:16-19`, `design-brief.jsonc` `source.consumers`
- **Problem**: Currently identical two paths. Test has its own `CONSUMERS` instead of `CONSUMER_FILES`. Adding a consumer to the renderer but not the test (or the reverse) is uncaught.
- **Suggested approach**: Test imports `CONSUMER_FILES`. Optionally assert `brief.source.consumers` deep-equals that array.

### 4. Inline-code colour `#4a423a` is not a token and not in the brief
- **File**: `blueprint-template.html:97`, `briefing-package-patterns.md:132`
- **Problem**: `#fffdfa` (masthead) and `#fdfcfa` (row hover) are recorded in brief prose. `#4a423a` on `code` is not. Drift guard cannot see it.
- **Suggested approach**: Use `var(--ink2)` or add `--code-ink` to the brief and regenerate.

### 5. Mutation tests are not in the suite
- **File**: `design-language.test.ts`
- **Problem**: `index.md` / `draft-commit.md` claim source-wider / copy-wider / value-drift mutations were caught. The suite has no mutation cases. This review reproduced that byte-compare **would** fail all three; they are not regression-locked.
- **Suggested approach**: The `--write` tests in Critical #1 close this for the generated blocks. Do not add a separate mutation script.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `.context/2026-09-11.html-deliverable-design-language/`.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
For larger rework, use `/b-build` or `/b-build-hard`.
