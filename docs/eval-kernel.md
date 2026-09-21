# Eval-Kernel Contract

This document describes the current OMP `eval` runtime and the separate asynchronous `task` / `hub` job surface. Read it before authoring an `eval-<topic>.py` cell.

## Runtime model

`eval` runs code in a persistent Python or JavaScript kernel:

- Python and JavaScript have separate state.
- Top-level names survive later cells in the same language. Reuse them; do not redeclare JavaScript `const` / `let` names.
- `reset: true` wipes only the selected language kernel.
- Top-level `await` works. In Python, use it directly; `asyncio.run(...)` fails because an event loop already exists.
- Child agents use independent kernels. Parent-kernel variables are not shared with them.
- Work incrementally: imports → definitions → checks → use. Re-run setup only after a reset or kernel crash.

The helpers below are predeclared globals in the kernel. A source file used as an eval cell does not need `from prelude import ...`.

## Core helpers

### Data and artifacts

- `display(value)` / `print(...)` — emit cell output.
- `read(path, offset=1, limit=None)` — read repository files and internal URLs.
- `write(path, content)` — write a file or internal artifact.
- `env(key=None, value=None)` — read or set kernel environment values.
- `output(*ids, ...)` — read stored job output.

### `agent(...)` and `wait(...)`

`agent(prompt, agent="task", ...)` starts a child and returns an `AgentHandle` immediately. Useful options include `label`, `schema`, `schemaMode`, `isolated`, `apply`, `merge`, and a child tool allowlist.

A handle exposes:

- `.wait(timeout=None)` — wait for the final result.
- `.send(message)` — send follow-up input.
- `.cancel()` — stop the child.
- `.output()` — read currently available output.
- `.handle` — stable `agent://<id>` reference.

Unwaited results auto-deliver to the parent session. Use `wait(handles)` as a barrier; `raise_errors=False` keeps one failed branch from discarding successful siblings.

```python
FINDINGS_SCHEMA = {
    "type": "object",
    "properties": {
        "phase": {"type": "integer"},
        "verdict": {"type": "string", "enum": ["pass", "warn", "fail", "blocked"]},
        "evidence": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["phase", "verdict", "evidence"],
    "additionalProperties": False,
}

handles = [
    agent(
        f"Review phase {number} against its acceptance criteria.",
        agent="task",
        label=f"phase-{number}",
        schema=FINDINGS_SCHEMA,
    )
    for number in (1, 2, 3)
]
findings = wait(handles, raise_errors=False)
```

Dependencies must form an acyclic graph. A child cannot wait on its own descendant. For dependent waves, wait for or reference upstream output in the downstream prompt; use `local://...` artifacts for larger shared payloads.

### `completion(...)` and `judge(...)`

`completion(...)` is a stateless oneshot model call. It returns a handle; call `.wait()` for text or a schema-parsed object. Model tiers are `smol`, `default`, and `slow`.

`judge(state, questions)` performs inexpensive typed classification, boolean, or score judgments over one shared state. Prefer it to a free-form completion when the decision fits one of those shapes.

```python
import json

GO_NO_GO_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["go", "iterate", "block"]},
        "rationale": {"type": "string"},
    },
    "required": ["verdict", "rationale"],
    "additionalProperties": False,
}

overall = completion(
    "Adjudicate these phase findings. Cite evidence; do not merely paraphrase.\n\n"
    + json.dumps(findings, indent=2),
    model="default",
    schema=GO_NO_GO_SCHEMA,
).wait()
```

### `workpool(...)`

`workpool()` creates a keep-alive worker pool for an open-ended stream of independent items. Push items as they become available, inspect status, then close the pool. Use ordinary `agent()` handles plus `wait()` for a fixed batch.

### Kernel-defined tools

`@tool` or `tool(fn, ...)` exposes a kernel function to child agents. Pass its name through an agent or workpool tool allowlist. Remove obsolete definitions with `tool.undefine(name)`.

### Progress and budget

- `phase(title)` starts a visible logical phase.
- `log(message)` emits a progress line.
- `await budget.total()`, `await budget.spent()`, and `await budget.remaining()` inspect the active token budget.

A `+Nk` ceiling is advisory. `+Nk!` is hard. Budget exhaustion is not completion: surface partial results and the omitted work.

## Fixed-batch workflow cell

