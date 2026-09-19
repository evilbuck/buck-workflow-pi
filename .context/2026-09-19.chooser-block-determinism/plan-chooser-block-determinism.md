---
status: active
date: 2026-09-19
subject: 2026-09-19.chooser-block-determinism
topics: [buck-loop, closed-set-choice, review-parser, context-injection, regression-test]
research: []
iterations: []
spec:
memory: []
---

# Plan: context-informed buck-loop chooser + tolerant review parsing

## User Goal

Operators running `/buck-loop` never lose a healthy run to a legal-but-wrong `block`: review-format drift no longer trips the fallback chooser, and when the chooser does run it receives enough bounded context (state, plan/phase path, ambiguity reason, review facts) to recover instead of deterministically re-blocking.

## Goal

Close the 2026-09-19 stall incident (`../todo-test` phase-3 run): a semantically clean `b-review` report using `##` impact headings missed the scanner's exact `###` contract, entered fallback choice, and the enum-only chooser prompt gave the model no evidence, so it chose `block` — three times across resumes. Fix both root causes and lock them with an incident-reproducing regression test.

## Context used / assumptions

- User-provided context: fix the deterministically bad chooser ("re-produces the same block on every resume"); confirmed scope: both chooser call paths; parser tolerates any heading level; user goal confirmed verbatim above.
- Session context: idempotency research (2026-09-19) flagged the chooser as risk #3; this plan is the in-plan fix, separate from the persist-atomicity and retry-checkpoint gaps (out of scope).
- Artifacts used:
  - `.context/2026-09-19.buck-loop-stall-diagnosis/research-buck-loop-stall.md` (different, verified-closed subject — referenced by path) — cause chain + 4-step repair path + red-loop scan command.
  - `.context/backlog/items/buck-loop-contextless-choice-stall.md` (active, high) — acceptance criteria already track this work; do not create a duplicate backlog item.
- Code facts:
  - `extensions/buck-loop/choice.ts:74-77` — `promptFor` sends only the legal enum + JSON schema; no state, paths, or facts.
  - `extensions/buck-loop/choice.ts:148` — prompt built per attempt; correction retry adds only a prefix.
  - `extensions/buck-loop/choice.ts:62-80 (writeAudit)` — audit records legal/raw/parsed/accepted/reason/attempt, not the decision context.
  - `extensions/buck-loop/scan.ts:358-375` — `sectionBody` matches literal `` `### ${heading}` `` and stops at `\n#{1,3} `; H2 headings are unrecognized and a deeper heading would not terminate the section.
  - `extensions/buck-loop/scan.ts:326-331` — `parseReviewImpact` falls back to `Label:` summary lines, but heading-level drift still yields `parseable: false`.
  - `extensions/buck-loop/loop.ts:269-309` — `runChoice` receives `transition` (with `why`) but passes only `transition.effect.legal` to `chooseSafely` → `choose`; snapshot already carries `state`, `planPath`, `phasePath`, `reviewFacts`, `workFacts`.
  - `extensions/buck-loop/table.ts:100-112,184-223` — chooser serves two states: `reviewing` (unparseable report) and postcondition-ambiguous work states.
- Assumptions: `block` stays legal (safety valve); legal sets and the state machine do not change; a model-supplied choice still cannot transition without membership in `legalChoices` (table.ts:311-315).

## Scope

