---
status: completed
date: 2026-07-26
subject: 2026-07-26.b-init-guardrails
topics: [guardrails, coverage, cyclomatic-complexity, ratchet, brownfield, subagents, skill-authoring]
research:
  - research-tooling-web-dynamic.md
  - research-tooling-compiled.md
  - research-tooling-jvm-and-fallback.md
  - research-ratchet-and-thresholds.md
  - research-harness-gate-mechanics.md
iterations: []
spec:
memory: []
---

# Plan: b-init-guardrails — language-agnostic quality guardrails with brownfield ratchet

## User Goal

A developer working in any codebase — greenfield or years old — can run one command and get honest
quality guardrails: tests wired, coverage and cyclomatic complexity measured against their **real
current baseline**, and a gradual, defensible path to the target. Agents coding in that repo get
told when they break a guardrail, **without being blocked while they work**.

Confirmed with the user 2026-07-26.

## Goal

Ship two new skills plus their wiring:

1. **`b-init-guardrails`** — one-shot, idempotent initialization. Detects the stack, prefers tooling
   the project already uses, measures the baseline, writes `guardrails.json`, and installs a managed
   `AGENTS.md`/`CLAUDE.md` block that governs ongoing behavior.
2. **`b-guardrails-check`** — the measurement contract. Invokable standalone, and dispatched as a
   subagent by the mainline agent during development. Measures, compares, returns a verdict.
   **Never edits.**

## Context used / assumptions

**User-provided context.** Guardrails = tests + coverage measurement + coverage adherence +
cyclomatic complexity measurement + complexity adherence. Must be language- and framework-agnostic.
Must detect and reuse existing project tooling rather than imposing new tooling. Must handle
brownfield: assess where the project is, then plan a gradual path to the stated goals. Ongoing
checks should run in subagents so the mainline agent is not blocked; the subagent informs and guides
the mainline agent when a test fails or coverage drops.

**Session context.** Skill name fixed by the user mid-session: `b-init-guardrails` (not
`b-guardrails`).

**Artifacts used.** All five `research-*.md` files in this subject folder, produced this session:
- `research-tooling-web-dynamic.md` — JS/TS, Python, Ruby, PHP, Dart
- `research-tooling-compiled.md` — Go, Rust, C/C++, Swift, C#/.NET
- `research-tooling-jvm-and-fallback.md` — Java, Kotlin, Scala, Elixir, Shell + `lizard`/`scc`
- `research-ratchet-and-thresholds.md` — two-gate model, baseline prior art, cited thresholds
- `research-harness-gate-mechanics.md` — per-harness async capability, runtime detection, tree contention

**Key research conclusions carried into this plan:**

- **Two gates, not one.** A hard *patch gate* on changed lines plus a monotonic *global ratchet*
  from the measured baseline. This is what PHPStan baselines, betterer, Psalm, and Codecov patch all
  converge on, and it is what makes day-one brownfield enforcement possible without a grace period.
- **`diff-cover` is the polyglot patch-gate spine.** It consumes lcov/cobertura/JaCoCo/Clover +
  `git diff` and has a real `--fail-under=N`. Nearly every coverage tool in the matrix emits lcov or
  cobertura, so one patch gate covers every ecosystem.
- **`lizard` is the complexity fallback**, not `scc`. Verified from source: scc's `COMPLEXITY`
  column is a **keyword-count approximation at file level**, explicitly *not* McCabe — it must never
  be used as a per-function gate. Fallback command: `lizard -C 15 -w --csv .`
- **The live OMP `task` tool is genuinely async** (fire-and-forget + auto-delivery), which the repo's
  own `docs/eval-kernel.md` does not document. This is the mechanism that satisfies "so it doesn't
  stop us." No other harness has an equivalent; they get checkpoint-blocking.
- **No post-edit hook exists or may be built.** Root `AGENTS.md`: *"no new extension-based
  orchestration, prompt-level / skill-level only."* Ongoing behavior ships as a managed `AGENTS.md`
  block, following the `b-create-styleguide` precedent.
