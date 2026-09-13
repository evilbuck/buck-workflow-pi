# Code Review Iteration

Isolated Reviewer → Fixer → fresh-Reviewer loop owned by `/code-review`. This context names the roles, artifacts, evidence, and severity dimensions so domain experts keep them distinct.

## Language

**Reviewer**:
The OMP SDK session that produces a structured finding payload in a disposable detached worktree, with read/search tools plus `review_exec`.
_Avoid_: LLM reviewer, model reviewer

**Fixer**:
The OMP SDK session that verifies each blocking finding independently and edits only valid ones in the review checkout.
_Avoid_: auto-fix agent, patcher

**Pass**:
One full Reviewer → Fixer → fresh Reviewer cycle with immutable artifacts in `passes/NN/`.
_Avoid_: iteration, round, run

**Reviewer pass / Fixer pass**:
The half of a Pass owned by one role.
_Avoid_: review round, fix round, iteration half

**Run**:
One invocation of `/code-review`, identified by a `run-id`, with state under `<git-common-dir>/code-review-iteration/<branch-key>/<run-id>/`.
_Avoid_: session, job

**RunState**:
The single mutable `state.json` for a Run, written atomically.
_Avoid_: session state, job state

**PassReviewRecord / PassFixerRecord**:
The JSON shapes in `passes/NN/review.json` and `fixes/NN/fixer.json`.
_Avoid_: review output, fixer output

**`review_exec`**:
The structured trust-boundary tool the Reviewer uses to run a reproduction command.
_Avoid_: shell, bash, exec

**`commands.jsonl`**:
The bounded, sanitized record of every `review_exec` invocation in a pass.
_Avoid_: command log, audit log

**Reproduction**:
The per-finding object (`reproduced | not_reproduced | not_run | not_applicable`) with optional `command_ids` citing `commands.jsonl` ids.
_Avoid_: repro, proof

**Evidence id**:
The `cN` identifier assigned to one `review_exec` record, and the only id a finding may cite for a `reproduced` Reproduction.
_Avoid_: command id, citation id

**Hardness**:
One of `easy | medium | hard`, distinct from Criticality, and the routing input for Fixer model selection.
_Avoid_: difficulty, complexity, severity

**Criticality**:
One of `advisory | low | medium | high | critical`, computed from impact / likelihood / breadth, and distinct from Hardness.
_Avoid_: severity, priority, hardness

**Rubric**:
The deterministic floors and inputs that compute Criticality.
_Avoid_: scoring, severity matrix

## Relationships

- A **Run** spans up to N **Passes** (default 3).
- A **Pass** contains exactly one **Reviewer pass** followed by exactly one **Fixer pass**.
- A **Reviewer pass** produces one **PassReviewRecord**; a **Fixer pass** produces one **PassFixerRecord**.
- A **PassReviewRecord** may cite zero or more **Evidence ids** in its **Reproduction** objects.
- **Hardness** drives Fixer routing; **Criticality** drives the pass bound.
- Each **`review_exec`** invocation appends one **`commands.jsonl`** record and mints one **Evidence id**.
- A **Rubric** computes **Criticality**; **Hardness** is independent.

## Example dialogue

> **Dev:** "When the Reviewer says `reproduced`, does that mean the Fixer doesn't re-run the command?"
> **Domain expert:** "No. `reproduced` is a Reviewer claim backed by a cited **Evidence id** in **commands.jsonl**. The **Fixer** still independently verifies each blocking finding and records `valid | invalid | already_fixed | blocked`. The two verdicts are separate artifacts."

## Flagged ambiguities

- "session" names the OMP SDK process for a **Reviewer** or **Fixer**, never a **Run**.
- "run" / "iteration" / "round" are not a **Pass**; a **Run** is the `/code-review` invocation that spans Passes.
- "severity" is not a term — use **Hardness** (Fixer routing) or **Criticality** (pass bound).