1. **scan.ts — level-tolerant review parsing.** `sectionBody` matches the exact heading *name* at any realistic level (`##`–`####`), anchored at line start; section-boundary search widens to `\n#{1,6} ` so deeper headings terminate the section. Exact names and the `Label:` summary-line fallback are unchanged. Update the function's doc comment (it currently documents the H3-only contract as intended).
2. **choice.ts — bounded decision context.** `choose()` accepts an optional `context` object: `{ state, planPath, phasePath, why, facts }` where `facts` is a short human-readable summary of the relevant scan result (review facts or postcondition). `promptFor` renders the legal set plus this context; the correction retry keeps it. `writeAudit` records the context so transition-audits become self-explanatory for forensics. Context degrades gracefully (absent → current enum-only prompt, keeping direct `choose()` test callers valid).
3. **loop.ts — pass the facts.** `runChoice`/`chooseSafely` build the context from `snapshot` (state, planPath, phasePath, reviewFacts/workFacts summary) and `transition.why`, and pass it through.
4. **Regression coverage.**
   - Fixture: realistic clean review report with `## Documentation Impact` / `## How-to Impact` headings.
   - scan test: `##` and `###` variants produce identical `ReviewFacts` (`parseable: true`); a `####` subsection inside a section does not break parsing.
   - choice test: prompt contains state, plan/phase path, ambiguity reason, and fact lines; audit records the context.
   - loop (`handleLoop`-level) test: incident reproduction — clean `##`-heading review with no iterate artifact routes to **save**, not block.
   - A genuinely unparseable review still reaches the chooser (no behavior inversion).

## Out of scope

- Atomic projection writes / pre-edit retry checkpoints (separate idempotency gaps).
- Removing `block` from any legal set or changing state-machine transitions.
- Changing `skills/b-review/SKILL.md` templates or the writer side.
- Chooser model/role selection (`smol` mapping stays).

## Affected files

- `extensions/buck-loop/scan.ts` — `sectionBody`, `parseReviewImpact` doc comment.
- `extensions/buck-loop/choice.ts` — `choose` opts, `promptFor`, `writeAudit`, `attemptChoice`.
- `extensions/buck-loop/loop.ts` — `runChoice`, `chooseSafely`.
- `extensions/buck-loop/__tests__/fixtures.ts` — realistic `##`-heading review fixture.
- `extensions/buck-loop/__tests__/scan.test.ts`, `choice.test.ts`, `loop.test.ts` — new cases above.

## Implementation steps

1. Add the `##`-heading review fixture to `__tests__/fixtures.ts`; write the failing scan test (red: `parseable: false`) and the identical-facts assertion across heading levels.
2. Fix `sectionBody` (level-anchored match, `#{1,6}` boundary) + doc comment; scan tests green.
3. Extend `choose()`/`promptFor`/`writeAudit` with optional bounded context; choice tests for prompt content and audit record.
4. Thread context from `runChoice`/`chooseSafely` (`transition.why` + snapshot fields); loop-level incident-reproduction test routes a clean `##` review to save.
5. Run the focused buck-loop suite, then `npm run guardrails:check`.

## Acceptance criteria

- [ ] Realistic `##` and canonical `###` review impact sections produce identical review facts (fixture-verified).
- [ ] Review fallback **and** postcondition-ambiguous choices receive bounded state/path/ambiguity/facts context; transition-audits record it.
- [ ] Public loop coverage reproduces the todo-test incident: clean `##`-heading review reaches save instead of block.
- [ ] The original red scan one-liner from the diagnosis reports `parseable: true` (run against `../todo-test` if present, else the in-repo fixture equivalent).
- [ ] No change to legal sets, `block` semantics, or the closed-set safety property (`IllegalChoiceError` path still covered).

## Verification

- `bun test extensions/buck-loop/__tests__/scan.test.ts choice.test.ts loop.test.ts` (focused, then full `bun test` if suite convention requires).
- `npm run guardrails:check` must pass (code-touching session — gate is blocking).
- Red-loop re-check: the diagnosis's one-liner scan command (adapted to the fixture if `../todo-test` is absent) prints `"parseable":true` and exits 0.

## Risks

- **False-positive heading match** — prose lines like `## Documentation Impact` inside code fences could now parse. Mitigation: line-anchored regex + exact name; the first-content-line flag rules stay strict. Fixture should include a fence case if cheap.
- **Context bloat in the smol-model prompt** — keep the context to short structured lines (state, paths, why, ≤4 fact lines).
- **`../todo-test` may not exist on this machine** — acceptance falls back to the in-repo fixture equivalent.
- **Behavioral inversion risk** (unparseable reviews now bypassing the chooser) — covered by the "genuinely unparseable still reaches the chooser" test.
