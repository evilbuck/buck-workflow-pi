---
description: Run a well-scoped Buck plan autonomously through every phase
---

# B-Kickoff

Subject or plan: `$ARGUMENTS`

This prompt is the objective for an unattended OMP goal session. Start it with:

```text
/goal set Run the Buck workflow loop in prompts/b-kickoff.md for $ARGUMENTS
```

Resolve `$ARGUMENTS` to the named subject folder or plan. If it is omitted, resolve the active subject using Buck's shared subject-resolution rules. Stop only if no single subject can be resolved or the plan is not well scoped enough for unattended execution.

Execute the accepted plan to completion. Treat the plan, its phase files, and each Buck skill's output as the source of truth.

1. Read the plan and determine whether it is phased.
2. If a Buck skill advises phasing, run `b-phase`, then continue with the generated phases.
3. For a phased plan, process every incomplete phase in dependency order. Do not begin a later phase until the current phase's acceptance criteria and required verification pass.
4. For each phase—or once for a non-phased plan—run the Buck workflow beginning with `b-build` (use `b-build-hard` when the plan or skill advises it):

   ```text
   b-build → b-review → b-iterate when review finds in-plan issues → b-review again
   ```

5. Repeat `b-iterate → b-review` until the review reports no unresolved in-plan issues. Follow any task output that requires another Buck step; do not merely report the recommendation.
6. Run `b-docs` when review identifies documentation impact and `b-howto` when it identifies a new or changed user-facing action requiring a how-to.
7. Run `b-save`, then `b-commit`, at the completion boundary prescribed by the active plan or phase workflow. Never commit before required review, iteration, documentation, verification, and durable state are complete.
8. Advance automatically to the next incomplete phase and repeat the cycle.

Honor each loaded skill's procedure, acceptance criteria, verification gates, and handoff advice. When outputs conflict, prefer the active plan's explicit requirements, then the most recently executed Buck skill. Do not skip a recommended phase, iteration, re-review, docs pass, save, or commit merely because the implementation appears complete.

Before completing the OMP goal, audit the entire plan—not only the latest phase—against current repository state and direct verification evidence. Goal budget exhaustion is not completion. If execution becomes unsafe or genuinely blocked by unavailable external input, preserve all completed work and state the exact blocker; otherwise continue until every phase and the full plan are complete.
