---
date: 2026-09-19
domains: [extensions, workflow, testing, docs]
topics: [subject-lifecycle, plan-scoped-scan, buck-loop, closeout, codex-bundle]
related:
  - .context/2026-09-19.subject-work-state/plan-subject-work-state.md
  - .context/2026-09-19.subject-work-state/research-buck-loop-build-timeout.md
priority: high
status: completed
subject: 2026-09-19.subject-work-state
artifacts:
  - plan-subject-work-state.md
  - iterate-subject-work-state.md
  - draft-commit.md
---

# Deterministic subject work-state build

## Outcome

Completed and verified the assigned non-phased build and four review iterations. `/buck-loop` phase scanning is scoped to the selected plan, subject lifecycle inspection/transitions flow through the canonical `subject-lifecycle.ts` intent authority, and the policy audit rejects literal, inline-object, and identifier-indirected lifecycle writes that reach `index.md`. `/b-save-improved` surfaces semantic close refusals instead of presenting an open subject as closed. `b-plan-update` now reuses canonical inspection results instead of reading the compatibility `status` scalar.

Final `/b-review` passed with no findings. `/b-save` completed the plan, backlog, and memory checkpoint. Canonical `close-verified` refused lifecycle closure because `plan-subject-work-state.md` is unphased; all saved artifacts remain, and the subject correctly remains open.

## Decisions

- Keep four named lifecycle intents only: `initialize`, `activate`, `close-verified`, and `reopen`; no generic status setter or caller-supplied verification.
- Preserve `index.md` as the compatibility surface while canonical metadata records schema, revision, transition, and reopen reason.
- Scope phases by `frontmatter.plan`; permit untagged phases only when the subject has one non-overview plan.
- Keep the lifecycle policy audit separate from unit tests and guardrails, with its own blocking PR job.
- Preserve the normal `/buck-loop` blocked-state recovery path; do not mutate its persisted projection manually.
- Treat lifecycle object properties as direct writes when they flow through nested call arguments to an `index.md` write: `status` with a lifecycle state, or any canonical `lifecycle_*` field.
- Preserve successful `/b-save-improved` checkpoint and retain work when lifecycle closeout is refused, but emit the refusal code/blockers and explicit `subject not closed` terminal wording.
- Resolve unique `const` initializers across write-call arguments, including template fragments and lifecycle object payloads; restrict the final violation decision to filesystem write calls so lifecycle-shaped output objects are not false positives.
- Extract the lifecycle-write predicate from the AST visitor so the policy remains behaviorally identical while satisfying the required cyclomatic ceiling; keep the canonical and Codex-bundled files byte-identical.
- Treat lifecycle inspection as the only source for `b-plan-update` subject state; direct `index.md` reads are limited to non-lifecycle metadata.

## Files Modified

- Lifecycle authority and tests: `skills/_shared/scripts/subject-lifecycle.ts`, canonical tests, context helpers, and subject-resolution guidance. The final closeout refactor isolates call-name and direct-write classification from AST traversal.
- Runtime adoption: `extensions/buck-loop/`, `extensions/b-save-improved/index.ts`, `extensions/b-save-improved/__tests__/handler.test.ts`, `extensions/plan-artifact.ts`, and `extensions/code-review-iteration/report.ts` plus tests.
- Workflow adoption: affected subject creators/readers, `b-plan-update`, active `b-save`, `b-save-improved`, and `prompts/b-save.md`.
- Distribution and enforcement: canonical and bundled lifecycle authority/tests, `plugins/buck-workflow/skills/`, `package.json`, `package-lock.json`, and `.github/workflows/test.yml`.
- Living docs and durable state: `AGENTS.md`, `docs/buck-workflow.md`, plan, iteration artifact, backlog item, draft commit, and this memory.

## Verification

- Initial focused contract suite: 9 files, 176 tests passed.
- Review iteration reproduced the object-field false negative before the fix.
- Iteration focused checks: lifecycle 15 passed; Codex bundle parity 7 passed; policy audit returned `{ "ok": true, "violations": [] }`.
- Iteration unit gate: 59 Vitest files / 950 tests passed; Bun suite 70 passed. Lint gate is disabled by `guardrails.json`.
- Second iteration reproduction: exit-0 apply result with `lifecycle.ok: false` previously ended as `checkpoint written`; regression test now observes the blocker warning and `checkpoint written; subject not closed`.
- Second iteration focused test: `extensions/b-save-improved/__tests__/handler.test.ts`, 16 passed.
- Second iteration unit gate: 59 Vitest files / 951 tests passed. Lint gate remains disabled by `guardrails.json`.
- Third iteration reproduced the identifier-indirection false negative before the fix. Bound path/content, template, and `setFrontmatterFields` payload fixtures now report their write-call lines; unrelated artifact writes and lifecycle-shaped console output stay clean.
- Third iteration checks: lifecycle 15 passed; Codex parity 7 passed; canonical/bundle `cmp` passed; repository audit returned `{ "ok": true, "violations": [] }`.
- Third iteration light unit gate: 59 Vitest files / 951 tests passed. Lint remains disabled by `guardrails.json`.
- Lifecycle CLI smoke: `initialize -> activate -> close-verified -> reopen -> close-verified`; final state `completed`, revision 5, unrelated title/body preserved.
- Initial durable guardrails v2: pass; unit and global coverage ratchet passed, complexity passed, coverage 81.5%, no new complexity violations.
- Final closeout found one required complexity failure (`visit`, cyclomatic 12). Extracting `callExpressionName` and `isDirectLifecycleWrite` removed the new violation without changing audit behavior.
- Fresh post-refactor proof: lifecycle/Codex tests 22 passed; focused plan/lifecycle/caller suite 151 passed; repository audit returned `{ "ok": true, "violations": [] }`; canonical/bundle `cmp` passed.
- Fresh durable guardrails v2: `status: pass`; unit, global coverage ratchet, and complexity gates passed; coverage 81.5%; no new or hard-ceiling complexity violations. Patch coverage remained advisory/unavailable and lint remained disabled by contract.
- Fourth iteration removed the last raw lifecycle reader instruction from `b-plan-update`. Lifecycle/Codex tests passed (22/22), the repository audit remained clean, and the light unit gate passed (951 Vitest + 70 Bun tests); lint is disabled by contract.
- Final `/b-review`: 135 focused tests passed; lifecycle audit clean; canonical/Codex authority byte-identical; durable guardrails v2 passed at 81.5% coverage with no complexity violations.
- `/b-save` lifecycle closeout returned exit 2 / `not-verified` with blocker `plan-subject-work-state.md: unphased plan remains open`; no lifecycle mutation occurred.

## Abandoned Approaches

- Fixed wall-clock nested-session timeout: replaced earlier with an activity-refreshed inactivity timeout because productive builds exceeded 15 minutes.
- Direct lifecycle frontmatter writes and fallback mutation: removed in favor of intent operations and semantic refusal results.

## Next

Supervisor may proceed to `/b-commit` using `.context/2026-09-19.subject-work-state/draft-commit.md`. Follow-up closeout evidence for unphased plans is tracked in `.context/backlog/items/unphased-plan-closeout-evidence.md`.