A current workflow cell uses handles and an explicit barrier, then adjudicates the gathered evidence:

```python
phase("workflow: review phases")
handles = [
    agent(build_prompt(*entry), agent="task", label=f"phase-{entry[0]}", schema=FINDINGS_SCHEMA)
    for entry in PHASES
]
findings_per_phase = wait(handles, raise_errors=False)

for finding in findings_per_phase:
    if isinstance(finding, dict):
        log(f"phase {finding['phase']}: {finding['verdict']}")

overall = completion(
    "Produce one go/iterate/block verdict from these findings:\n\n"
    + json.dumps(findings_per_phase, indent=2),
    model="default",
    schema=GO_NO_GO_SCHEMA,
).wait()
log(f"workflow verdict: {overall['verdict']}")
```

The former `parallel()`, `pipeline()`, and `llm()` helpers are not part of the current prelude:

| Former pattern | Current pattern |
|---|---|
| `parallel(thunks)` | Create multiple `agent()` handles, then `wait(handles)` |
| `pipeline(items, stages...)` | Explicit Python/JavaScript stages separated by `wait()` barriers |
| `llm(prompt, schema=...)` | `completion(prompt, schema=...).wait()` or typed `judge(...)` |
| `agent(..., agent_type="task")` | `agent(..., agent="task")` |
| synchronous `budget.remaining()` | `await budget.remaining()` |

## Async `task` / `hub` jobs are separate

The session-level `task` and `hub` tools are not eval-prelude helpers. They dispatch independent jobs outside the kernel:

- `task` accepts a batch and returns job IDs immediately; the mainline agent keeps working.
- `hub` lists jobs, waits for IDs, reads the inbox, sends messages, or cancels jobs.
- Settled results auto-deliver.
- `agent://<id>` addresses a result artifact; `history://<id>` addresses the agent transcript when recovery is needed.
- Job-result retention is short-lived—operationally about five minutes after settlement—so consume or persist important output promptly.

Use `task` / `hub` for background scouts, independent checks, and work whose result can arrive asynchronously. Use eval handles when computation needs persistent kernel state, explicit dependency waves, structured schemas, kernel-defined tools, or in-cell synthesis.

Conceptual session-tool calls:

```text
task({
  context: "Shared repository and acceptance context",
  tasks: [
    { name: "api-scout", task: "Inspect the API surface and report evidence", agent: "task" },
    { name: "test-scout", task: "Inspect test coverage and report gaps", agent: "task" }
  ]
})

hub({ op: "wait", ids: ["<job-id>"] })
```

Do not describe `task` as blocking and do not import it from the eval prelude.

## Failure behavior

- A schema mismatch fails that handle rather than silently dropping fields.
- `wait(handles)` raises by default when a child fails; use `raise_errors=False` only when partial results are meaningful and explicitly handled.
- A child does not inherit parent-kernel variables or closures. Put required context in the prompt or a shared artifact.
- A dependency graph must remain acyclic.
- Provider and tool failures remain failures; do not convert missing evidence into a pass.
- Use a bounded timeout where an external operation can stall.

## Cross-platform scope

The persistent eval kernel and its predeclared helpers are OMP-specific. Other harnesses may expose different execution or subagent APIs. A portable skill must probe the active runtime and either choose its native mechanism or state that the OMP workflow cell is unavailable; it must not pretend obsolete helpers exist.

## Authoring checklist

Before invoking a workflow cell:

- [ ] Replace every placeholder with real paths and acceptance criteria.
- [ ] Give each independent child a complete prompt and a unique label.
- [ ] Use strict schemas where downstream code depends on fields.
- [ ] Join fixed batches with `wait()` and handle failures deliberately.
- [ ] Keep dependencies acyclic.
- [ ] Use top-level `await` for budget or other async helpers.
- [ ] Syntax-check a stored Python cell with `ast.parse`.
- [ ] Persist important async job output before the short result-retention window expires.

## See also

- [`docs/buck-workflow.md#omp-autonomous-loops`](buck-workflow.md#omp-autonomous-loops)
- [`skills/b-plan/SKILL.md`](../skills/b-plan/SKILL.md) — current workflow-cell template
- [`skills/b-guardrails-check/SKILL.md`](../skills/b-guardrails-check/SKILL.md) — background check dispatch using session `task`
