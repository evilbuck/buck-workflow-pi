---
date: 2026-09-16
domains: [frontend, testing, review]
topics: [b-blueprint, scroll-spy, intersection-observer, e2e]
related: [html-deliverable-design-language-2026-09-11.md]
priority: high
status: completed
subject: 2026-09-11.html-deliverable-design-language
artifacts:
  - skills/b-blueprint/references/blueprint-template.html
  - tests/e2e/design-language.spec.ts
  - .context/2026-09-11.html-deliverable-design-language/index.md
---

# Blueprint scroll-spy review follow-up

The reported Wooderson blockers were already resolved in the checked-out blueprint template: its browser script collects `#toc` links directly from the DOM and observes every resolved section without a TOC-count guard. No template source change was required.

Added a Chromium regression test that injects a ninth TOC entry and section, stubs `IntersectionObserver`, and asserts all nine targets are observed. A browser-side script failure or an `>= 8` guard fails this test.

## Verification

- `npm test`: 47 Vitest files, 696 tests passed; 70 Bun tests passed.
- `npx playwright test tests/e2e/design-language.spec.ts --project=chromium`: 7 passed.
- Focused scroll-spy test: 1 passed.
- Live browser smoke check: template loaded without page errors; eight TOC links and eight matching sections were present; nine-entry variant observed all nine targets.
- `diff-cover coverage/lcov.info --compare-branch=origin/master --fail-under=90`: 100% patch coverage (76 lines).
- `lizard -C 10 -w ... .`: completed; no new blueprint implementation function was added.
