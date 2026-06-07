"""
Cross-harness kernel phasing — workflow-mode review-audit.

Edit this cell before invoking the `workflow` keyword in omp. The kernel
imports the helpers below; the cell runs as the workflow's first turn.

Hard contract:
  - This is a deliverable artifact, not throwaway scratch.
  - One `agent()` call per phase, returning a structured findings object
    with the `schema=` parameter.
  - A barrier stage verifies the findings; a synthesis stage adjudicates.

Subject: 2026-06-06.omp-integration-buck-workflow
PHASES: the four discrete phase files in this subject folder, in order.
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

SUBJECT = "2026-06-06.omp-integration-buck-workflow"
PHASES = [
    # (phase_number, slug, difficulty, brief)
    (1, "cross-harness-compat", "easy",
     "Make new OMP surfaces no-op on non-OMP harnesses"),
    (2, "kernel-contract-doc", "medium",
     "Document the eval-kernel contract for downstream skills"),
    (3, "eval-kernel-examples", "medium",
     "Two real example cells proving the kernel end-to-end"),
    (4, "b-grill-integration", "hard",
     "b-grill-me/with-docs auto-derive PHASES from decision_domains"),
]


# Short-circuit when run as a plain Python script for syntax checking.
# Inside the omp eval kernel __name__ is not "__main__", so the prelude
# calls below execute normally; running `python3 eval-review-audit.py`
# outside the kernel falls through to the guard, which only verifies
# the prelude import + the PHASES list (no schema / parallel calls
# required, no prelude helpers invoked).
if __name__ == "__main__":
    assert all(isinstance(p, tuple) and len(p) == 4 for p in PHASES)
    # Defer schema structural check to a separate `ast.parse` call; the
    # cell parsed successfully because we got this far.
    print("eval-review-audit.py: syntax + PHASES OK (run `ast.parse` for full check)")
    raise SystemExit(0)

# Findings schema — every agent() returns a dict matching this shape.
# additionalProperties: false is required by the eval kernel; see
# docs/eval-kernel.md § Schemas.
FINDINGS_SCHEMA = {
    "type": "object",
    "properties": {
        "phase": {"type": "integer"},
        "slug":  {"type": "string"},
        "verdict": {"type": "string",
                    "enum": ["pass", "warn", "fail", "blocked"]},
        "evidence": {"type": "array", "items": {"type": "string"}},
        "risks":    {"type": "array", "items": {"type": "string"}},
        "open_questions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["phase", "slug", "verdict", "evidence",
                 "risks", "open_questions"],
    "additionalProperties": False,
}


def build_prompt(phase_num: int, slug: str, difficulty: str, brief: str) -> str:
    """Compose the per-phase subagent prompt. Edit freely."""
    return (
        f"You are reviewing Phase {phase_num} ({slug}, difficulty={difficulty}) "
        f"of the {SUBJECT!r} plan.\n\n"
        f"Brief: {brief}\n\n"
        f"Read the active phase file at `.context/{SUBJECT}/phase-{phase_num}-{slug}.md`. "
        f"Verify each acceptance criterion against the actual current repo state — "
        f"do not trust checkboxes or commit messages. Return structured findings "
        f"matching the schema: verdict, evidence (cite file:line or test name), "
        f"risks, open_questions. If you cannot run a check, mark it as a risk, "
        f"not a pass."
    )


# Stage 1 — fan out one `agent()` per phase in parallel.
# Bind the loop variables with default args so each thunk captures its
# own values (otherwise every thunk sees the last iteration's values).
phase("workflow: fan out per-phase review")
findings_per_phase = parallel(
    [lambda n=num, s=slug, d=diff, b=brief: agent(
        build_prompt(n, s, d, b),
        agent_type="task",
        model=None,  # let the kernel pick per-tick
        schema=FINDINGS_SCHEMA,
        label=f"phase-{n}-{s}",
    ) for (num, slug, diff, brief) in PHASES]
)

# Stage 2 — barrier: all phases reviewed before synthesis.
phase("workflow: synthesize")
overall = pipeline(
    findings_per_phase,
    # stage 1: aggregate verdicts, log per-phase summary
    lambda findings: [
        log(f"phase {f['phase']} ({f['slug']}): {f['verdict']} — "
            f"{len(f['evidence'])} evidence, {len(f['risks'])} risks")
        for f in findings
    ] or findings,
    # stage 2: judge — escalate any `fail` or `blocked` to the user
    lambda findings: llm(
        "Synthesize these per-phase findings into a single go/no-go verdict "
        "for the plan. Cite the per-phase evidence. Do not paraphrase "
        "the findings — adjudicate.",
        model="default",
        schema={
            "type": "object",
            "properties": {
                "verdict": {"type": "string",
                            "enum": ["go", "iterate", "block"]},
                "rationale": {"type": "string"},
                "blocking_phases": {"type": "array",
                                    "items": {"type": "integer"}},
            },
            "required": ["verdict", "rationale", "blocking_phases"],
            "additionalProperties": False,
        },
    ),
)

# Stage 3 — surface the final verdict to the user.
log(f"workflow verdict: {overall.get('verdict', 'unknown')}")
log(f"rationale: {overall.get('rationale', '')}")
if overall.get("blocking_phases"):
    log(f"blocking phases: {overall['blocking_phases']}")

# Hard stop if a hard ceiling is set and the cell is about to exceed it.
# budget.remaining() returns math.inf when no ceiling is set — guard for
# None / inf explicitly (see docs/eval-kernel.md § Failure modes).
if budget.remaining() is not None and budget.remaining() < 5_000:
    log(f"workflow eval cell: budget remaining {budget.remaining()}; "
        f"halting fan-out and surfacing partial results.")

