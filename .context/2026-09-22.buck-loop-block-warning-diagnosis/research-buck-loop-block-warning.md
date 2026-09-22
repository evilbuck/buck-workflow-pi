---
status: completed
date: 2026-09-22
subject: 2026-09-22.buck-loop-block-warning-diagnosis
topics: [buck-loop, review-parser, closed-set-choice, diagnosis]
informs:
  - ../../backlog/items/buck-loop-contextless-choice-stall.md
---

# Diagnosis: `buck-loop: blocked: accepted choice: block`

## Incident

The live `.context/workflow/buck-loop.json` stopped on Phase 2 of `2026-09-21.jev-tool` after a successful build and review. This is a deliberate fail-closed transition, not a crash.

The persisted choice reason was:

> Review report is unparseable (parseable=false) and no iterate artifact exists; cannot proceed with /b-iterate without actionable review findings.

## Tight red loop

This command drives the current scanner and state machine against the exact phase and prints the reported warning when review routing falls back to the chooser:

```bash
bun -e 'import { scan } from "./extensions/buck-loop/scan.ts"; import { next, applyChoice } from "./extensions/buck-loop/machine.ts"; const facts=scan({projectRoot:".",path:".context/2026-09-21.jev-tool/phase-2-binary-difficulty-cutover.md",state:"reviewing",sessionOutcome:"ok"}); const snapshot={state:"reviewing",...facts,loopCount:1,maxLoops:12,iterateCyclesOnPhase:0,lastChoice:null,history:[]}; const decision=next(snapshot); if(decision.effect.kind==="choose"){ const blocked=applyChoice({kind:"block"},snapshot); console.error(`Warning: buck-loop: ${blocked.to}: ${blocked.effect.reason}`); console.error(JSON.stringify({reviewFacts:facts.reviewFacts,why:decision.why,legal:decision.effect.legal})); process.exit(1); } console.log(JSON.stringify(decision));'
```

Observed twice in about 0.07 seconds:

```text
Warning: buck-loop: blocked: accepted choice: block
{"reviewFacts":{"kind":"report","parseable":false,"iterateArtifact":false,"docsImpact":false,"howtoImpact":false},"why":"review report unparseable; no iterate artifact","legal":[{"kind":"iterate"},{"kind":"document"},{"kind":"save"},{"kind":"block"}]}
```

## Minimal differential

The captured review contains `### Documentation Impact` but no `### How-to Impact`. A temporary higher-sorting review copy containing only this added section:

```markdown
### How-to Impact
- No how-to impact
```

changed the same scanner result from `parseable:false` to `parseable:true`. The temporary file was removed by the command.

## Cause chain

1. The nested `b-review` session returned a semantically passing report but omitted the required `### How-to Impact` section. `skills/b-review/SKILL.md` requires both impact sections in its report template.
2. `extensions/buck-loop/scan.ts::parseReviewImpact` requires both Documentation Impact and How-to Impact. Missing either makes the whole report `parseable:false`.
3. No active `iterate-*.md` existed, so `extensions/buck-loop/machine.ts` emitted a closed-set choice with `iterate | document | save | block`.
4. The choice context included `parseable=false`, impact flags, phase path, and postcondition, but not the report's `Pass` verdict or issue classification. Given only the failure flags, the chooser selected legal action `block` on its first attempt.
5. The accepted choice was persisted in the transition audit and mapped by `machine.ts` to `blocked("accepted choice: block")`.
6. `extensions/buck-loop/index.ts` renders any blocked result through `activity.fail`, producing the `Warning:` UI message.

## Ranked hypotheses and results

1. **Missing parser-required review section — confirmed.** Adding only How-to Impact changes the parser to `parseable:true`.
2. **Wrong review artifact selected — ruled out.** The subject had one `review-*.md`, and it is the content copied into `review-zz-buck-loop-*`.
3. **Malformed or illegal chooser output — ruled out.** The immutable audit records valid JSON, `accepted:true`, legal `choice:"block"`, attempt 1.
4. **Supervisor crash — ruled out.** Projection history records a normal `reviewing → blocked` transition; the warning comes from the blocked-result renderer, not the exception handler.

## Secondary parser mismatch

The review's Documentation Impact body begins `None. Stale ...`. `scan.ts::isFlagged` treats only an exact first line `None` or a line matching `no documentation impact` as no impact. After adding the missing How-to section, the parser therefore reports `docsImpact:true`, which would route to `/b-docs` instead of the intended clean-review save path.

## Repair direction

1. Validate nested `b-review` output against the required routing fields before accepting the session result; retry or block with the missing field names rather than delegating an under-specified semantic decision.
2. Pass bounded report evidence—verdict, issue classification, and missing sections—into any unavoidable fallback choice.
3. Make no-impact parsing accept the canonical report's realistic `None.` sentence form, or emit a structured routing record instead of reparsing prose.
4. Add public `handleLoop` coverage using this exact report shape: a passing review with no How-to section must not end as `accepted choice: block`; the complete report must reach the intended save route.
