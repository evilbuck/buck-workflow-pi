---
date: 2026-09-19
domains: [workflow, architecture, docs]
topics: [subject-lifecycle, buck-loop, b-save, codex-bundle, policy-audit]
related:
  - .context/2026-09-19.subject-work-state/plan-subject-work-state.md
  - .context/backlog/items/subject-work-state.md
priority: high
status: completed
subject: 2026-09-19.subject-work-state
artifacts:
  - plan-subject-work-state.md
  - index.md
---

# Subject work-state plan audit

Revised the deterministic subject work-state plan after four parallel repository scouts audited lifecycle semantics, caller coverage, active save flows, and enforcement.

## Decisions

- One intent-based TypeScript authority owns subject lifecycle: `initialize`, `activate`, `close-verified`, and `reopen`; no generic setter.
- `initialize` applies only when no canonical or legacy lifecycle exists. Matching intents canonicalize legacy state; malformed or verified-closed ambiguity fails closed.
- Active `/b-save` initializes missing subjects and closes only after phase, iterate, and loose-artifact consolidation. Close refusal reports blockers without rollback or fallback writes.
- `b-save-improved` removes `subject_index_status` and runs lifecycle after every non-lifecycle mutation.
- Omitted runtime callers `extensions/plan-artifact.ts` and `extensions/code-review-iteration/report.ts` are explicit migrations.
- The physical Codex bundle receives byte-identical copies under its existing parity contract.
- Enforcement is `npm run subject-lifecycle:check` in a dedicated PR CI job, separate from unit tests and guardrails.

## Verification

Fresh artifact validation found all required caller/enforcement claims, one copy of each required plan section, zero obsolete wiring claims, and zero trailing whitespace. Scoped git status showed the plan, subject index, and backlog item as untracked. This session changed only `.context/**` Markdown, so the code guardrails contract was not run.
