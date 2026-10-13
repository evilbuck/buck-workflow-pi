---
status: completed
date: 2026-08-12
completed_at: 2026-08-12
subject: 2026-08-12.standalone-b-plan-bootstrap
topics: [b-plan, standalone, bootstrap, install-detection, github, cross-harness]
research: []
iterations: []
spec:
memory:
  - standalone-b-plan-bootstrap-build-2026-08-12.md
---

# Plan: Standalone B-Plan Bootstrap and Full-Workflow Detection

## User Goal

B-Plan should work as a mini subset of Buck Workflow and, when the full workflow is not installed, explain how to fetch and install it from the GitHub repository after first identifying whether it is installed.

## Goal

Make `b-plan` self-contained enough to produce a durable, implementation-ready plan when it is the only Buck skill available. At startup it must distinguish a full, partial, standalone, or unknown Buck Workflow installation in the **active agent session** and adapt its handoff without weakening the existing full-workflow behavior.

## Context used / assumptions

- **User-provided context:** B-Plan is a mini Buck Workflow subset; it must include GitHub fetch/install guidance and first determine whether Buck Workflow exists.
- **Current B-Plan:** `skills/b-plan/SKILL.md` assumes full-package files and skills exist, including `skills/_shared/subject-resolution.md`, `b-phase`, `b-build`, `b-review`, `b-save`, repository docs, and OMP eval examples. Those assumptions fail if only `skills/b-plan/` is installed.
- **Current install surface:** `agent-install_instructions.md` already defines GitHub install paths for Pi, OMP, Codex, OpenCode, and Claude Code. `README.md` documents the multi-harness installer.
- **Existing installer boundary:** `scripts/install.mjs` detects agent harness directories and wires declared surfaces; it does not prove that companion Buck skills are loaded in the current session. Harness presence, a source checkout, `.context/`, or bootstrap `AGENTS.md` therefore cannot be treated as proof of a full installation.
- **Related prior work:** `.context/2026-06-12.multi-harness-symlink-installer/plan-symlink-installer.md` established the supported-harness matrix and safe, idempotent symlink behavior. This plan reuses that install contract rather than redesigning it.
- **Assumption — mini subset:** standalone B-Plan owns only the planning slice: inspect relevant context/code, ask only material clarifications, create `.context/YYYY-MM-DD.<subject>/index.md`, and write a bounded `plan-*.md` with user goal, scope, affected files, steps, verification, and risks.
- **Assumption — no automatic install:** B-Plan reports exact commands and verification steps, but does not mutate global agent configuration or install packages without a separate explicit user request.
- **Untouched user work:** the existing modification to `skills/b-init-guardrails/scripts/detect-stack.ts` is unrelated and must remain untouched.

## Scope

### In scope

- Add an early, portable Buck Workflow capability probe to B-Plan.
- Define four explicit states:
  - `full`: all required companion capabilities are discoverable in the active session.
  - `partial`: at least one companion is discoverable, but the required set is incomplete.
  - `standalone`: B-Plan is available and none of the companion sentinels are discoverable.
  - `unknown`: the harness exposes no reliable skill inventory or loader-native probe; do not claim absence.
- Use `b-build`, `b-review`, and `b-save` as the minimum full-workflow sentinels. Probe through the active harness's skill registry or loader-native resolution, not by assuming a filesystem path.
- Add a self-contained standalone planning path that has no mandatory dependency outside `skills/b-plan/` and `.context/`.
- Gate shared subject resolution, backlog stitching, phasing, OMP execution/eval behavior, and downstream Buck handoffs behind `full` capability.
- For `partial`, `standalone`, and actionable `unknown` states, show a compact, harness-specific GitHub install/repair handoff plus restart/reload and verification instructions.
- Keep the detailed installation source of truth aligned with `agent-install_instructions.md` and expose the standalone behavior in `README.md`.

### Out of scope

- Reimplementing `b-build`, `b-review`, `b-save`, `b-docs`, `b-phase`, or `b-commit` inside B-Plan.
- Treating `.context/`, an `AGENTS.md` bootstrap, a package checkout, or an installed harness executable as proof that Buck skills are loaded.
- Automatically cloning, linking, overwriting, or editing global harness configuration from a planning invocation.
- Rewriting the multi-harness installer or adding a machine-wide package manager/status daemon.
- Publishing a separate npm package or marketplace entry for standalone B-Plan.
- Supporting Cursor's project-rule adapter beyond linking to the existing documented limitation.

## Detection contract

