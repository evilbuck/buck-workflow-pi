---
date: 2026-06-24
domains: [skill, docs, buck-workflow, bootstrap]
topics: [b-docs, living-documentation, doc-sync, conventions, adr, context-md, b-review, canonical-locations, loop-agnostic, managed-block]
subject: 2026-06-24.b-docs-living-documentation
artifacts: []
related:
  - skills/b-docs/SKILL.md
  - prompts/b-docs.md
  - commands/b-docs.md
  - skills/b-review/SKILL.md
  - GLOBAL_OR_PROJECT-AGENTS.md
  - docs/buck-workflow.md
  - README.md
  - AGENTS.md
  - .context/backlog/items/loop-agnostic-execution-loops.md
priority: high
status: active
---

# b-docs — Living-Documentation Sync Layer

## What

Added `/b-docs`, a **conditional** post-review step that keeps the project's
living documentation in sync with what was implemented. Triggered when
`/b-review` flags documentation impact; runs before `/b-save`.

Canonical completion sequence is now:
`/b-build → /b-review → /b-iterate (if issues) → /b-docs (if doc impact) → /b-save → /b-commit`

## Evaluation finding (the origin)

No phase previously updated architecture docs from implementation:
- `b-save` writes **only to `.context/`** (`prompts/b-save.md:50` — explicit).
- `b-review` is read-only, correctness-focused — no doc-drift check.
- CONTEXT.md/ADRs existed only via `b-grill-with-docs` (pre-implementation) and
  `b-arch-qa` (standalone) — disconnected from the build loop.

## Design decisions

- **Detection in b-review, writing in a separate step** (user choice). b-review
  gained a non-blocking "Documentation Impact Check": never creates
  `iterate-*.md`, never flips Pass → Needs work. Only flags + recommends
  `/b-docs`.
- **Canonical locations = promote existing precedent**, not invent: `CONTEXT.md`
  (domain language) · `docs/adr/` (decisions) · managed block in
  `AGENTS.md`/`CLAUDE.md` (conventions) · `docs/` (narrative) · `README.md`
  (read-only). Formats reuse `b-grill-with-docs/CONTEXT-FORMAT.md` +
  `ADR-FORMAT.md` — no second convention.
- **Conditional, not always-run** — most changes skip it (gated by b-review).
- **Idempotent managed block** for AGENTS.md/CLAUDE.md (`<!-- BEGIN b-docs:conventions -->`)
  to avoid clobbering hand-authored content (mirrors `b-create-styleguide`).
- **ADR three-criteria gate** reused.
- `b-docs` writes only to living docs; never `.context/` (b-save's job). `b-save`
  records the session *event*; `b-docs` records *meaning*.

## Files created (4)
- `skills/b-docs/SKILL.md`
- `prompts/b-docs.md`
- `commands/b-docs.md` (symlink → `../prompts/b-docs.md`)
- `.context/backlog/items/loop-agnostic-execution-loops.md`

## Files modified (route sweep — every authoritative + generated-instruction path)
- `skills/b-review/SKILL.md` — Documentation Impact Check + report section + closeout
- `AGENTS.md`, `README.md`, `docs/buck-workflow.md` (runtime mapping, both Mermaid
  diagrams, Pi Implementation Matrix, Quick Reference table, new b-docs section,
  all flows + OMP variations + Review Fix Loop + orchestrate shorthand)
- `skills/b-save/SKILL.md`, `b-build/SKILL.md`, `b-iterate/SKILL.md` closeouts
- `skills/b-plan/SKILL.md`, `skills/b-phase/SKILL.md` — **generated mini-cycles**
  (Ralph instructions + checklists): 177/206/253 (b-plan), 222/322/360/330-332/
  367-368/371/394/431/432 (b-phase)
- `skills/b-pr-review-2-issues/SKILL.md` (233-234), `skills/b-pr/SKILL.md` (331)
- `GLOBAL_OR_PROJECT-AGENTS.md` — Steps/flows + new Canonical Documentation
  Locations section + Quality Gate
- `.context/backlog/todo.md` — loop-agnostic item registered

## Backlog item (user directive)

User decided the workflow should be **loop-agnostic** (remove Ralph-specific
instructions from generated mini-cycles). Logged as
`.context/backlog/items/loop-agnostic-execution-loops.md` (active, medium) rather
than executed now — separate refactor touching the same files. Out of scope:
`omp_execution` (intentional OMP harness integration, not Ralph coupling) and
immutable `.context/`/brainstorm history.

## Verification

- Symlink resolves end-to-end (`commands/b-docs.md` → `prompts/b-docs.md`).
- `npm run context:validate`: 0 errors (60 pre-existing legacy warnings, untouched).
- Comprehensive bypass sweep clean: every mini-cycle/flow now includes `docs if
  doc impact`; only stale hit is `docs/brainstorms/b-orchestration-extension.md`
  (immutable history, out of scope).
- b-review detection is non-blocking and never writes `iterate-*.md`.

## Notes

- No formal `b-plan` for this work (evaluation → direct implementation). No plan/
  spec/phase artifacts to cross-reference; no iterate artifact.
- Mnemopi retained two durable memories: b-docs architecture + loop-agnostic decision.
- Not yet committed — next step is `/b-commit`.
