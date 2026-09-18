---
date: 2026-09-18
domains: [workflow, planning, validation]
topics: [software-factory, guardrails, skill-catalog, installer, codex, git-hooks]
related:
  - ../2026-09-18.good-ideas/plan-buck-workflow-factory-improvements.md
  - ../backlog/items/buck-workflow-factory-improvements.md
priority: high
status: completed
subject: 2026-09-18.good-ideas
artifacts:
  - .context/2026-09-18.good-ideas/index.md
  - .context/2026-09-18.good-ideas/plan-buck-workflow-factory-improvements.md
  - .context/backlog/items/buck-workflow-factory-improvements.md
---

# Software-factory recommendations plan

## Request

Read `../software-factory-comparison.html`, prioritize the “What each should steal from the others” recommendations for Buck Workflow, validate them with scouts, and create a b-plan.

## Validation

Five parallel read-only scouts checked each recommendation against the current checkout, followed by an independent plan critic.

- **Guardrail promotion — adapt:** the contract has six gates, not five, and already stages brownfield debt implicitly. Missing pieces are explicit enforcement states, a deterministic non-agent runner, and PR-CI wiring.
- **Security hook — adapt:** `scripts/security-audit.sh` is substantive and unwired, but scans all tracked files and normally all history. Hook installation must be opt-in, pre-push, coexistence-safe, and removable.
- **Duplicate skill tree — reject literal symlink, adapt goal:** the Codex bundle is intentionally curated and self-contained. Preserve the physical bundle and add inventory plus recursive parity checks with explicit Codex-only exceptions.
- **Allowlist/PATH — adapt:** `scripts/install.mjs --verify` already diagnoses mixed source roots and the report’s 53/55 count is stale. Add a prompt/command mirror invariant after the existing mirror item and a hermetic packed-package login-shell PATH smoke.
- **Frontmatter/test sweep — adopt narrowly:** exactly one direct root skill lacks frontmatter (`skills/code-review/SKILL.md`); the allegedly excluded `pr-ref` tests are already discovered and pass.

## Deliverables

- `.context/2026-09-18.good-ideas/plan-buck-workflow-factory-improvements.md`
- `.context/2026-09-18.good-ideas/index.md`
- `.context/backlog/items/buck-workflow-factory-improvements.md`

The plan prioritizes catalog/bundle invariants first, distribution/install checks second, deterministic guardrail promotion third, and opt-in pre-push security enforcement fourth. It recommends `/b-phase` before implementation and OMP `workflow` mode pending user confirmation.

## Verification

- Five scouts returned repository-cited verdicts.
- Independent evidence critic verdict: `PASS`, no findings or plan edits.
- Marksman diagnostics: `OK` for the plan, subject index, and backlog item.
- Docs-only planning work; deterministic code guardrails were not applicable.

## Blocker

`.context/backlog/todo.md` was already unmerged (`UU`) on branch `feat/good-ideas`. The backing backlog item was created, but its queue link and the required final commit were not attempted because resolving the unrelated conflict was outside this request.
