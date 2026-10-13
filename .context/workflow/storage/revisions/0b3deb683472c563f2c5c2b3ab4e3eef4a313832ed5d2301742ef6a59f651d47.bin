---
status: completed
date: 2026-07-26
subject: 2026-07-26.b-init-guardrails
topics: [guardrails, coverage, cyclomatic-complexity, ratchet, brownfield, skill-authoring]
---

# b-init-guardrails

Two new skills that establish language-agnostic quality guardrails — tests, coverage, cyclomatic
complexity — in any project, with a brownfield-safe ratchet toward the target and non-blocking
subagent checks during development.

## Artifacts

| File | What |
|---|---|
| [plan-b-init-guardrails.md](plan-b-init-guardrails.md) | **The plan.** Scope, 9 steps, 11 files, verification, risks. |
| [plan-b-init-guardrails-phases.md](plan-b-init-guardrails-phases.md) | **Phases overview.** 5 phases (2 easy, 3 medium), all completed. |
| [phase-1-schema-protocol.md](phase-1-schema-protocol.md) | guardrails.json schema + ratchet-protocol.md ✅ |
| [phase-2-tooling-detection.md](phase-2-tooling-detection.md) | tooling-matrix.md + detect-stack.ts ✅ |
| [phase-3-init-skill.md](phase-3-init-skill.md) | b-init-guardrails/SKILL.md + agents-block.md ✅ |
| [phase-4-check-skill.md](phase-4-check-skill.md) | b-guardrails-check/SKILL.md ✅ |
| [phase-5-registration.md](phase-5-registration.md) | prompts, command symlinks, docs registration ✅ |
| [research-tooling-web-dynamic.md](research-tooling-web-dynamic.md) | Coverage + complexity tooling: JS/TS (node/bun/deno), Python, Ruby, PHP, Dart |
| [research-tooling-compiled.md](research-tooling-compiled.md) | Coverage + complexity tooling: Go, Rust, C/C++, Swift, C#/.NET |
| [research-tooling-jvm-and-fallback.md](research-tooling-jvm-and-fallback.md) | Java, Kotlin, Scala, Elixir, Shell + the `lizard`/`scc` universal fallback |
| [research-ratchet-and-thresholds.md](research-ratchet-and-thresholds.md) | Two-gate model, baseline prior art (PHPStan/Psalm/betterer), cited threshold table |
| [research-harness-gate-mechanics.md](research-harness-gate-mechanics.md) | Per-harness async capability, runtime detection, tree-contention risk |

## Decisions (Light Grill, 2026-07-26)

| Question | Resolution |
|---|---|
| Ongoing enforcement home | **Both** — managed `AGENTS.md` block *and* a standalone `b-guardrails-check` skill |
| Tooling installs | **Propose, then apply on approval** — never silently mutate a manifest |
| Tree contention | **Dispatch only at coherent points**, re-verify before escalating |
| CI wiring | **Out of scope** — emit the commands, write no workflow files |
| State location | **`guardrails.json` at repo root** (with a split escape hatch for large baselines) |

## Key research conclusions

- **Two gates, not one.** Hard patch gate on changed lines + monotonic global ratchet from the
  measured baseline. This is what makes day-one brownfield enforcement possible.
- **`diff-cover` is the polyglot patch-gate spine** — consumes lcov/cobertura from nearly every
  ecosystem's coverage tool, has a real `--fail-under`.
- **`lizard`, not `scc`, is the complexity fallback.** scc's COMPLEXITY column is a keyword-count
  approximation at file level, explicitly not McCabe.
- **The live OMP `task` tool is genuinely async** — the primitive that satisfies "so it doesn't stop
  us." Undocumented in `docs/eval-kernel.md`; filed as a follow-up.
- **No post-edit hook may be built** — `AGENTS.md` prohibits new extension orchestration, so ongoing
  behavior ships as a managed `AGENTS.md` block.

## Next step

`/b-review` → `/b-save` → `/b-commit`