- **Thresholds are cited, never invented.** Cyclomatic 10 (McCabe / NIST SP 500-235 §2.5), hard
  ceiling 15 (NIST), coverage bands 60/75/90 (Google Testing Blog 2020), patch coverage ≥90%
  (ibid.). Fowler's caution against worshipping the number is carried into the skill's own wording.

**Assumptions.**
- `git` is available; the patch gate needs a diff. Non-git projects get global-ratchet only.
- Repos may be polyglot. `guardrails.json` holds a per-ecosystem array, not a single toolchain.
- The skill proposes tooling installs but never applies them without consent (Light Grill Q2).

**Open questions.** None blocking. Deferred items are listed under *Out of scope*.

## Light Grill

- Q1: Where does ongoing enforcement live — managed `AGENTS.md` block, a second skill, or both?
  → resolved: **both** — managed block for auto-trigger, plus a standalone `b-guardrails-check`
  skill so the check is independently invokable and testable. (recommended: managed block only;
  user chose the larger surface deliberately.)
- Q2: When a project has no coverage/complexity tooling, what may the skill do to it?
  → resolved: **propose, then apply on approval** — show the exact dependency + config diff, wait
  for a yes. Never silently mutate a manifest. (recommended: same)
- Q3: A background check shares the working tree with the still-editing mainline agent; mid-edit
  runs yield false failures. → resolved: **dispatch only at coherent points** — after a completed
  edit batch, never per-file, against the live tree, re-verify before escalating a failure.
  (recommended: same. Rejected: `git worktree` snapshot — breaks on uncommitted-only work;
  advisory-only — too weak for the stated requirement.)
- Q4: Is CI wiring in scope for v1? → resolved: **out of scope; emit commands** — the skill produces
  and documents the exact gate commands but writes no workflow or hook files. (recommended: same)
- Q5: Where does checked-in guardrail state live? → resolved: **`guardrails.json` at repo root**.
  (recommended: a `.guardrails/` directory, to keep a large complexity inventory out of the config
  file; user chose the single file. Size risk is recorded under *Risks* with a defined escape hatch.)

## Scope

**S1 — `skills/b-init-guardrails/SKILL.md`.** Guided, idempotent init with create and refresh modes:
detect → measure baseline → propose → write `guardrails.json` → wire the managed block.

**S2 — `skills/b-init-guardrails/docs/tooling-matrix.md`.** The language-agnostic reference table,
consolidated from the three matrix research files. Per ecosystem: test runner, coverage tool +
machine-readable output flags, cyclomatic tool + threshold flag, detection signals, and the
`lizard` fallback with its exact supported-language list.

**S3 — `skills/b-init-guardrails/docs/ratchet-protocol.md`.** The `guardrails.json` schema, the
two-gate semantics, baseline update rules (asymmetric: improve rewrites, regress fails), and the
cited threshold table with its authorities.

**S4 — `skills/b-init-guardrails/docs/agents-block.md`.** The managed-block template
(`<!-- BEGIN b-init-guardrails -->` … `<!-- END b-init-guardrails -->`) telling every future agent
when to dispatch a check, how to read a verdict, and what to do on failure.

**S5 — `skills/b-init-guardrails/scripts/detect-stack.ts`.** Deterministic stack detection from
manifest files, emitting JSON. Deterministic detection belongs in code, not in model judgement.
Follows the repo's `bun run <skill_dir>/scripts/*.ts` precedent.

**S6 — `skills/b-guardrails-check/SKILL.md`.** The check contract: resolve `guardrails.json`, run
the recorded commands, compare against gates, return a structured verdict. Defines both dispatch
modes (OMP async `task`; portable checkpoint-blocking) and the runtime detection rule. Measures and
reports only — never edits.

**S7 — Registration.** `prompts/b-init-guardrails.md` + `commands/b-init-guardrails.md` symlink;
same pair for `b-guardrails-check`; entries in `docs/buck-workflow.md`.

