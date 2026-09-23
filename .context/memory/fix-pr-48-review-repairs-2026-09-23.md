---
date: 2026-09-23
domains: [extensions, testing, workflow]
topics: [pr-48, fix-pr, review-feedback, buck-loop, typed-output]
related:
  - https://github.com/evilbuck/buck-workflow-pi/pull/48
  - .context/2026-09-21.jev-decision-opportunities/plan-jev-buck-loop-chooser.md
  - .context/backlog/items/jev-buck-loop-chooser.md
priority: high
status: completed
subject: 2026-09-21.jev-decision-opportunities
artifacts:
  - plan-jev-buck-loop-chooser.md
  - iterate-jev-decision-opportunities.md
---

# PR 48 review repairs

## Outcome

Resolved all valid review feedback on PR #48 and pushed two repair commits:

- `f36287439b97a2e247345b51daf39ede0835e74e` — preserve unrelated mid-cycle dirt, remove the out-of-scope Pig Latin demo, and restore installability.
- `8b4354f4c651ffe0e12d536d0177c3b7b5472e57` — align review verdict invariants, make bundled `b-save` lifecycle execution location-independent, refresh lifecycle state after initialization, and disambiguate the portable code-review invocation.

## Decisions

- Nested loop workers stage only files they own; the supervisor refuses unrelated unstaged non-`.context` dirt and auto-stages only `.context` artifacts.
- A correctness `pass` remains valid when documentation or how-to follow-up exists; `pass_with_warnings` also remains valid for those non-blocking impacts.
- Bundled skills resolve `subject-lifecycle.ts` from the loaded `SKILL.md`, never from the user's project working directory.
- `/code-review` remains the extension's local Reviewer/Fixer loop; `/skill:code-review` is the portable release-PR reviewer.

## Verification

- Focused contract and Codex-plugin tests: 20 passed.
- Bundled lifecycle helper smoke test: `initialize` produced `draft`; immediate `inspect` observed `draft` from an unrelated temporary working directory.
- Durable guardrails v2: pass; required unit, coverage-ratchet, and complexity gates passed. Functional and lint gates were disabled by contract.
- GitHub CI at `8b4354f4c651ffe0e12d536d0177c3b7b5472e57`: Unit tests, Subject lifecycle policy, and Guardrails contract passed.
- Independent latest-head review `5291390953`: no new defects; remaining work is already tracked and outside PR #48.

GitHub still reports `CHANGES_REQUESTED` from an older CodeRabbit review, but the latest-head independent review and all CI checks settled successfully.
