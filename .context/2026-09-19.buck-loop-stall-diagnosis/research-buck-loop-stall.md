---
status: completed
date: 2026-09-19
subject: 2026-09-19.buck-loop-stall-diagnosis
topics: [buck-loop, review-parser, closed-set-choice, diagnosis]
informs: [../../backlog/items/buck-loop-contextless-choice-stall.md]
---

# Diagnosis: todo-test `/buck-loop` stall

## Incident

The historical Phase 3 run in `../todo-test/.context/2026-09-18.todo-app-crud/` stopped in `blocked`. It did not crash. The later multiple-lists run overwrote `.context/workflow/buck-loop.json`, so the immutable review and transition-audit artifacts are the source of truth for this incident.

## Tight red loop

```bash
bun -e 'import { scan } from "./extensions/buck-loop/scan.ts"; const r=scan({projectRoot:"../todo-test",path:".context/2026-09-18.todo-app-crud/phase-3-usability-polish.md",state:"reviewing",sessionOutcome:"ok"}); console.log(JSON.stringify(r.reviewFacts)); if (r.reviewFacts.kind!=="report" || !r.reviewFacts.parseable) { console.error("RED: clean review was classified unparseable"); process.exit(1); }'
```

Observed in 0.06 seconds:

```text
{"kind":"report","parseable":false,"iterateArtifact":false,"docsImpact":false,"howtoImpact":false}
RED: clean review was classified unparseable
```

A minimal temporary harness changed only the impact-heading depth. `##` reproduced the red result; `###` parsed green. Every other input was identical.

## Cause chain

1. `b-review` produced a semantically clean report using `## Documentation Impact` and `## How-to Impact`.
2. The canonical `skills/b-review/SKILL.md` template and `scan.ts::sectionBody` expect exact `###` headings. `scanReviewFacts` therefore marked the clean report `parseable: false`.
3. No active `iterate-*.md` existed, so `table.ts::nextReviewing` invoked the closed-set chooser with `iterate | document | save | block`.
4. `choice.ts::promptFor` supplied only those enum names and the JSON response schema. It supplied no phase path, review result, artifact facts, or reason the state machine needed help.
5. The model selected legal choice `block` and explained: `No task was specified; nothing to iterate, document, or save.` `applyChosen` persisted that accepted choice as a blocked state.

The immediate trigger was review-format drift. The load-bearing supervisor defect was the context-free recovery prompt: the fallback had no evidence with which to recover. Historical audits show this was not isolated—three choices complained about missing task/context and blocked; one chose `advance` from the same information deficit.

## Ruled out

- **Wrong review selected:** canonical and `review-zz-buck-loop-*` copies have identical SHA-256 `4542e90f8a7cfe7a034c43474b6ac7d74a0a545a683bab380561e99bd1c07341`.
- **Missed iterate artifact:** the subject contains no `iterate-*.md`.
- **Malformed chooser output:** the returned JSON was valid, legal, accepted, and durably audited. The decision was wrong because the prompt omitted context.
- **Crash:** no exception caused this stop; `block` is an explicit legal transition.

## Repair path

Small defect; exit to `b-iterate`.

1. Make review impact parsing tolerate the report writer's realistic heading levels, while keeping exact heading names and anchored section boundaries.
2. Pass bounded decision context into `choose`: current state, plan/phase path, ambiguity reason, and scanned review/postcondition facts. Enum-only prompting must not decide workflow state.
3. Add a public-seam regression: a realistic clean review with `##` impact headings routes to save, and an unparseable review's chooser prompt includes the phase and ambiguity facts.
4. Re-run the original `../todo-test` scan command; it must turn green before resuming a similarly blocked loop.
