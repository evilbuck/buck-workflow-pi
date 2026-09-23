---
status: active
date: 2026-09-21
subject: 2026-09-21.jev-tool
topics: [jev, typesafe, omp-extension, tool, b-phase, difficulty, model-routing]
research: []
iterations: []
spec:
memory: [jev-tool-phasing-2026-09-21.md, jev-tool-phase-2-build-2026-09-22.md]
---

# Plan: Jev tool (OMP extension) + b-phase boolean difficulty

## User Goal
Engineers using OMP (this user or a peer) can offload "is this phase hard?" from the `b-phase` skill to Jev. The main model still designs the phases; Jev returns a cheap, fast calibrated yes/no so `/b-build-hard` vs `/b-build` is not a guess. The same registered tool stays generic for other classification calls later.

## Goal
Ship a `jev` tool — registered by a new OMP extension, arguments matching TypeSafe `systemOne` (`state` + named `questions`, Choice/Score/Noul) — and make `b-phase` its first consumer: one Noul per phase, `noul >= 0.7` stamps `difficulty: hard`, else `not-hard`. Cut phase difficulty from 3-way to boolean across every consumer.

## Context used / assumptions
- User-provided context: tool callable from chat; implements the Jev argument signature; b-phase hard-or-not is the first use case; threshold `>= 0.7` for hard.
- Session context: brainstorm interview (this subject) resolved — boolean not 3-way; frontmatter `difficulty: hard | not-hard` (key stays); accepted defaults: eval twin deferred, one batched `systemOne` request (one Noul per phase), home `extensions/` in this repo, tool fails closed and `b-phase` falls back to its own judgment with a visible "not Jev-scored" note.
- Artifacts used: `brainstorm-jev-tool.md` (this subject); `.context/2026-09-21.jev-decision-opportunities/` (separate buck-loop chooser consumer, out of scope here); live TypeSafe docs — `primitives/noul`, `primitives/choice`, JS SDK `client.systemOne`, `choice()/noul()` helpers.
- Code read:
  - `extensions/index.ts` — `wire(api)` per extension; model auto-switch regex `/^difficulty:\s*(easy|medium|hard)/` (line ~207) and `ModelMapping {easy,medium,hard}`.
  - `extensions/omp-models.ts` — `DifficultyTier`, `OmpModelMapping`, `DIFFICULTY_TO_ROLE`, `mappingFromOmpRoles`. **Also consumed by `code-review-iteration` for review *Hardness* (`easy|medium|hard`, per `docs/CONTEXT.md`) — that domain keeps 3 tiers and must not be cut.**
  - `extensions/buck-loop/loop.ts` — `difficultyOf()`/`readDifficulty()` regex `easy|medium|hard`, default `medium`; `nestedSkill()` already binary.
  - `package.json` — deps only `typescript`; `@typesafe-ai/sdk` must be added. `ExtensionAPI` from `@mariozechner/pi-coding-agent` (peer dep); test mocks confirm `registerTool` on the API.
- Assumptions:
  - Tool name `jev`; schema via the repo's existing registerTool conventions (`@sinclair/typebox` pattern); exact `registerTool` signature verified against `ExtensionAPI` types at build time.
  - Tool returns the `SystemOneResult` passthrough (`answers`, `model`, `usage`); no trimming, no threshold logic in the tool. Thresholds live with the consumer (`b-phase` skill prose: `>= 0.7`).
  - SDK requires Node >= 20; runtime under OMP satisfies this. `package.json` `engines` untouched.
  - Historical phase files keep `easy|medium`; all parsers treat legacy values as `not-hard`.

