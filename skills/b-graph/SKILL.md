---
name: b-graph
description: Run a task as a graph of bounded, verifiable nodes — split before starting, dispatch independent nodes in parallel (subagents for judgment, code for deterministic steps), gate every edge on evidence, retry failed nodes rather than whole batches, and leave graph.md/checks.md/progress.md so any session can resume. Use /b-graph for fan-out work or long tasks that must survive handoff.
---

# b-graph: Task as a Graph of Bounded Nodes

Act as the lead that designs, runs, and maintains the graph. Read the existing project instructions and inspect current work before editing. Plan and merge yourself; give bounded work to subagents. Record every decision that updates the graph.

Complete the task as a **graph** of bounded **nodes**, not one long session. A node is one bounded job: one input, one output, one check. Define completion before starting. Stop when every node's checks pass or the agreed limit is reached. Leave a usable result, a verification report, and `graph.md` so another session can rerun or extend the work.

> Adapted from @hanakoxbt's agent-graph prompt, inspired by
> [karpathy/autoresearch](https://github.com/karpathy/autoresearch). Not
> written or endorsed by Andrej Karpathy. See `THIRD-PARTY-NOTICES.md`.

## Principles (from autoresearch)

- Establish a baseline before changing the system.
- Give every node one clear scope and a fixed evaluator.
- Change one thing, measure it, and keep useful improvements. Record failed attempts too.
- Prefer fewer nodes when results are comparable.

## Inputs

When no arguments or explicit context exist, resolve the subject with the shared subject-resolution protocol before resolving inputs or starting graph work.

Resolve all six before starting — from the invocation, the active subject, or one focused question when the missing answer changes the outcome.

| Field | Meaning | Default |
|-------|---------|---------|
| `TASK` | What to complete | The invocation's arguments |
| `OUTPUT` | Deliverable and output path | Inferred from `TASK`; confirm before the first edit |
| `CHECKS` | Acceptance checks | Plan/spec acceptance criteria when present |
| `SOURCES` | Source material | Subject-folder research artifacts |
| `SCOPE` | Allowed changes | Inferred; confirm before the first edit |
| `LIMIT` | Run limit | 3 correction attempts per node |

## Layer 1 — Split

Break `TASK` into nodes before any work starts. Split by what each node must read, not by folder. Draw an **edge** only when a node uses another node's output; nodes with no edge between them are **parallel**.

Before writing, check the target location for an existing run: if `graph.md` is already there, read it and either resume that run or confirm replacement with the user — never overwrite silently.

Write nodes, edges, and checks into `graph.md` and pause for approval.

## Layer 2 — Dispatch

Run each judgment node as its own subagent with only the context it needs. Run each code node through its deterministic implementation:

1. Pass the node spec, its inputs, and its check.
2. Build the artifact for that node only.
3. Run the node's check against the saved artifact.
4. Return the output path, verdict, and evidence.

Keep node specs reusable across new source sets.

## Layer 3 — Code nodes

A step with exactly one correct answer (merge, sort, dedupe, compare, count) is a **code node**, written as code. A model call is for judgment only. List every code node in `graph.md`; route deterministic steps through code, never through a subagent.

If a required tool is unavailable, name the blocker and preserve the nodes that can still be completed.

## Layer 4 — Permissions

Check the active permissions before running the graph. Keep every edit inside `SCOPE`. Configure tool rules or sandbox controls when enforcement is required — running unattended is not a boundary.

- Ask before publishing, sending, or spending.
- One writer per file: two sessions never edit the same file.
- Preserve a recoverable version (commit or stash) before a risky merge.

## Layer 5 — Gates

Put a **gate** on every edge that carries risky work. Open it on evidence: deterministic checks first, then the node's report, the model's confidence last.

Save `checks.md` with one row per requirement:

```
node | requirement | verdict | evidence
```

Verdicts are `pass`, `fail`, or `unresolved`. Evidence is a file path or actual check output. Missing evidence stays visible as `unresolved`.

## Layer 6 — Return paths

Two edges close the loop:

- **Correction edge** — a failed gate sends the unit back to the node that made it, with the reason, the evidence, and the scope "fix this node only". Cap at `LIMIT` attempts; then mark the node blocked and continue elsewhere.
- **Learning edge** — after an accepted result, write the rule it confirms into `graph.md` so the next run starts from it.

## Layer 7 — Completion

Before execution, write a completion checklist from `CHECKS` where every item points to observable evidence:

- Every node's output exists and opens.
- Every gate ran against the saved version.
- Failures are fixed or explicitly reported.
- Project instructions (`AGENTS.md` / `CLAUDE.md`) reflect the rules this run confirmed; durable memory goes through `/b-save`.

If a limit or blocker stops the run, return a partial status with the exact steps left.

## Execution loop

1. Read `graph.md` and pick the next ready nodes.
2. Run independent nodes in parallel.
3. Pass every output through its gate.
4. Return failed nodes, never the whole batch.
5. Merge accepted outputs and run the full checks. A full-check failure has no single node: record it as a new node in `graph.md` with its own check, and correct it through the same correction edge.
6. Continue until completion, a global blocker, or no ready nodes remain. A node that exhausts `LIMIT` is blocked; independent ready nodes continue.

Do not weaken a gate to obtain a pass.

## Handoff

After each stage, update `progress.md`:

- **Graph** — nodes done, running, blocked, with the failed-attempt count per node so a resumed session inherits the `LIMIT` budget.
- **Outputs** — exact paths to current saved files.
- **Decisions** — what changed in `graph.md` and why.
- **Open issues** — failures, uncertainties, blockers.
- **Next action** — the next ready node.

On resumption, read `graph.md` and `progress.md` first, then continue from the recorded next node. Each `running` node records the run that started it; a resumed session re-dispatches a `running` node only after confirming its run is dead (no fresh handoff update), and never while the original run may still be active.

## Artifacts

Follow the shared protocol at `skills/_shared/subject-resolution.md`. With a subject, write `graph.md`, `checks.md`, and `progress.md` into the subject folder. Without one, write them under `.context/` — `/b-save` consolidates the subject at session end.

## Delivery

Return `OUTPUT` plus `graph.md`, `checks.md`, and `progress.md`. State what was checked, what passed, and what remains unresolved. After review, save the graph as a reusable template. Report measured usage when available; inferred savings stay out of the report.

Closeout: recommend `/b-review` for validation, `/b-save`, then `/b-commit`.