## Out of scope

- CI workflow files and git hooks (Light Grill Q4). The skill emits the commands; the human wires them.
- Any new extension or lifecycle hook — prohibited by the b-flow deprecation lesson.
- Mutation testing, performance budgets, security scanning, lint-rule ratcheting. Guardrails here are
  tests + coverage + cyclomatic complexity only.
- Authoring the project's actual missing tests. The skill measures and plans; `b-build` writes tests.
- Updating `docs/eval-kernel.md` to document the async `task`/`hub` contract. Real gap found during
  research (`research-harness-gate-mechanics.md` Finding 2) — file as a separate backlog item.
- Cognitive complexity as a *contract*. Recorded as a secondary metric where the native tool provides
  it, but the enforceable gate is cyclomatic, per the user's brief.

## Affected files

| File | Action |
|---|---|
| `skills/b-init-guardrails/SKILL.md` | create |
| `skills/b-init-guardrails/docs/tooling-matrix.md` | create |
| `skills/b-init-guardrails/docs/ratchet-protocol.md` | create |
| `skills/b-init-guardrails/docs/agents-block.md` | create |
| `skills/b-init-guardrails/scripts/detect-stack.ts` | create |
| `skills/b-guardrails-check/SKILL.md` | create |
| `prompts/b-init-guardrails.md` | create |
| `prompts/b-guardrails-check.md` | create |
| `commands/b-init-guardrails.md` | create (symlink → `../prompts/b-init-guardrails.md`) |
| `commands/b-guardrails-check.md` | create (symlink → `../prompts/b-guardrails-check.md`) |
| `docs/buck-workflow.md` | edit — register both skills in the Quick Reference Table |
| `.context/backlog/items/*.md`, `todo.md` | edit — register the eval-kernel doc-gap follow-up |

11 files across skill authoring, cross-harness wiring, and docs. **Above the `b-phase` thresholds.**

## Implementation steps

1. **Consolidate the tooling matrix** (S2) from the three research files into one reference doc.
   Preserve `[UNVERIFIED]` markers and the scc-is-not-McCabe warning verbatim.
2. **Define the `guardrails.json` schema** (S3): `version`, `targets`, `ratchet`, `ecosystems[]`
   (each with detected runner / coverage / complexity commands), `complexity_baseline[]`.
3. **Write the ratchet protocol** (S3): two-gate semantics, asymmetric update, burn-down rule, cited
   thresholds.
4. **Write `detect-stack.ts`** (S5): manifest globbing → ecosystem list → per-ecosystem tool presence
   → JSON on stdout. Pure, no network, no writes.
5. **Write `b-init-guardrails/SKILL.md`** (S1): Phase 0 idempotency check (create vs refresh), Phase 1
   detect, Phase 2 measure baseline, Phase 3 propose-and-confirm, Phase 4 write `guardrails.json`,
   Phase 5 wire the managed block, Phase 6 report the gradual-improvement plan.
6. **Write the managed-block template** (S4) with explicit dispatch triggers and the
   coherent-point rule from Light Grill Q3.
7. **Write `b-guardrails-check/SKILL.md`** (S6): verdict schema, both dispatch modes, runtime
   detection quoted from `b-loop`, and the measure-never-edit constraint.
8. **Wire registration** (S7): prompts, command symlinks, `docs/buck-workflow.md`.
9. **File the eval-kernel doc-gap backlog item.**

## Verification

Guardrail skills that cannot be demonstrated on a real repo are unverified. Proof is running them,
not reading them.

1. **Detection smoke test — polyglot.** Run `detect-stack.ts` against this repo (TS + Python +
   shell). Must identify vitest, and must not hallucinate tooling that is absent.
2. **Greenfield init.** Run `b-init-guardrails` in a scratch repo with tests but no coverage config.
   Must propose (not apply) the coverage setup, and on approval produce a valid `guardrails.json`.
