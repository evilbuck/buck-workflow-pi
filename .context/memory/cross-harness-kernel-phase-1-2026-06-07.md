---
date: 2026-06-07
domains: [implementation, buck-workflow, omp, planning, docs]
topics: [cross-harness, compat, header-guard, runtime-probe, eval-template, b-plan, slash-commands, omp, no-op]
related: []
priority: medium
status: completed
subject: 2026-06-06.omp-integration-buck-workflow
artifacts:
  - plan-cross-harness-kernel.md
  - phase-1-cross-harness-compat.md
---

# Cross-harness kernel — Phase 1 build

Phase 1 of the cross-harness + kernel-phasing plan (`.context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel.md`) is the foundation phase. The F1–F7 build (committed earlier) added three OMP-aware slash-command stubs and OMP-Execution-Recommendation + Eval-Cell-Template sections in `b-plan`. On non-OMP harnesses (Pi, Claude Code, OpenCode, Codex) those surfaces looked authoritative even though the underlying primitives are OMP-specific. Phase 1 adds small, targeted guard text so each surface is unambiguous on every harness.

## Edits (six)

1. `prompts/omp-orchestrate.md` — prepended harness-note blockquote after frontmatter.
2. `prompts/omp-workflow.md` — same shape, workflow-flavored.
3. `prompts/omp-goal.md` — same shape, /goal-flavored. Note: on Claude Code `/goal` is a different namespace entirely.
4. `skills/b-plan/SKILL.md` OMP Execution Recommendation table — inserted harness guard as row 1 (before any other trigger).
5. `skills/b-plan/SKILL.md` Eval Cell Template prelude — wrapped `from prelude import ...` in `try / except ImportError` with a `_no_op` fallback so the cell degrades to a no-op on non-OMP runtimes.
6. `docs/buck-workflow.md` "What the workflow does NOT do" — added fourth bullet ("Does not break on non-OMP harnesses") pointing at the header guard and runtime probe as the cross-harness safety net.

## Verification (run before yielding)

- `npx vitest run` → 163/163 passing.
- `diff <(ls prompts/) <(ls commands/)` → empty (still in sync).
- `python3 -c "import ast, re; ast.parse(re.search(r'\\`\\`\\`python\\n(.*?)\\n\\`\\`\\`', open('skills/b-plan/SKILL.md').read(), re.DOTALL).group(1))"` → succeeds.
- `head -10 prompts/omp-*.md | grep "Harness note"` → all 3 stub files match.

## Why "no-op" wording, not "unsupported"/"deprecated"

The slash command still appears in the palette. The body explains the no-op nature rather than reading as a deprecation notice. This is the deliberate choice the phase file calls out as the wording gate. The user can still see the file, read the contract, and follow the no-op guidance — no implicit "this is broken" implication.

## Risk acknowledged, not mitigated further

- The top-row guard could over-trigger if a session swaps harnesses mid-run. Mitigation per phase file: detect from runtime signal, not from a one-time check at skill load. The b-plan table cell tells the user to detect from session state (`omp.runtime` / `pi.runtime` / package `omp` field).
- The runtime probe could mask legitimate import errors. Mitigation per phase file: the probe is specific to `ImportError`; other exceptions still propagate.

## Cross-references

- Plan: `.context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel.md`
- Phase file: `.context/2026-06-06.omp-integration-buck-workflow/phase-1-cross-harness-compat.md`
- Phased overview: `.context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel-phases.md`
- Subject index: `.context/2026-06-06.omp-integration-buck-workflow/index.md`