## Scope
1. **`extensions/jev-tool/`** — new extension: injectable TypeSafe client factory; registers `jev` tool (`state`, `questions`, optional `model`) via `api.registerTool`; execute → `client.systemOne(request)`, return result JSON; fail closed with actionable error on missing `TYPESAFE_API_KEY` / SDK errors (no LLM fallback, never `runOmpModelSession`/`createAgentSession` for Jev). Wire from `extensions/index.ts`.
2. **`skills/b-phase/SKILL.md`** — Step 4 rubric collapses to the hard clause; new protocol: after designing phases, one `jev` call, one Noul per phase (ids `phase_<n>_hard`), instructions = "Is this phase hard?", criteria from the hard rubric; `>= 0.7` → `difficulty: hard` + `buck_hint: /b-build-hard`, else `not-hard` + `/b-build`; record raw value as `hard_noul:` in phase frontmatter; if tool unavailable/errors → skill judges itself and writes a visible `not Jev-scored` note. Templates (frontmatter enum, Difficulty mix, summary table, model hints) go two-way.
3. **Consumer cutover to `hard | not-hard`:**
   - `extensions/omp-models.ts`: add `PhaseDifficulty = "hard" | "not-hard"`, `parsePhaseDifficulty()` (regex `hard|not-hard`, legacy `easy|medium` → `not-hard`), `phaseDifficultyToTier()` (`hard`→`hard`, `not-hard`→`medium`). `DifficultyTier`/`DIFFICULTY_TO_ROLE`/`mappingFromOmpRoles` unchanged (review Hardness keeps 3 tiers).
   - `extensions/index.ts`: auto-switch uses `parsePhaseDifficulty` + `phaseDifficultyToTier`; `phaseDifficulty` state field typed `PhaseDifficulty`.
   - `extensions/buck-loop/loop.ts`: `readDifficulty`/`difficultyOf` → `PhaseDifficulty`, default `not-hard`, mapped to tier before `runStep` (its `DifficultyTier` API unchanged).
4. **Docs:** `docs/buck-workflow.md` (b-phase behavior, tier table, auto-switch wording), `docs/extension-loading.md` (extension list + new tool).
5. **Tests:** jev-tool unit tests (mocked client: noul+choice passthrough, empty-questions error, missing-key fail-closed, model override); index/buck-loop parser tests for `hard|not-hard` + legacy tolerance + default.

## Out of scope
- Eval twin / pointing kernel `judge()` at TypeSafe (blocked on unverified OMP backend).
- buck-loop chooser Jev migration (`.context/2026-09-21.jev-decision-opportunities/`).
- Choice/Score consumers beyond passthrough; the easy→smol tier recovery noul ("is this mechanical?").
- Rewriting historical phase files; `package.json` `engines` change.

## Affected files
- `package.json` (add `@typesafe-ai/sdk`)
- `extensions/jev-tool/index.ts` (new) + `extensions/jev-tool/__tests__/*.test.ts` (new)
- `extensions/index.ts`
- `extensions/omp-models.ts`
- `extensions/buck-loop/loop.ts` (+ its parser tests)
- `skills/b-phase/SKILL.md`
- `docs/buck-workflow.md`, `docs/extension-loading.md`

## Implementation steps
1. `bun add @typesafe-ai/sdk`; confirm ESM import shape and `TypeSafeClient` constructor env behavior.
2. Create `extensions/jev-tool/index.ts`: `wire(api)` with injectable `createClient` dep (default real SDK), `registerTool({ name: "jev", ... })`, args `{ state, questions, model? }`, validation (nonempty questions, known types), passthrough response, fail-closed errors. Export `wire` + types for tests.
3. jev-tool tests with fake client (happy noul, happy multi-question, empty questions, missing key, SDK error, model override).
4. `omp-models.ts`: add `PhaseDifficulty`, `parsePhaseDifficulty`, `phaseDifficultyToTier` + tests.
5. `extensions/index.ts`: swap auto-switch parsing to the new helpers; update state typing; update affected tests (e.g. `buck-mode.test.ts` context).
6. `buck-loop/loop.ts`: `readDifficulty`/`difficultyOf` → `PhaseDifficulty` with legacy tolerance and `not-hard` default; map to tier for `runStep`; update loop tests.
7. Rewrite `b-phase` SKILL.md Step 4 + templates: boolean rubric, Jev call protocol, 0.7 threshold, `hard_noul` stamp, fallback note.
8. Sync `docs/buck-workflow.md` + `docs/extension-loading.md`.
9. Guardrails check; live smoke with real `TYPESAFE_API_KEY` (toy Noul) and one real `b-phase` run on a small plan.

