---
date: 2026-09-30
domains: [docs, frontend, testing]
topics: [state-machine, user-guide, runnable-snippets]
subject: 2026-09-30.state-machine-user-guide
artifacts: [plan-state-machine-user-guide.md]
related:
  - site/guides/state-machine.html
  - site/index.html
  - .context/2026-09-30.state-machine-user-guide/plan-state-machine-user-guide.md
priority: medium
status: completed
---

# Runnable state-machine user guide

## Outcome

Created `site/guides/state-machine.html` as an eight-step recipe for junior engineers. Linked it from the homepage navigation and footer. The guide covers prerequisites and a source checkout, a four-state article workflow, the complete typed machine, a caller that executes effects before updating state, actual text-file publication, fail-closed safety checks, strict type checking, final observable verification, adaptation, and troubleshooting.

Four complete copyable sample files use the current evaluator and installed `tsx`; no external model, API key, or Bun is needed for the recipe. The evaluator stays synchronous/stateless; callers own facts, choice selection, effects, and state. The guide does not promise transactional or exactly-once effects.

## Verification

- Extracted the exact four file samples and seven shell blocks from the rendered HTML. All shell blocks passed Bash syntax checks.
- Fresh clone of the documented branch plus `npm ci`: strict TypeScript passed; runner and safety-check stdout exactly matched the guide; the real publication file exactly matched the guide.
- Actual browser: 1440px desktop and 390px mobile; homepage navigation, mobile anchor navigation, keyboard copy and exact clipboard text, and no page errors. Fixed a mobile article-width overflow before the final check; the page now remains 390px wide while code blocks scroll locally.
- JavaScript disabled: all eight sections and four samples remain available; copy controls remain hidden.
- Final `npm run guardrails:check`: durable v2 pass. Required unit-test, global coverage-ratchet, and complexity gates passed. Advisory patch gate passed. Lint and functional gates were disabled/skipped. No baselines were changed.

## Boundaries

No SDK, package, or permanent test changes. The requested guide is the living documentation update. No unrelated backlog item was completed, and stale workflow-session metadata was left untouched. Shared SQL memory is not callable in this ad-hoc session, so this save uses portable file context. Temporary verification files are removed; the dedicated local site preview serves port 4322.
