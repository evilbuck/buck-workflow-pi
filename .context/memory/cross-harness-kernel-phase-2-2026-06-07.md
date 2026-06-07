---
date: 2026-06-07
domains: [docs, buck-workflow, omp, planning, eval-kernel]
topics: [eval-kernel, contract-doc, prelude-helpers, budget, schemas, failure-modes, cross-platform, b-plan]
related: []
priority: medium
status: completed
subject: 2026-06-06.omp-integration-buck-workflow
artifacts:
  - plan-cross-harness-kernel.md
  - phase-2-kernel-contract-doc.md
  - docs/eval-kernel.md
---

# Cross-harness kernel — Phase 2 build

Phase 2 captures the eval-kernel contract for downstream skills (and
the next agent). Hard-deps on Phase 1: the new doc's "Cross-platform"
section points at the runtime probe Phase 1 added to `b-plan`'s eval
cell template and at the header-guard in the three `omp-*.md` stubs.

## Edits (three)

1. `docs/eval-kernel.md` (new, ~13 KB) — six sections:
   - **What it is** — the persistent Python (or JS) kernel exposed by
     omp's `eval` tool.
   - **Helpers** — `agent()` / `parallel()` / `pipeline()` / `llm()` /
     `phase()` / `log()` / `budget()`. Each with signature, return
     shape, and one example.
   - **Budget** — `budget.remaining()` semantics, hard vs. soft
     ceiling, `+Nk!` / Goal Mode interaction. Cites
     `src/goals/runtime.ts:87-99` and `src/eval/py/prelude.py`.
   - **Schemas** — `schema=` parameter, parsed-object return, the
     `additionalProperties: false` rule.
   - **Failure modes** — `agent()` past hard ceiling, `parallel()`
     propagation, `pipeline()` barrier, `budget.remaining()` is None.
   - **Cross-platform** — link to
     `docs/buck-workflow.md#omp-autonomous-loops`; the eval cell is
     OMP-only; on other harnesses the cell is a no-op (Phase 1's
     runtime probe).

2. `skills/b-plan/SKILL.md` "Eval Cell Template" section — after the
   closing ```` ``` ```` of the embedded Python block, added a
   `> **See also:** docs/eval-kernel.md for the full helper API,
   budget semantics, schemas, and failure modes. The eval cell is
   OMP-only — on other harnesses the prelude is absent and the cell
   degrades to a no-op via the runtime probe above.` cross-ref.

3. `.context/2026-06-06.omp-integration-buck-workflow/index.md` —
   added `docs/eval-kernel.md` to the `artifacts:` list.

## Verification (run before yielding)

- `npx vitest run` → 163/163 passing.
- `grep -E "^## (What it is|Helpers|Budget|Schemas|Failure modes|Cross-platform)$" docs/eval-kernel.md | wc -l` → 6.
- `grep -E "src/goals/runtime.ts:87-99|src/eval/py/prelude.py" docs/eval-kernel.md` → both cited.
- `grep -F "docs/eval-kernel.md" skills/b-plan/SKILL.md` → cross-ref present.

## Why the strict `additionalProperties: false` rule

The kernel rejects parsers that silently drop extras — strict schema
is the default, not the option. Every schema in the b-plan template
and in the Phase 3 example cells uses this rule. The "Schemas" section
states the rule verbatim and gives the minimum-schema shape as a
copy-paste reference.

## Cross-references

- Plan: `.context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel.md`
- Phase file: `.context/2026-06-06.omp-integration-buck-workflow/phase-2-kernel-contract-doc.md`
- Phased overview: `.context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel-phases.md`
- Phase 1 memory: `.context/memory/cross-harness-kernel-phase-1-2026-06-07.md`
