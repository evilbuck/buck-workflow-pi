---
date: 2026-09-11
domains: [design-system, testing, html-deliverables]
topics: [design-language, b-iterate, patch-coverage, drift-guard]
related: []
priority: medium
status: completed
subject: 2026-09-11.html-deliverable-design-language
artifacts:
  - iterate-html-deliverable-design-language.md
  - index.md
  - draft-commit.md
---

# HTML deliverable design language — iterate

`/b-iterate` against `.context/2026-09-11.html-deliverable-design-language/iterate-html-deliverable-design-language.md`.

## Decisions

- In-process `main(argv, root)` rather than a bun subprocess: child-process tests do not count toward vitest coverage of `render-design-tokens.ts`, which is the patch-gate file.
- `writeConsumers` stays unexported; `--write` tests cover it through `main`.
- Warning 5 (mutation script) left as-is — `--write` tests lock regen; no separate mutation harness.

## Files Modified

- `skills/_shared/scripts/render-design-tokens.ts` — export `main(argv, root?)`
- `skills/_shared/scripts/design-language.test.ts` — splice, CLI, `--write` temp tree, mermaid-hex pin, `CONSUMER_FILES`
- `skills/b-blueprint/references/blueprint-template.html` — `--ink2`; TOC `aria-expanded=false` on link click
- `skills/b-present/references/briefing-package-patterns.md` — same two warning fixes

## Verification

- `npx vitest run skills/_shared/scripts/design-language.test.ts --coverage --coverage.include=skills/_shared/scripts/render-design-tokens.ts`: 16/16, 100% lines / 97.26% stmts (uncovered branches: duplicate-token throw L67, `import.meta.main` true L164)
- `npx vitest run`: 27 files passed; `extensions/b-flow/__tests__/machine.test.ts` 5 failures on isolated `TEST_ROOT` settle timing — not this diff
- lint_cmd is null — skipped