1. **Detect active capabilities before reading full-workflow-only files.** The presence of the current B-Plan skill proves only B-Plan itself.
2. **Probe the runtime skill catalog first.** Look for the canonical companion skills `b-build`, `b-review`, and `b-save` using whatever inventory/resolution API the active harness exposes.
3. **Classify deterministically:**
   - 3/3 sentinels resolve → `full`.
   - 1–2 resolve → `partial`, list the missing sentinels.
   - 0 resolve and the probe is authoritative → `standalone`.
   - The runtime cannot answer reliably → `unknown`.
4. **Never silently convert `unknown` to absent.** Continue with the mini planning path and label the install handoff as conditional.
5. **Do not shell-scan every known global directory.** Harness stores and symlink layouts vary; loaded capability is the user-relevant signal.
6. **After installation, require a session reload/restart and repeat the same sentinel probe.** A successful command alone is not proof that the current session gained the skills.

## Standalone mini-workflow contract

When state is not `full`, B-Plan must still complete the core planning deliverable:

1. Use explicit user context first; inspect only relevant local code and existing `.context/` artifacts that are actually present.
2. Ask only questions whose answers materially change scope, acceptance criteria, risks, or verification. Preserve the required `## User Goal` gate.
3. Create or reuse a dated subject folder without requiring `_shared/subject-resolution.md`.
4. Write `index.md` with `status: active` and a `plan-*.md` containing the standard plan frontmatter and core sections.
5. Do not create backlog, memory, phase, eval-cell, review, or commit artifacts as substitutes for unavailable skills.
6. End with the saved plan path, detected installation state, missing capabilities (if known), GitHub install/repair guidance, and a verification step.

## Installation handoff contract

Embed a compact table in B-Plan so the standalone copy remains useful without root repository docs. Keep the longer rationale and alternatives in `agent-install_instructions.md`.

| Harness | GitHub installation handoff |
|---|---|
| Pi | `pi install git:github.com/evilbuck/buck-workflow-pi` |
| OMP | `omp install git:github.com/evilbuck/buck-workflow-pi` |
| Claude Code | Clone `https://github.com/evilbuck/buck-workflow-pi` to a durable path, then run its `scripts/install.mjs --harness claude`; do not use an ephemeral clone as a symlink target. |
| OpenCode | Clone `https://github.com/evilbuck/buck-workflow-pi` to a durable path, then run `scripts/install.mjs --harness opencode`. |
| Codex | Clone `https://github.com/evilbuck/buck-workflow-pi` to a durable path and link each `skills/<name>/` into `~/.agents/skills/<name>/`; the current installer only wires Codex bootstrap instructions and is not by itself proof of full skill availability. |
| Unknown/other | Link to `https://github.com/evilbuck/buck-workflow-pi/blob/master/agent-install_instructions.md`, identify the harness before giving a command, and avoid guessing a global directory. |

Every handoff must also say:

- Preserve existing real files and use dry-run/default non-force behavior where the installer supports it.
- Restart or reload the agent so its skill catalog refreshes.
- Re-run the three-sentinel capability probe; report `full` only when all resolve.

## Affected files

| File | Change |
|---|---|
| `skills/b-plan/SKILL.md` | Add mode detection before external dependencies; define the self-contained mini workflow; gate full-only behavior; embed compact install/repair instructions. |
| `prompts/b-plan.md` | Update the wrapper description so users understand B-Plan works standalone and can bootstrap the full workflow. `commands/b-plan.md` remains a symlink and inherits the change. |
| `agent-install_instructions.md` | Add the authoritative full/partial/standalone detection semantics, durable-clone requirement, session reload, and post-install sentinel verification. |
| `README.md` | Document standalone B-Plan behavior and distinguish “harness detected,” “source available,” and “Buck skills loaded.” |

`package.json`, `scripts/install.mjs`, and `scripts/install.test.mjs` remain unchanged in this plan. Agent-level skill availability is the correct signal; extending harness-directory detection would create false positives.

## Implementation steps

1. **Restructure B-Plan entry flow.** Put the capability probe and state classification before `Subject Resolution` or any read of `_shared`, downstream skills, repository docs, or OMP examples.
2. **Define the minimal sentinel set and evidence rules.** Require loader-native discovery of `b-build`, `b-review`, and `b-save`; document full, partial, standalone, and unknown outcomes and prohibit filesystem/source-checkout proxies.
3. **Add the standalone mini workflow.** Inline the smallest subject-resolution, artifact, clarification, plan-shape, and output contracts needed to produce a durable plan from `skills/b-plan/` alone.
4. **Gate full-workflow extensions.** Run existing artifact stitching, backlog creation, phasing, OMP recommendation/eval-cell generation, and Buck execution-loop handoffs only in `full` mode. Preserve their current behavior in that mode.
5. **Add the install/repair handoff.** Embed the compact harness matrix above, distinguish install from repair, require a durable clone for symlink-based harnesses, and verify by reloading plus repeating the sentinel probe.
6. **Align wrapper and canonical docs.** Update `prompts/b-plan.md`, `agent-install_instructions.md`, and `README.md` without duplicating long per-harness instructions inside B-Plan.
7. **Exercise all four states.** Verify standalone, partial, full, and unknown behavior, then perform one real active-harness reload/install smoke test to prove the state transition rather than only checking prose.