## Light Grill
- Q: 3-way or boolean difficulty? → resolved: boolean hard/not (user; easy/medium is not a Jev question).
- Q: Frontmatter shape after the cut? → resolved: `difficulty: hard | not-hard`, key stays; legacy values tolerated as not-hard (user: "update to match implementation reality").
- Q: Threshold? → resolved: `noul >= 0.7` stamps hard (user).
- Q: Eval twin? → resolved: deferred until kernel `judge()` backend verified (accepted default).
- Q: Batching? → resolved: one `systemOne` request, one Noul per phase (accepted default).
- Q: Failure mode? → resolved: tool fails closed; skill falls back to own judgment with visible "not Jev-scored" note (accepted default).
- Q: Tool response shape? → resolved (recommended, unconfirmed): full `SystemOneResult` passthrough; thresholds never in the tool.

## Acceptance criteria
- [ ] `jev` tool registered on extension load; calling it with `{ state, questions }` returns Jev's `answers` (typed passthrough for noul/choice/score) plus `model`/`usage`.
- [ ] Missing `TYPESAFE_API_KEY`, empty `questions`, or SDK error → single actionable error result; no silent fallback to any other model.
- [ ] `b-phase` SKILL.md instructs exactly one Jev call with one Noul per phase; stamps `difficulty: hard|not-hard`, `buck_hint`, and `hard_noul`; documents the `>= 0.7` threshold and the fallback note.
- [ ] `extensions/index.ts` and `buck-loop/loop.ts` parse `difficulty: hard|not-hard`, map legacy `easy|medium` → `not-hard`, default `not-hard`; review Hardness (`code-review-iteration`) still 3-tier and untouched.
- [ ] `docs/buck-workflow.md` + `docs/extension-loading.md` describe the two-way difficulty and the `jev` tool with no stale 3-tier phase wording.
- [ ] Guardrails verdict `pass` (unit, lint, patch, complexity); focused tests green.

## Verification
- Unit: fake-client jev-tool tests; parser tests for new + legacy difficulty values in `index.ts`/`loop.ts` paths.
- Live smoke (real key): call `jev` from an OMP session with a toy Noul; then run `b-phase` on a small plan and confirm stamped `difficulty`/`hard_noul`/`buck_hint` come from the tool result.
- Grep: no remaining phase-difficulty `easy|medium|hard` regexes (review-Hardness uses excluded); docs free of 3-tier phase wording.
- `npm run guardrails:check` green.

## Execution Instructions
This plan looks large enough to benefit from phasing. Run `/skill:b-phase` to break it into sequential OMP-ready execution phases with dependency analysis, per-phase model hints, and resume-safe execution instructions.

## Risks
- `ExtensionAPI.registerTool` exact signature/schema convention may differ from assumption — verify against `@mariozechner/pi-coding-agent` types before step 2; adjust tool schema accordingly.
- Review Hardness vs phase difficulty share `omp-models.ts`; a careless cut breaks `code-review-iteration` model routing. Mitigated by separate `PhaseDifficulty` type + tests.
- Legacy phase files with `easy|medium` silently downgrade to `not-hard` (medium-row model) — accepted consequence; `hard_noul` audit trail starts only for new phases.
- SDK Node >= 20 while `engines` says >= 18 — tool path only; acceptable under OMP runtimes, revisit if installs break.
- Jev mislabels a hard phase below 0.7 → runs `/b-build` (cheaper failure direction); `hard_noul` makes the 0.5–0.7 band auditable for later threshold tuning.
