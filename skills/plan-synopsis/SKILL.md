---
name: plan-synopsis
description: Condense any implementation plan into a one-screen engineer-facing synopsis — goal, quoted evidence, countable fixes, scope boundary, verification, next step.
---

# Plan Synopsis

Produce a one-screen, engineer-facing synopsis of any implementation plan. Use when the operator hands you a plan (file, link, or subject folder) and wants its essence without reading it.

## Invocation

```
<plan-path>
```

## Output shape (exact)

**Goal** — one sentence: the outcome, then the single mechanism currently blocking it (file:symbol if code is involved).

**Evidence** — the real values that prove the problem. Quote actual strings, IDs, subjects, or diffs from the repo/artifacts. Never paraphrase evidence; quote it.

**Fix / Approach** — N countable moves, one line each, each naming its file.

**Out of scope** — bullets with a one-phrase reason each; cite the prior decision/plan that excluded the work when one exists.

**Verification** — runnable commands and the expected result or verdict.

**Recovery caveat** — if the plan leaves a broken artifact, blocked run, or operational trap, one sentence on the trap and the escape. Omit if none.

**Next step** — one command.

## Rules

- Quote live evidence over describing it.
- Never narrate process or reasoning; report conclusions only.
- No section-by-section restatement — compress.
- No hedging, filler, or "this plan aims to".
- Drop any section with nothing real to say; empty is fine.
- Total ~15 lines. If it overflows, cut detail, not sections.

## Example register

> **Goal** — a directive-conformant save receipt must verify; today `saveDirective()` omits `subject`, the child invents one, and `sameAttempt()` rejects the receipt.
>
> **Fix (4 files, one session)** — add `subject:` line to the directive; pin exact-copy wording in the skill; recopy bundled skill; regression test.

## Sources

Read the plan file plus any artifact it cites that carries live evidence (receipts, attempt JSON, failing output). Verify quoted values actually exist before quoting them; if the plan's evidence is stale, say so in one line instead of quoting it.
