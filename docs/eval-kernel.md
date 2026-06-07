# Eval-Kernel Contract

> **Source-verified against omp v15.10.0** (`src/eval/py/prelude.py`,
> `src/goals/runtime.ts`, `src/prompts/system/workflow-notice.md`).
> Last verified: 2026-06-07.

This document captures the contract of omp's persistent **eval kernel**
for downstream skills (and for the next agent that picks up the work).
If you author an `eval-<topic>.py` cell, read this first.

## What it is

The eval kernel is a **persistent Python (or JavaScript) state** exposed
by omp's `eval` tool. State persists across:

- Multiple cells in the same session
- Tool calls made by subagents
- Subagent invocations via `agent()`

The kernel imports a small set of **prelude helpers** that give a Python
program access to omp's subagent dispatch, fan-out pools, staged
pipelines, LLM judge, status events, and per-turn budget.

When the user types the `workflow` keyword, omp injects
`src/prompts/system/workflow-notice.md`, which steers the model to
**author Python in the `eval` tool** rather than dispatching `task`
subagents directly. The eval cell is the *body* of the workflow.

The full kernel is OMP-specific. On other harnesses (Pi, Claude Code,
OpenCode, Codex) the helpers do not exist; the cell either fails or, if
it is wrapped in the `try / except ImportError` runtime probe that
`b-plan`'s "Eval Cell Template" section emits, degrades to a no-op. See
[Cross-platform](#cross-platform) below.

## Helpers

Every helper lives in `prelude` and is imported in the cell header:

```python
from prelude import agent, parallel, pipeline, llm, phase, log, budget  # noqa: F401
```

(Phase 1's runtime probe wraps this import in `try / except ImportError`
so the cell degrades to a no-op on non-OMP runtimes.)

### `agent(prompt, *, agent_type, model, context, label, schema) → object`

Run ONE subagent. Subagents **hand back raw data**, not summaries — so
always pass `schema=` to receive a parsed JSON object back.

```python
# Signature
agent(prompt: str, *,
      agent_type: str = "task",
      model: str | None = None,
      context: list[str] | None = None,
      label: str | None = None,
      schema: dict | None = None) -> object

# Returns
# When schema is set: a parsed object matching the JSON Schema.
# When schema is None: free-form text from the subagent.

# Example
result = agent(
    "Review the acceptance criteria in the active phase file.",
    agent_type="task",
    model=None,  # let the kernel pick per-tick
    schema={
        "type": "object",
        "properties": {
            "verdict": {"type": "string", "enum": ["pass", "fail"]},
            "evidence": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["verdict", "evidence"],
        "additionalProperties": False,
    },
    label="phase-review",
)
```

### `parallel(thunks) → list`

Run zero-arg callables through a bounded pool. **Pool width equals
`task.maxConcurrency`** — fan out as wide as the work divides. A thunk
that raises propagates: the first throw stops the pool and bubbles up
to the cell.

```python
# Signature
parallel(thunks: list[Callable[[], T]]) -> list[T]

# Returns
# One result per thunk, in input order.

# Example (binding the loop variable with a default arg)
findings = parallel(
    [lambda p=phase: agent(
        build_prompt(p),
        schema=FINDINGS_SCHEMA,
        label=f"phase-{p}",
    ) for phase in PHASES]
)
```

In a loop, **bind with a default arg** (`lambda d=d: …` or
`lambda n=num, s=slug, …: …`) — every thunk captures the *last* loop
value otherwise.

### `pipeline(items, *stages) → result`

Map each item through a sequence of one-arg callables. There is a
**barrier between stages**: every item clears stage N before any item
enters stage N+1. This is the place to put a verify-after-every-stage
check.

```python
# Signature
pipeline(items: list[T], *stages: Callable[[T], U]) -> U

# Returns
# The result of the LAST stage applied to the (now possibly-shrunk) list.

# Example — fan out, log per-phase, judge overall
overall = pipeline(
    findings_per_phase,                                  # items
    lambda findings: [log(f"phase {f['phase']}: {f['verdict']}")
                      for f in findings] or findings,    # stage 1
    lambda findings: llm(                                # stage 2
        "Synthesize these findings into a go/no-go verdict. "
        "Cite the per-phase evidence. Do not paraphrase.",
        schema=GO_NO_GO_SCHEMA,
    ),
)
```

### `llm(prompt, *, model, system, schema) → object`

Oneshot, stateless LLM call. **Use it as a judge.** Tiers: `"smol"`
(fast), `"default"` (this session's model), `"slow"` (most capable).

```python
# Signature
llm(prompt: str, *,
    model: str = "default",
    system: str | None = None,
    schema: dict | None = None) -> object

# Returns
# A string when schema is None. A parsed object when schema is set.

# Example
verdict = llm(
    "Adjudicate these per-target findings into a ready-to-migrate verdict. "
    "Score compatibility on [0, 1]. Estimate effort on trivial..epic.",
    model="default",
    schema={
        "type": "object",
        "properties": {
            "ready_to_migrate": {"type": "boolean"},
            "compatibility_score": {"type": "number", "minimum": 0, "maximum": 1},
            "effort_estimate": {"type": "string",
                                "enum": ["trivial", "small", "medium", "large", "epic"]},
            "blockers": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["ready_to_migrate", "compatibility_score",
                     "effort_estimate", "blockers"],
        "additionalProperties": False,
    },
)
```

### `phase(title)` / `log(message)`

Emit status events for the TUI. Use `phase(title)` to start a logical
group; use `log(message)` for progress lines. Both surface above the
status tree.

```python
phase("workflow: fan out per-phase review")
findings = parallel([...])
log(f"completed {len(findings)} phase reviews")
```

### `budget`

Per-turn budget object with `.total`, `.spent()`, and `.remaining()`.
The kernel checks `budget.remaining()` on every `agent()` spawn; once
the ceiling is hit, **`agent()` refuses to spawn**.

```python
# API
budget.total: int | None         # ceiling or None
budget.spent() -> int            # tokens spent this turn
budget.remaining() -> int | float.inf  # remaining (Infinity when total is None)
budget.hard: bool                # whether the ceiling is enforced (advisory vs hard)
```

A `+Nk` directive in a user message is **advisory** — you self-limit
via `budget.remaining()`. A `+Nk!` directive (or Goal Mode) is **hard** —
`agent()` refuses to spawn once `spent()` reaches the ceiling.

Read `budget.remaining()` *before* a fan-out and stop early if you
are running low. Log anything you drop — **no silent caps**.

## Budget

The budget object is shared with the **goal-mode runtime** when a goal
is active. The token-accounting rule (from
`src/goals/runtime.ts:87-99`):

```
goalTokenDelta = max(0, Δinput) + max(0, ΔcacheWrite) + max(0, Δoutput)
```

`cacheRead` is **excluded** because it is reused prefix, not new work.
omp deviates from codex here on purpose.

Hard vs. soft ceiling:

| Directive | Effect on `agent()` |
|---|---|
| *(no directive)* | No ceiling. `budget.remaining()` returns `math.inf`. |
| `+Nk` (advisory) | The cell is expected to self-limit. `agent()` still spawns. |
| `+Nk!` (hard) | `agent()` refuses to spawn once `budget.spent() >= N`. The cell should check `budget.remaining()` and halt cleanly. |
| Goal Mode (`/goal set`) | The active goal's `token_budget` is the hard ceiling. Same refusal behavior. |

A `+Nk` / `+Nk!` directive applies to the **current turn** (the agent
turn that receives the message). Goal Mode applies for the **whole
goal's lifetime** (across turns until `goal({op:"complete"})` or
`goal({op:"drop"})`).

**Budget exhaustion is not completion.** A truncated cell is a
`🔄 partial` result, not a pass. Surface what is missing.

## Schemas

Pass a JSON Schema via `schema=` to force structured output from
`agent()` or `llm()`. The kernel validates the LLM's response against
the schema and returns a parsed object.

**Required rule**: every schema dict in the eval kernel MUST set
`additionalProperties: false`. The kernel rejects parsers that
silently drop extras — strict schema is the default, not the option.

```python
# Minimum schema shape
SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["pass", "fail"]},
        "evidence": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["verdict", "evidence"],
    "additionalProperties": False,   # required
}
```

If you need a free-form field, declare it explicitly with
`{"type": "string"}` or `{"type": "array", "items": {"type": "string"}}`.
Do not rely on the parser to allow extras.

## Failure modes

| Failure | Behavior |
|---|---|
| `agent()` past a hard ceiling | Raises (the cell catches it or the kernel surfaces it). |
| `agent()` returns malformed JSON against `schema=` | Raises a parse error. Wrap the call in `try / except` if you want to degrade. |
| `parallel()` thunk raises | **First throw propagates** and stops the pool. There is no built-in retry. |
| `pipeline()` stage raises | Same as `parallel()` — the first throw propagates. |
| `phase()` / `log()` write to a closed TUI | No-op (the events were already emitted, the surface is gone). |
| `budget.remaining()` is `math.inf` | `if budget.remaining() < 5_000: log("halting")` will **never** fire — guard with `if budget.remaining() is not None and budget.remaining() < 5_000:`. |
| Subagent's LLM call hits a provider error | The subagent retries (per the subagent's own retry policy). The parent `agent()` does not retry. |

