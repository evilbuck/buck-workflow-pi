"""
Cross-harness kernel phasing — workflow-mode migration-sweep.

Edit this cell before invoking the `workflow` keyword in omp. The cell
demonstrates the per-directory `parallel()` + multi-criterion `llm()`
judge pattern (vs the per-phase `parallel()` in eval-review-audit.py).

Use when the work is a migration-sweep: enumerate directories, fan out
per-directory review, then a judge adjudicates readiness with a
multi-criterion schema.

Subject: 2026-06-06.omp-integration-buck-workflow
"""

from __future__ import annotations

# eval-kernel prelude helpers (always in scope inside the omp eval tool).
# Phase 1's runtime probe degrades this to a no-op on non-OMP runtimes.
try:
    from prelude import agent, parallel, pipeline, llm, phase, log, budget  # noqa: F401
except ImportError:
    def _no_op(*_args, **_kwargs):
        print("eval cell: omp runtime required (prelude helpers missing); skipped.")
        return None
    agent = parallel = pipeline = llm = phase = log = budget = _no_op  # type: ignore

# Migration target — directories to sweep. These are the live integration
# surfaces in the cross-harness kernel plan, plus a few meta-directories
# that should already be in a "ready to migrate" state.
TARGETS = [
    "skills/cross-platform-pi-omp-loading",
    "prompts",
    "commands",
    "docs",
    "skills/b-plan",
    "skills/b-grill-me",
    "skills/b-grill-with-docs",
]

# Short-circuit when run as a plain Python script for syntax checking.
# Inside the omp eval kernel __name__ is not "__main__", so the prelude
# calls below execute normally; running `python3 eval-migration-sweep.py`
# outside the kernel falls through to the guard, which only verifies
# the prelude import + the TARGETS list (no schema / parallel calls
# required, no prelude helpers invoked).
if __name__ == "__main__":
    assert all(isinstance(t, str) for t in TARGETS)
    print("eval-migration-sweep.py: syntax + TARGETS OK (run `ast.parse` for full check)")
    raise SystemExit(0)

# Per-target findings schema — what the fan-out subagents return.
# additionalProperties: false is required by the eval kernel.
TARGET_SCHEMA = {
    "type": "object",
    "properties": {
        "target": {"type": "string"},
        "blockers": {"type": "array", "items": {"type": "string"}},
        "compatibility_notes": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["target", "blockers", "compatibility_notes"],
    "additionalProperties": False,
}

# Judge schema — multi-criterion (the F5 sweep pattern from b-plan).
# ready_to_migrate is the headline boolean; compatibility_score and
# effort_estimate are the quantitative signals; blockers forward-ports
# verbatim to a follow-up plan.
JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "ready_to_migrate": {"type": "boolean"},
        "compatibility_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
        },
        "effort_estimate": {
            "type": "string",
            "enum": ["trivial", "small", "medium", "large", "epic"],
        },
        "blockers": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["ready_to_migrate", "compatibility_score",
                 "effort_estimate", "blockers"],
    "additionalProperties": False,
}


def build_prompt(target: str) -> str:
    return (
        f"Sweep the directory `{target}` for cross-harness compatibility "
        f"issues. Look for:\n"
        f"  - Slash-command stubs that lack a harness-note blockquote\n"
        f"  - Hard-coded OMP runtime assumptions in skills\n"
        f"  - Symlink drift between `prompts/` and `commands/`\n"
        f"  - OMP-only eval cells imported without a try/except probe\n\n"
        f"Return structured findings matching the schema: target, blockers, "
        f"compatibility_notes. Cite file:line for each blocker."
    )


# Stage 1 — fan out one `agent()` per target directory.
# Bind the loop variable with a default arg so each thunk captures its
# own target (otherwise every thunk sees the last iteration's value).
phase("workflow: sweep per-directory")
findings_per_target = parallel(
    [lambda t=target: agent(
        build_prompt(t),
        agent_type="task",
        model=None,  # let the kernel pick per-tick
        schema=TARGET_SCHEMA,
        label=f"sweep-{t}",
    ) for target in TARGETS]
)

# Stage 2 — synthesize a single "ready to migrate" verdict with
# multi-criterion judge. pipeline() runs a barrier between stages:
# the log stage must finish before the judge stage starts.
phase("workflow: judge")
verdict = pipeline(
    findings_per_target,
    # stage 1: per-target summary log
    lambda findings: [
        log(f"target {f['target']}: {len(f['blockers'])} blockers, "
            f"{len(f['compatibility_notes'])} notes")
        for f in findings
    ] or findings,
    # stage 2: multi-criterion judge — score + forward-port blockers
    lambda findings: llm(
        "Synthesize these per-target findings into a single ready-to-migrate "
        "verdict. Score compatibility on [0, 1]. Estimate effort on the "
        "trivial..epic scale. Forward-port the blockers list verbatim — "
        "do not paraphrase.",
        model="default",
        schema=JUDGE_SCHEMA,
    ),
)

log(f"ready_to_migrate: {verdict.get('ready_to_migrate')}")
log(f"compatibility_score: {verdict.get('compatibility_score')}")
log(f"effort_estimate: {verdict.get('effort_estimate')}")
if verdict.get("blockers"):
    log(f"blockers: {verdict['blockers']}")

# Hard stop if a hard ceiling is set and the cell is about to exceed it.
if budget.remaining() is not None and budget.remaining() < 5_000:
    log(f"workflow eval cell: budget remaining {budget.remaining()}; halting.")
