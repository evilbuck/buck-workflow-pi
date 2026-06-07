---
date: 2026-06-07
domains: [implementation, buck-workflow, omp, eval-kernel, planning]
topics: [eval-cells, review-audit, migration-sweep, parallel, pipeline, llm-judge, schemas, additionalProperties, b-plan]
related: []
priority: medium
status: completed
subject: 2026-06-06.omp-integration-buck-workflow
artifacts:
  - plan-cross-harness-kernel.md
  - phase-3-eval-kernel-examples.md
  - eval-review-audit.py
  - eval-migration-sweep.py
---

# Cross-harness kernel — Phase 3 build

Phase 3 proves the eval-kernel works end-to-end with two non-trivial
patterns. Hard-deps on Phase 2: the example cells import helpers whose
signatures must be stable in `docs/eval-kernel.md` before the cells
can be written against them. The schema shape
(`additionalProperties: false`) is also first documented in Phase 2.

## Edits (four)

1. `.context/2026-06-06.omp-integration-buck-workflow/eval-review-audit.py`
   (new, ~6 KB) — review-audit pattern. Filled the F6 template
   placeholders with this subject's real values; PHASES points at the
   four discrete phase files; `build_prompt()` reads the actual phase
   files at `.context/<subject>/phase-N-slug.md`; `__main__` guard
   short-circuits when run as a plain Python script (no prelude
   required).

2. `.context/2026-06-06.omp-integration-buck-workflow/eval-migration-sweep.py`
   (new, ~5.5 KB) — migration-sweep pattern. Different shape: per-
   directory `parallel()` over a `TARGETS` list of real
   cross-harness surfaces, then `pipeline()` synthesizes a single
   "ready to migrate" verdict with a multi-criterion `JUDGE_SCHEMA`
   (`ready_to_migrate`, `compatibility_score`, `effort_estimate`,
   `blockers`). Same `__main__` guard shape.

3. `skills/b-plan/SKILL.md` "Eval Cell Template" section — appended an
   "Example cells" subsection with a table mapping each cell to its
   fan-out pattern and "when to use" guidance, plus a note that the
   two patterns compose (no third shape).

4. `.context/2026-06-06.omp-integration-buck-workflow/index.md` —
   added `eval-review-audit.py` and `eval-migration-sweep.py` to the
   `artifacts:` list.

## Why the `__main__` guard short-circuits early

When the cell is run as `python3 eval-*.py` outside the kernel, the
prelude import fails and the no-op fallback is installed. The cell body
that follows would then call `parallel()` and `pipeline()` (both
returning `None`) and crash on the first `result.get(...)`. The early
`raise SystemExit(0)` at the top short-circuits the body. Inside the
omp eval kernel `__name__` is *not* `"__main__"` — the kernel exec's
the file content directly, so the body runs normally and the guard
never fires.

## Verification (run before yielding)

- `python3 -c "import ast; [ast.parse(open(p).read()) for p in [
    '.context/2026-06-06.omp-integration-buck-workflow/eval-review-audit.py',
    '.context/2026-06-06.omp-integration-buck-workflow/eval-migration-sweep.py']]"` → both parse.
- `python3 .context/.../eval-review-audit.py` → `eval-review-audit.py: syntax + PHASES OK (run \`ast.parse\` for full check)`, exit 0.
- `python3 .context/.../eval-migration-sweep.py` → same shape, exit 0.
- `grep -E "cross-harness-compat|kernel-contract-doc|eval-kernel-examples|b-grill-integration" eval-review-audit.py` → 4 hits, all real slugs.
- `grep -c "additionalProperties.*False" eval-*.py` → review-audit: 3, migration-sweep: 4.
- `grep -E "compatibility_score|effort_estimate|blockers" eval-migration-sweep.py` → multi-criterion judge present.
- `grep -F "## Example cells" skills/b-plan/SKILL.md` → present.
- `npx vitest run` → 163/163 passing.

## Risks acknowledged

- The 4-fields `JUDGE_SCHEMA` is the F5 minimum. A real migration might
  also want `affected_files`. Mitigation per phase file: keep the four
  required fields; add `affected_files` as a non-required field if the
  user requests it.
- Slug collision risk if a future domain name kebab-cases to the same
  value as an existing slug. Mitigation per phase 4: append `-2`, `-3`
  etc. in the auto-derive algorithm.

## Cross-references

- Plan: `.context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel.md`
- Phase file: `.context/2026-06-06.omp-integration-buck-workflow/phase-3-eval-kernel-examples.md`
- Phased overview: `.context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel-phases.md`
- Phase 1 memory: `.context/memory/cross-harness-kernel-phase-1-2026-06-07.md`
- Phase 2 memory: `.context/memory/cross-harness-kernel-phase-2-2026-06-07.md`
- Contract doc: `docs/eval-kernel.md`
