---
date: 2026-09-29
domains: [planning, skills, docs]
topics: [decision-closure, shared-protocol, assumptions, rollback, codex-bundle]
related:
  - .context/2026-09-16.decision-closure/phase-2-shared-protocol.md
  - .context/2026-09-16.decision-closure/plan-decision-closure-protocol-phases.md
priority: high
status: completed
subject: 2026-09-16.decision-closure
artifacts:
  - skills/_shared/decision-closure.md
  - skills/_shared/SKILL.md
  - plugins/buck-workflow/skills/_shared/
---

# Phase 2 — shared decision-closure protocol

Authored the canonical conditional protocol in `skills/_shared/decision-closure.md`, registered it in the shared resource index, and synchronized the full canonical `_shared` directory to the Codex bundle.

## Contract decisions

- Triggers require a closure check, not an automatic user interview; clear, routine reversible work follows an explicit no-ledger/no-extra-question path.
- The body-based closeout names course, trade-offs, evidence, stable assumption IDs, exact statuses (`validated`, `deferred`, `invalidated`), blocking state, validation paths, material risks, excluded scope, and next bounded action.
- Blocking unresolved assumptions and unvalidated material rollback/fallback claims prevent readiness.
- Consumers load the canonical resource rather than copying its schema; consumer responsibilities for grill, plan, phase, build, and review are specified.
- No frontmatter or runtime serializer contract was added.

## Verification

- `skill://_shared/decision-closure.md` resolves through the shared skill loader.
- Full-directory `diff -rq skills/_shared plugins/buck-workflow/skills/_shared` returned no differences.
- Case-insensitive whole-word scan of changed canonical and bundled shared files found no forbidden term.
- No runtime or test source changed; the deterministic code check is skipped as docs-only.

## Files modified

- `skills/_shared/decision-closure.md`
- `skills/_shared/SKILL.md`
- `plugins/buck-workflow/skills/_shared/decision-closure.md`
- `plugins/buck-workflow/skills/_shared/SKILL.md`
- `.context/2026-09-16.decision-closure/phase-2-shared-protocol.md`
- `.context/2026-09-16.decision-closure/plan-decision-closure-protocol-phases.md`