## Acceptance criteria

- A session with only `skills/b-plan/` available completes a plan without trying to read `_shared`, `b-phase`, OMP eval examples, or other unavailable Buck files.
- B-Plan reports `full` only when `b-build`, `b-review`, and `b-save` are discoverable in the active session.
- A partial install names the missing companion capabilities and offers repair guidance; it does not take the full-workflow path.
- An uninspectable harness reports `unknown`, continues planning, and presents conditional verification/install guidance rather than a false “not installed” claim.
- Standalone output still creates an active subject `index.md` and a complete plan with User Goal, scope, affected files, steps, verification, and risks.
- The install handoff contains a working GitHub path for Pi, OMP, Claude Code, OpenCode, and Codex and explicitly requires reload plus sentinel recheck.
- Full Buck installations retain current B-Plan behavior, including shared subject resolution, cross-reference stitching, phasing thresholds, and OMP recommendations.
- No path treats a Buck source checkout, `.context/`, an agent executable, or bootstrap instructions alone as a full installation.

## Verification

- **Standalone fixture:** expose only `skills/b-plan/` to a clean agent profile, invoke B-Plan with a small coding request, and confirm it creates both subject artifacts with no missing-file/tool failure and reports `standalone`.
- **Partial fixture:** expose B-Plan plus exactly one sentinel, invoke it, and confirm `partial` names the other two and stays on the mini path.
- **Full fixture:** expose the complete package, invoke the same request, and confirm all three sentinels resolve and current full-mode subject/artifact behavior still runs.
- **Unknown fixture:** use a harness/test double with no skill-inventory API; confirm B-Plan labels the state `unknown` and does not assert absence.
- **Install transition smoke test:** from one supported clean profile, follow B-Plan's GitHub handoff, reload the harness, re-run the sentinel probe, and observe the state change to `full`.
- **Safety check:** pre-create a real destination file for a symlink-based harness and confirm the documented default path does not overwrite it.
- **Documentation reconciliation:** compare the compact commands in B-Plan with `agent-install_instructions.md` and the README install section; each supported harness must have one consistent canonical path and verification outcome.

## Risks

| Risk | Mitigation |
|---|---|
| Runtime inventories use different APIs and names | Specify capability semantics, not one OMP-only tool call; use the active harness's loader-native discovery and preserve `unknown` when unavailable. |
| A copied B-Plan still follows full-only references later in the file | Make mode gating structural and early; standalone acceptance explicitly runs with no sibling/shared files present. |
| Three sentinels are present but another optional Buck skill is missing | Define `full` as the minimum execution cycle, not every optional skill; downstream optional capabilities remain individually gated. |
| Install prose drifts between B-Plan, README, and the canonical install guide | Keep B-Plan's matrix compact and make `agent-install_instructions.md` authoritative; verification includes command reconciliation. |
| Symlinks point into an ephemeral checkout | Require a durable clone path for symlink-based harnesses and document update/relink behavior. |
| Installation succeeds but the current session remains stale | Require restart/reload and repeat the sentinel probe before reporting success. |
| Standalone mode grows into a second workflow implementation | Enforce the explicit mini-workflow boundary and keep build/review/save/docs/commit out of scope. |

## Execution Instructions

<!-- OMP opt-in: this plan is recommended to run under goal mode. It is one persistent cross-harness objective with no useful phase boundary. Suggested budget: 12k tokens. -->

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Optionally run `/goal set "Make B-Plan self-contained and bootstrap the full Buck Workflow when absent" --budget 12000`.
2. Run `/b-build-hard` against this plan; cross-harness capability discovery and isolated standalone verification warrant hard mode.
3. Run `/b-review` against this plan.
4. If review creates an `iterate-*.md` artifact for in-plan issues, run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate `/b-plan` → `/b-build` cycle. If review flags documentation impact, run `/b-docs` before `/b-save`.
5. Run `/b-save`, then `/b-commit`.
6. If interrupted, record the active state and resume from this plan or its iterate artifact.
