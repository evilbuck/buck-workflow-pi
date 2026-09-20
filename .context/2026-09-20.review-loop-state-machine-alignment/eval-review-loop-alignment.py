# .context/2026-09-20.review-loop-state-machine-alignment/eval-review-loop-alignment.py
"""
Review-loop state-machine migration — workflow-mode verification fan-out.

Edit this cell before invoking the `workflow` keyword in omp. The kernel
imports the helpers below; the cell runs as the workflow's first turn.

Shape: eval-migration-sweep pattern (per-target fan-out -> barrier log ->
multi-criterion judge), with TARGETS replaced by the plan's four independent
verification dimensions. Each agent audits one dimension against the plan at
`.context/2026-09-20.review-loop-state-machine-alignment/plan-review-loop-state-machine-migration.md`
and the report at `report-architecture-alignment.html`.

Hard contract:
  - Deliverable artifact, not throwaway scratch.
  - One `agent()` per dimension returning the FINDINGS_SCHEMA.
  - A barrier verifies all dimensions; the judge returns go/no-go.
"""

from __future__ import annotations

# eval-kernel prelude helpers (always in scope inside the omp eval tool).
# Degrades to a no-op on non-OMP runtimes (Phase 1 runtime probe).
try:
    from prelude import agent, parallel, pipeline, llm, phase, log, budget  # noqa: F401
except ImportError:
    def _no_op(*_args, **_kwargs):
        print("eval cell: omp runtime required (prelude helpers missing); skipped.")
        return None
    agent = parallel = pipeline = llm = phase = log = budget = _no_op  # type: ignore

SUBJECT = "2026-09-20.review-loop-state-machine-alignment"

# (slug, brief) — one verification dimension each, from the plan's
# Verification section. Edit freely before invoking.
DIMENSIONS = [
    ("truth-table",
     "Every behavior-map row in the plan's Evidence base (D1-D6) has a named "
     "automatic rule in extensions/code-review-iteration/machine.ts and a "
     "matching assertion by rule id in __tests__/machine.test.ts; "
     "AMBIGUOUS_AUTOMATIC, NO_ROUTE, and terminal-refusal cases are tested; "
     "the fixer-on-final-pass and pass==max exhaustion pins exist."),
    ("integration-no-diff",
     "git diff on extensions/code-review-iteration/__tests__/loop.test.ts is "
     "empty and all 24 runReviewLoop scenarios pass unmodified; "
     "RUN_STATE_SCHEMA in run-state.ts is still 1 with no migration or shim "
     "code anywhere in the extension."),
    ("purity-and-api",
     "machine.ts imports only ../state-machine.js and local types (no node:*, "
     "git, or async host imports); public exports runReviewLoop, "
     "LoopCancelledError, LoopDeps, LoopOptions, LoopResult keep identical "
     "signatures and callers in index.ts are untouched; resumeIncompleteFixer "
     "and the old decision branches are deleted, not commented."),
    ("guardrails-and-resume",
     "npm run guardrails:check passes with patch coverage >= 90% and the "
     "global ratchet at 79.5%; resume equivalence holds: projecting the same "
     "review.json-present/fixer.json-absent artifacts that resumeIncompleteFixer "
     "handled yields triaging, and validateResume semantics are unchanged."),
]

# Findings schema — every agent() returns a dict matching this shape.
FINDINGS_SCHEMA = {
    "type": "object",
    "properties": {
        "dimension": {"type": "string"},
        "verdict": {"type": "string", "enum": ["pass", "warn", "fail", "blocked"]},
        "evidence": {"type": "array", "items": {"type": "string"}},
        "risks": {"type": "array", "items": {"type": "string"}},
        "open_questions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["dimension", "verdict", "evidence", "risks", "open_questions"],
    "additionalProperties": False,
}

# Judge schema — go/no-go with blocking dimensions forwarded verbatim.
JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["go", "iterate", "block"]},
        "rationale": {"type": "string"},
        "blocking_dimensions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["verdict", "rationale", "blocking_dimensions"],
    "additionalProperties": False,
}


def build_prompt(slug: str, brief: str) -> str:
    """Compose the per-dimension audit prompt. Edit freely."""
    return (
        f"You are auditing dimension '{slug}' of the code-review-iteration "
        f"state-machine migration in this repo.\n\n"
        f"Brief: {brief}\n\n"
        f"Read the plan at `.context/{SUBJECT}/plan-review-loop-state-machine-migration.md` "
        f"and verify this dimension against the actual current repo state — "
        f"do not trust checkboxes, commit messages, or the report's prose. "
        f"Run the specific checks the brief names. Return structured findings "
        f"matching the schema: verdict, evidence (cite file:line or test name), "
        f"risks, open_questions. If you cannot run a check, record it as a "
        f"risk, never as a pass."
    )


# Short-circuit when run as a plain Python script for syntax checking.
if __name__ == "__main__":
    assert all(isinstance(t, tuple) and len(t) == 2 for t in DIMENSIONS)
    print("eval-review-loop-alignment.py: syntax + DIMENSIONS OK")
    raise SystemExit(0)

# Stage 1 — fan out one agent() per verification dimension in parallel.
# Default-arg binding so each thunk captures its own slug/brief.
phase("workflow: fan out per-dimension audit")
findings = parallel(
    [
        lambda s=slug, b=brief: agent(
            build_prompt(s, b),
            agent_type="task",
            model=None,
            schema=FINDINGS_SCHEMA,
            label=f"dim-{s}",
        )
        for (slug, brief) in DIMENSIONS
    ]
)

# Stage 2 — barrier: log per-dimension summary, then judge.
phase("workflow: judge")


def _summarize(results):
    for f in results:
        log(f"{f.get('dimension', '?')}: {f.get('verdict', '?')} — "
            f"{len(f.get('evidence', []))} evidence, {len(f.get('risks', []))} risks")
    return results


verdict = pipeline(
    findings,
    _summarize,
    lambda results: llm(
        "Adjudicate these verification-dimension findings for the "
        "code-review-iteration state-machine migration. The migration "
        "contract is zero behavior change: any 'fail' on integration-no-diff "
        "or truth-table blocks; 'warn' items must appear in the rationale. "
        "Do not paraphrase the findings — adjudicate them.",
        model="default",
        schema=JUDGE_SCHEMA,
    ),
)

# Stage 3 — surface the verdict.
log(f"workflow verdict: {verdict.get('verdict', 'unknown')}")
log(f"rationale: {verdict.get('rationale', '')}")
if verdict.get("blocking_dimensions"):
    log(f"blocking dimensions: {verdict['blocking_dimensions']}")

if budget.remaining() is not None and budget.remaining() < 5_000:
    log("workflow eval cell: budget remaining below 5k; halting fan-out.")
