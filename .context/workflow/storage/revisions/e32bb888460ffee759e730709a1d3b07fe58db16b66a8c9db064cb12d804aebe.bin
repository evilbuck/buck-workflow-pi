---
status: active
date: 2026-07-26
subject: 2026-07-26.b-init-guardrails
topics: [guardrails, subagents, harness, omp, async, runtime-detection]
informs: [plan-b-init-guardrails.md]
---

# Harness Gate Mechanics — how a background check actually runs

The user requirement is: *"use subagents as much as possible for testing cyclomatic complexity as we
develop so it doesn't stop us — inform the mainline agent if a test fails or coverage falls below."*

This file records what is actually achievable per harness. The answer differs sharply between the
**repo's documented skill surface** and the **live OMP runtime**.

## Finding 1 — the repo docs describe only *blocking* fan-out

Scouted across `docs/`, `skills/`, `extensions/`, `prompts/`:

| Surface | Mechanism | Blocking? | Citation |
|---|---|---|---|
| OMP eval kernel | `agent()`, `parallel()`, `pipeline()`, `llm()` | **Yes** — return values, no handles | `docs/eval-kernel.md` |
| OMP `orchestrate` | parallel `task` subagents | **Yes** — "do not yield until everything is closed" | `.context/2026-06-06.omp-integration-buck-workflow/research-omp-integration.md:46-83` |
| Portable (Pi/Claude/Codex/Goose) | one `task` per unit in a `tasks[]` batch | **Yes** — orchestrator collects outputs | `skills/code-smells/SKILL.md:76` |
| `b-research` | prose: "dispatch in the background; keep working" | Instruction-level only, **no API** | `docs/buck-workflow.md:479-480` |

There is **no** in-repo documentation of `hub`, job handles, or auto-delivery.
`docs/eval-kernel.md` does not expose `handle`, `hub`, `tool`, `write`, or `read` in the prelude.

## Finding 2 — the live OMP runtime *does* have async job delivery (repo docs are stale)

Verified empirically during this planning session, not from docs. The OMP `task` tool contract:

> Delegate work to background subagents by passing multiple items in a single `tasks[]` batch.
> **Execution does not block — you receive IDs immediately.**
> \# Async Job Contract — **Results auto-deliver.**

Paired with the `hub` tool (`op: jobs | wait | inbox | send | cancel`). This was exercised four
times while producing this subject's research: batches were dispatched, the main agent continued
working, and results were delivered mid-session without a blocking wait.

**This is exactly the primitive the user is asking for**, and the repo's own docs do not mention it.
`docs/eval-kernel.md` therefore needs an update — tracked as a follow-up, not part of the skill.

## Finding 3 — per-harness capability matrix

| Harness | Non-blocking check | Mechanism | Fallback |
|---|---|---|---|
| **OMP** | **Yes** | `task` fire-and-forget + `hub` auto-delivery | — |
| **Pi** | No documented job API | — | Blocking `task` at checkpoints |
| **Claude Code** | No | — | Blocking sub-agent at checkpoints |
| **Codex** | No | "built-in subagent orchestration" only (`docs/codex.md:107`) | Blocking `tasks[]` |
| **Goose** | No | recipes / `PreToolUse` (denial hook, not a quality gate) | Blocking, or manual |

**Design consequence:** the skill must define **one canonical check contract** (inputs, commands,
verdict schema) and two dispatch modes — async on OMP, checkpoint-blocking everywhere else. The
check logic is identical; only the dispatch primitive varies. This mirrors `code-smells`'s
established "canonical logic, differing fan-out primitive" split.

## Finding 4 — runtime detection (exact rules, do not improvise)

`skills/b-loop/SKILL.md:86-90` — the strictest and preferred formulation:

> Detect the active harness from session/runtime state — `omp.runtime` or `pi.runtime` are typical
> signals. **Do not probe `package.json`'s `omp` field** for this purpose: this package always
> declares `omp` regardless of which harness loads it. If unsure, default to `none`.

`skills/fix-pr/SKILL.md:61-63` says the same. Inside an eval cell the probe is
`try: from prelude import ... except ImportError:`.

| Signal | Means |
|---|---|
| `omp.runtime` present / `omp` tool available | OMP → async `task` + `hub` |
| `pi.runtime` present | Pi → blocking `task` at checkpoints |
| Neither | Claude / Codex / Goose / unknown → blocking, portable |
| `package.json` has `"omp"` | **Insufficient** — always declared |

## Finding 5 — there is NO working post-edit hook in this package

| Fact | Citation |
|---|---|
| Only `extensions/index.ts` is wired; it handles `session_start`, `input`, `before_agent_start`, `model_select`, `agent_end` — model switching only | `package.json`, `extensions/index.ts` |
| Tests **explicitly assert** the extension registers no `tool_call` / `tool_result` / `session_before_compact` | `extensions/buck-mode.test.ts:167-182` |
| `extensions/b-flow/` had orchestration hooks; deprecated and unwired | `.context/2026-06-01.deprecate-b-flow/` |
| OMP discovers `hooks/pre/`, `hooks/post/` — **this package ships none** | `docs/extension-loading.md:159-161` |

Root `AGENTS.md` states the lesson directly: *"no new extension-based orchestration, prompt-level /
skill-level only."*

**Design consequence:** "run a check after every edit" cannot be implemented as a hook. It must be
an *instruction* the mainline agent follows — which is why the managed `AGENTS.md` block is the
delivery mechanism, not an extension.

## Finding 6 — working-tree contention is a real correctness risk

A check subagent shares the working tree with the still-editing mainline agent. Running the suite
mid-edit reads a half-written tree and produces false failures.

Note also OMP orchestrate Rule 9: *"Subagents do not verify, lint, or format. Subagents edit only.
The orchestrator runs the gates once at the end."* Guardrail subagents invert this deliberately —
they **measure and never edit**, so they cannot corrupt each other's work, but they still contend on
the tree for *reads*.

**Resolution chosen (see plan Light Grill Q3):** dispatch only at coherent points — after a
completed edit batch, never per-file — and re-verify before escalating a failure verdict. Rejected
alternatives: `git worktree` snapshots (breaks on uncommitted-only work, costs disk) and
advisory-only (too weak for the stated requirement).