3. **Brownfield init — the real test.** Run against a repo with genuinely low coverage and known
   complexity hotspots. Must record the measured baseline, must **not** set an unreachable target,
   and must emit a burn-down plan. A run that fails the repo on day one is a failed verification.
4. **Ratchet asymmetry.** Improve coverage → baseline rewrites upward. Regress → check fails and the
   baseline is unchanged. Both directions must be exercised.
5. **Patch gate.** Add an uncovered function, confirm `diff-cover` fails on changed lines while the
   global baseline still passes. This is the day-one-safety property; it must be demonstrated.
6. **Async dispatch on OMP.** Dispatch `b-guardrails-check` as a background `task`; confirm the
   mainline agent keeps working and the verdict auto-delivers. Confirm the portable path degrades to
   a blocking checkpoint run rather than erroring.
7. **Idempotency.** Re-run init. The managed block must update in place, not duplicate, and
   hand-authored content outside the markers must survive.
8. **Registration.** `/b-init-guardrails` and `/b-guardrails-check` resolve; `skill://` asset
   resolution works from both skills.

## Execution Instructions

<!-- OMP opt-in: this plan is recommended to run under `orchestrate` mode once phased.
     11 files across ≥4 dependency-ordered phases, with the schema (step 2) as a hard gate
     that every later phase consumes. -->

**Do not build from this plan directly — phase it first.** It exceeds the `b-phase` thresholds on
three counts: 9 implementation steps, 11 affected files, and two architectural layers (skill
authoring + cross-harness registration). The `guardrails.json` schema is a hard dependency for the
protocol doc, both SKILL.md files, and the detection script, so phase ordering is load-bearing
rather than cosmetic.

Run `/skill:b-phase` against this plan, then per phase:

1. Read the first non-completed phase from the Phase Summary table.
2. Read that phase file and execute only its scope using the listed `buck_hint`.
3. Drop the `orchestrate` keyword on the first turn before the build command.
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run
   `/b-review`. **Out-of-plan** findings route to a separate `/b-plan` → `/b-build` cycle and do not
   block this plan. If review flags documentation impact, run `/b-docs` before `/b-save`.
6. Run `/b-save`, then `/b-commit`.

## Risks

| Risk | Mitigation |
|---|---|
| **`guardrails.json` grows unusable** on a large brownfield repo — the complexity baseline could be thousands of entries in the single root file the user chose. | Ship a `complexity_baseline_file` pointer field from day one. Default inline; the skill offers to split to `.guardrails/complexity-baseline.json` above ~200 entries. Escape hatch exists without changing the chosen convention. |
| **False failures from tree contention** — check subagent reads a half-written tree. | Coherent-point dispatch only (Light Grill Q3); re-verify before escalating a failure verdict. Residual risk accepted and documented in the skill. |
| **Baseline becomes permanent debt suppression** rather than a burn-down list. | Follow PHPStan's stance explicitly — the skill reports baseline size on every run and states that the inventory's goal is to reach zero. Never auto-add new entries on a normal check; adding requires an explicit re-baseline. |
| **Tool detection is wrong**, and the skill runs a command the project does not have. | Detection is a deterministic script over manifest files, not model inference; every proposed command is shown to the user before it is recorded. Unknown ecosystems fall back to `lizard` or are recorded as unsupported rather than guessed. |
| **`lizard` gaps** — verified to have no Shell/Bash or Elixir reader, so the "universal" fallback is not universal. | Matrix marks these explicitly. Elixir has native `credo`; Shell has no cyclomatic option and is recorded as complexity-unsupported rather than papered over. |
| **Scope creep into a general quality platform** (lint ratcheting, mutation testing, security). | Out-of-scope list is explicit. Guardrails v1 is tests + coverage + cyclomatic only. |
| **Two skills is more surface than needed** if the managed block turns out to be sufficient. | Accepted deliberately by the user (Q1). The check skill is the canonical contract; the block only dispatches it, so there is one implementation and no logic duplication. |