**Always check `budget.remaining() is not None` before comparing** —
the convention in the b-plan template is exactly that, and the
example cells in `.context/<subject>/eval-*.py` follow it.

## Cross-platform

The eval cell is **OMP-only**. On Pi, Claude Code, OpenCode, and
Codex, the `prelude` module is not present.

- **Phase 1's runtime probe** wraps `from prelude import ...` in
  `try / except ImportError` and binds the helpers to a `_no_op`
  fallback that prints a one-line message. A non-OMP cell that the
  user accidentally runs degrades to a no-op instead of crashing.
- **Phase 1's header guard** opens each `prompts/omp-*.md` slash
  command with a "Harness note" blockquote that declares the
  command a no-op on non-OMP harnesses.
- **`b-plan`'s "OMP Execution Recommendation" table** has a top-row
  guard that returns `none` on non-OMP, so the plan never recommends
  the `workflow` keyword where the kernel cannot run.

For the full cross-harness story, see
[`docs/buck-workflow.md#omp-autonomous-loops`](buck-workflow.md#omp-autonomous-loops).

## Patterns

The workflow-notice itself surfaces a small vocabulary of patterns.
Use them as building blocks:

- **Adversarial verify** — N refuters, keep when majority survives.
- **Perspective-diverse verify** — give each verifier a distinct lens
  (correctness, security, perf, does-it-reproduce).
- **Judge panel** — N attempts from different angles, scored by
  parallel judges; synthesize from the winner, graft the best of the
  rest.
- **Loop-until-dry** — keep spawning finders until K consecutive
  rounds surface nothing new; dedup against everything **seen**, not
  just what was confirmed, or it never converges.
- **Completeness critic** — a final agent that asks "what's missing
  — modality not run, claim unverified, file unread?" Its answer is
  the next round.
- **Budget/count loops** — `while budget.remaining() > 50_000: …`.
- **No silent caps** — log what you dropped.

## Authoring checklist

Before invoking the `workflow` keyword:

- [ ] `PHASES` list is filled with real phase files (not placeholders).
- [ ] Every `agent()` has a `schema=` with `additionalProperties: false`.
- [ ] `parallel()` thunks bind loop variables with a default arg.
- [ ] `pipeline()` stages are 1-arg callables (not zero-arg).
- [ ] `budget.remaining()` is checked *before* each fan-out.
- [ ] Cell ends with `if __name__ == "__main__":` for plain-Python
      syntax checking without the prelude.
- [ ] `python3 -c "import ast; ast.parse(open('<cell>').read())"`
      succeeds.

## See also

- [`docs/buck-workflow.md#omp-autonomous-loops`](buck-workflow.md#omp-autonomous-loops) —
  the buck-workflow side of the integration.
- `.context/2026-06-06.omp-integration-buck-workflow/research-omp-integration.md` —
  full source-verified analysis of the workflow contract.
- `.context/2026-06-06.omp-integration-buck-workflow/eval-review-audit.py` —
  per-phase review-audit example cell.
- `.context/2026-06-06.omp-integration-buck-workflow/eval-migration-sweep.py` —
  per-directory migration-sweep example cell with a multi-criterion
  `llm()` judge.
