# Plan: OMP Jev tool (b-phase is-hard)

## User Goal
Engineers using OMP (this user or a peer) can offload “is this phase hard?” from the `b-phase` skill to Jev. The main model still designs the phases; Jev returns a cheap, fast yes/no so `/b-build-hard` vs `/b-build` is not a guess. Same tool stays generic for other classifications later.

## What we might build
- A **generic Jev tool** whose arguments match TypeSafe `systemOne`: `state` + named `questions`. The tool accepts the three primitives. The **first real call** is a [Noul](https://docs.typesafe.ai/primitives/noul.md) (boolean): `{ type: "noul", instructions, criteria? }` → `{ noul }` in `0..1` (probability of yes). Choice remains in the tool because that is the public Jev signature; it is not the b-phase v1 question.
- **Two call sites, one implementation:**
  - **Session tool** — OMP `registerTool` so the agent running `b-phase` function-calls it after phases are designed.
  - **Eval** — same request/response shape from eval cells (kernel `judge(state, questions)` is already this shape; this work should not invent a second eval dialect).
- **First consumer: `b-phase` “is it hard?”** Today the skill is **not** boolean. `skills/b-phase/SKILL.md` Step 4 still assigns `easy | medium | hard` and maps that to `buck_hint` (`/b-build` vs `/b-build-hard`). The user intent for this work is only **hard or not**. Easy vs medium is not a Jev question and should not stay as a second skill judgment.
  - Jev answers: is this phase hard (ambiguous, architecture-touching, failure-sensitive, or high-blast-radius)?
  - **Decided: `noul >= 0.7` stamps `hard`**; anything below stamps `not-hard`. The 0.5–0.7 band runs `/b-build` even though Jev leans hard — a deliberate cheap default.
  - If hard → `/b-build-hard`.
  - If not → `/b-build`. No easy/medium split.
- **Decided: frontmatter becomes `difficulty: hard | not-hard`** (key stays `difficulty:`; value domain goes boolean). Consumers that read `difficulty:` must be cut over in the same change:
  - `extensions/index.ts` — model auto-switch parses `/^difficulty:\s*(easy|medium|hard)/`; becomes `hard|not-hard`, `not-hard` maps to the non-hard tier.
  - `extensions/buck-loop/loop.ts` — `difficultyOf()` reads the same regex, defaults `medium` → default becomes `not-hard`; `nestedSkill()` already collapses to `b-build-hard` vs `b-build`, unchanged.
  - `extensions/omp-models.ts` — `DIFFICULTY_TO_ROLE` (easy→smol…, medium→slow…, hard→default…) becomes 2-tier or aliases `not-hard` → the medium row.
  - `skills/b-phase/SKILL.md` — rubric collapses to the hard clause; Jev call added to Step 4; overview "Difficulty mix"/summary table go boolean.
  - `docs/buck-workflow.md`, `docs/extension-loading.md` — 3-tier wording and tier table updated.
  - Historical phase files keep `easy|medium` — parsers must treat legacy values as `not-hard`.
- Example call (one phase, or N noul questions in one `systemOne` request):

```ts
{
  state: { name, goal, files, from_plan_steps, risks, verification, depends_on },
  questions: {
    hard: {
      type: "noul",
      instructions: "Is this phase hard?",
      criteria: {
        true: "Ambiguous, architecture-touching, failure-sensitive, or high-blast-radius. Needs /b-build-hard.",
        false: "Bounded enough for /b-build. Not hard.",
      },
    },
  },
}
```

## Why it matters
- TypeSafe's agent skill is instructions only. It does not call Jev. Agents currently write SDK code or guess.
- “Is this phase hard?” is already a written rubric inside `b-phase`. That is a snap judgment, not a reasoning essay — Jev's job. The main model should consume `noul` and stamp frontmatter, not impersonate Jev.
- Getting the hard/not-hard call wrong is expensive: `/b-build-hard` burns a strong model; missing hard leaves an ambiguous phase on `/b-build`.
- Consequence of the cut: the easy→smol model tier disappears from phase routing. `not-hard` phases route to one non-hard model. If that loss hurts later, add a second noul ("is this mechanical?") in the same `systemOne` request rather than reopening the 3-way label.

## Constraints / preferences
- Jev is not a chat model. Do **not** wrap Jev in `createAgentSession` / `runOmpModelSession`.
- Live TypeSafe path: `@typesafe-ai/sdk` + `TYPESAFE_API_KEY` + `client.systemOne(...)`. "OMP SDK" here means the extension API (`registerTool`), not sending Jev through OMP model sessions.
- Return Jev's answers as-is. For this use case that is `noul` (and later `choice` / `score` / `confidence` / `probabilities` for other callers). Code/skill decides the threshold and what to stamp.
- Classification only — no text generation, no “explain why” from Jev.
- Skills cannot call HTTP. `b-phase` either instructs the agent to call the session tool, or uses an eval cell. The tool/extension owns the TypeSafe call.
- Separate from `.context/2026-09-21.jev-decision-opportunities/` (buck-loop chooser). This is the shared primitive; that plan can consume it later.
- Fail closed if the API key is missing or TypeSafe errors. No silent smol/LLM fallback that pretends to be Jev.

## Open questions
- **Eval wiring.** Is “eval” = skills call existing kernel `judge()`, or actually point `judge()` at TypeSafe (OMP runtime, possibly outside this repo), or a thin eval helper that shares the extension's client?
- **Batching.** One Jev request per phase vs one request with N independent `hard` Nouls (cheaper/faster per TypeSafe fan-out).
- **Home.** `extensions/` in this repo (wired from `extensions/index.ts`) vs a global OMP plugin. Default: this repo.
- **Failure.** If the key is missing or TypeSafe errors, does `b-phase` refuse to stamp difficulty, or fall back to the current prose rubric?

## Brainstorm notes
- Noul (live docs): yes/no; answer is `noul` in 0..1; no separate confidence. Near 0.5 means yes and no are equally likely, not “medium difficulty.” Do not use Noul to encode easy/medium/hard.
- Extension vs tool: the extension is the module OMP loads (`extensions/index.ts` → `wire(api)`); the tool is what it registers via `api.registerTool({ name, schema, execute })`. A registered tool is function-called by the LLM mid-chat (like `grep`), unlike a slash command the user types. "Home: `extensions/`" means "the tool is registered by an extension in this repo."
- Choice is still the tool's general signature (`type`, `instructions`, `criteria` → `choice` / `probabilities` / `confidence`). b-phase v1 does not need it unless we want confidence on hard/not-hard.
- JS SDK: `noul(instructions, criteria?)` then `client.systemOne({ state, questions })` → `response.answers.hard.noul`.
- `b-phase` rubric today is three-way. This work cuts it to the hard clause only. Easy and medium both become “not hard.”
- Suggested state (named JSON, not a blob): `{ name, goal, files, from_plan_steps, risks, verification, depends_on }` plus the hard-clause of the rubric in `instructions`/`criteria`.
- Prior lock: extensions use `@typesafe-ai/sdk`; skills/eval use `judge()`; never wrap Jev in `runOmpModelSession`. Never claim `judge()` is TypeSafe until the OMP backend is verified.
- Threshold is a named constant in one place (TypeSafe's own review guidance: questions and thresholds in a single reviewable file). Record the raw `noul` beside the stamp (e.g. `hard_noul: 0.82` in phase frontmatter or the overview row) so 0.5–0.7 calls are auditable later.
- First success check: from an OMP session, call the tool with a toy Noul and get a real `noul`. Second: `b-phase` stamps `difficulty: hard` / `buck_hint: /b-build-hard` from that answer instead of the main model guessing.
