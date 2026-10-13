---
status: active
date: 2026-06-26
subject: 2026-06-26.remove-ralph-loop
topics: [omp-native, execution-loop, goal-mode, terminology-scrub]
research: []
iterations: []
spec: null
memory: []
---

# Plan: Remove the Ralph loop layer — make buck-workflow OMP-native

## User Goal

The maintainer of buck-workflow-pi wants the workflow skills and docs to read as a
first-class OMP citizen: no legacy "Ralph loop" (pi-ralph-wiggum) branding, with
`/goal set` as the top-level persistent execution envelope. Who benefits: anyone
reading or running the skills — a cleaner mental model with no dead third-party-loop
references pointing at a mechanism the repo no longer drives its primary loop through.

## Goal

Strip the Ralph loop layer from the **live authoring surface** (skills, docs, one
presentation) and reframe the per-phase/per-plan execution instructions as an
OMP-native loop. `/goal set` becomes the recommended top-level persistent envelope;
`goal({op:"complete"})` is the terminal completion audit. The harness-agnostic
mini-cycle (build → review → iterate → docs → save → commit) is **preserved
unchanged** — only the Ralph-specific yield signal (`ralph_done`) and Ralph
branding go away.

## Context used / assumptions

- **User-provided context**: "get rid of references to [Ralph]; make it omp native;
  omp has its own loops, but more likely we'll be using the /goal command to run
  through the entire process of the buck-workflow."
- **Session context**: branch `remove-ralph-loop` already checked out.
- **Key design decisions (from verification, not assumption)**:
  - `/goal set` is the **entry toggle**; `goal({op:"complete"})` is the **terminal**
    completion audit over the whole objective — NOT a per-mini-cycle handoff
    (`prompts/omp-goal.md:54`, `skills/b-phase/SKILL.md:234`). So `ralph_done` has
    **no per-cycle analog** under goal mode: the agent works the durable mini-cycle
    continuously and the goal audit fires once at the end. The mini-cycle simply
    *loses its yield signal*.
  - The three OMP primitives (`orchestrate`/`workflow`/`goal`) are **already
    OMP-native** and stay. Only the Ralph layer *underneath* them is removed; the
    `omp_execution` field and eval-cell template are preserved.
  - **Terminology rule (scope-leak guard).** The generic mini-cycle (build → review
    → iterate → docs → save → commit) is mode-neutral and stays so: rename the Ralph
    layer to a **neutral "OMP execution session / execution loop"** wherever the
    mini-cycle is generic. Reserve `/goal set` and `goal({op:"complete"})` language
    **only** for the goal-mode-specific branches/templates. Do not make generic
    mini-cycle prose goal-specific — that would contradict keeping
    `orchestrate`/`workflow` alive as equal peers.
  - **`b-plan` never writes `omp_execution` to frontmatter** — it only *recommends*
    a mode in the Execution Instructions section (`skills/b-plan/SKILL.md:214-255`).
    "/goal as the recommended default envelope" means b-plan *recommends* `/goal set`
    in prose, consistent with the existing "does not auto-set" contract
    (`docs/buck-workflow.md` "What the workflow does NOT do"). Do not spec b-plan as
    auto-writing `omp_execution: goal`, and do not replace per-plan
    `workflow`/`orchestrate` recommendations.
  - **`ralph_status` is redundant and safe to drop**: b-review/b-iterate always
    co-wrote it alongside the authoritative `status` field. Reading `status` as
    source of truth means every existing `.context/**` artifact resumes cleanly —
    **no migration script, no field rename**. Old `ralph_status` values become
    inert vestigial frontmatter that the skills simply stop reading/writing.
  - **`ralph_complexity` is redundant**: drop it with **no replacement field**. Its
    meaning (single vs multi iteration) is already covered by `difficulty` (the sizing
    label) plus generic resume semantics (`status: in-progress`, acceptance criteria,
    save/commit cadence). Do not lean on `omp_goal_budget` as a successor — that field
    only exists for `omp_execution: goal` and is not a general size signal.
- **Out of scope (explicit)**:
  - `.context/**` historical artifacts (51 files with ralph matches) — they are the
    audit trail of what *happened*, not the current truth. Editing them breaks the
    paper trail and is churn. Existing phase/iterate artifacts keep working because
    `status` was always authoritative.
  - No data-migration script. No field rename that would orphan old artifacts.
  - `prompts/omp-{goal,workflow,orchestrate}.md` stubs are already OMP-native and
    contain no Ralph refs — left untouched.

## Scope

### Affected files (9 — the complete live authoring surface)

| File | Nature of change |
|---|---|
| `skills/b-plan/SKILL.md` | "Non-Phased Ralph Plans" → "Non-Phased Execution-Ready Plans" (neutral template; b-plan recommends `/goal` as the default envelope within); "Ralph Instructions" templates → "Execution Instructions"; plan-structure section heading; "Ralph-ready phases" phrasing. Keep `omp_execution` recommendation table + eval-cell template (OMP-native, untouched). |
| `skills/b-phase/SKILL.md` | "Ralph Mini-Cycle Instructions" → "Per-Phase Execution Loop"; "Ralph Workflow Instructions"/"Ralph Execution Checklist"/"Ralph Instructions Template" → drop the "Ralph" word (neutral execution-session language); `ralph_complexity` field dropped from frontmatter template + prose; "start a Ralph loop" → "start an OMP execution session (`/goal` by default)"; Integration-section "Ralph loops" bullet reframed. |
| `skills/b-build/SKILL.md` | "Ralph Loop Awareness" section → "Execution Loop Awareness"; `ralph_done` refs reframed (neutral: continue the execution session; `/b-save` for durable resume state). |
| `skills/b-review/SKILL.md` | `ralph_status: pending` dropped from iterate-artifact template (keep `status`/`completed` as authoritative); lifecycle-tracking prose updated; "do not call `ralph_done`" → neutral execution-session framing. |
| `skills/b-iterate/SKILL.md` | "Ralph in-progress phase" check → neutral "in-progress phase" check; read `status` (authoritative; legacy artifacts resume because `status` was always co-written — no legacy-token handling needed); closeout writes + "before `ralph_done`" reframed to neutral execution-session language. |
| `skills/b-save/SKILL.md` | "Before yielding in a Ralph loop" bullet → "Before yielding an OMP execution session" (one line). |
| `skills/b-pr-review-2-issues/SKILL.md` | `ralph_mini_cycle:` YAML field → `execution_loop:`; `ralph_done` in its body → terminal note. |
| `docs/buck-workflow.md` | "Ralph loops: run `/b-commit` before `ralph_done`" → neutral execution-session framing; OMP Autonomous Loops section prose ("Ralph Instructions" → "Execution Instructions", line ~87/97). |
| `presentations/omp-integration-buck-workflow/blueprint.html` | `ralph_complexity` code samples (lines ~583/597/795) → reflect the new frontmatter (drop the field); this is a generated artifact but lives in-repo as documentation. |

## Out of scope

- `.context/**` (historical audit trail — see above).
- `prompts/omp-*.md` and `commands/` (already OMP-native, no Ralph refs).
- The three-primitive framework, `omp_execution` field, eval-cell template (preserved).
- Any runtime/extension code (none reference Ralph).

## Implementation steps

### Step 1 — `skills/b-save/SKILL.md` (trivial, 1 line)
Change line 16 `- Before yielding in a Ralph loop` → `- Before yielding an OMP execution session`.

### Step 2 — `skills/b-build/SKILL.md` (section reframe, ~lines 313-321)
Rename `## Ralph Loop Awareness` → `## Execution Loop Awareness`. Reframe the
body: inside an OMP execution session the agent works continuously; there is no
per-cycle yield signal. Replace each `ralph_done` clause:
- "run `/b-save`... then `/b-commit` before calling `ralph_done`" → "...before yielding,
  so memory, draft commit text, and artifact state are recoverable across turns."
- "Do not call `ralph_done` after a source change unless durable state has been written"
  → "Do not yield after a source change unless `/b-save` has written durable state."
Keep the in-progress/iterate-resume guidance (it is harness-agnostic and correct).

### Step 3 — `skills/b-review/SKILL.md` (iterate template + lifecycle, ~lines 336/365/370)
- Drop `ralph_status: pending # ...` line from the iterate-artifact frontmatter
  template. Keep `status: active`, `completed: null`, `from_review`.
- Recommended-Workflow line: "If running inside Ralph, do not call `ralph_done` until..."
  → "Inside an OMP execution session, the iterate artifact is not done until review
  passes and `/b-save` has recorded durable state."
- Lifecycle-tracking: "updates `status: completed`, `ralph_status: completed`" →
  "updates `status: completed` and `completed: <date>`".

### Step 4 — `skills/b-iterate/SKILL.md` (detection + closeout, ~lines 17/19/49/51/58/73)
- "Also check for Ralph in-progress phase" → "Also check for an in-progress phase
  inside an OMP execution session" (neutral).
- "If `ralph_status: pending` is present, treat the artifact as Ralph-blocking until
  review passes" → "Treat any active (`status: active` / `completed: null`) iterate
  artifact as blocking until review passes. Read `status` as the source of truth — do
  not mention or branch on the legacy `ralph_status` token."
- Completion step 8 + closeout step 1: stop writing `ralph_status`; write only `status`.
- "before `ralph_done` if inside a Ralph loop" → "before yielding the execution session".

### Step 5 — `skills/b-pr-review-2-issues/SKILL.md` (1 YAML field, ~lines 230-235)
Rename `ralph_mini_cycle: |` → `execution_loop: |`; change its final step
"Run /b-save, then /b-commit, then ralph_done" → "Run /b-save, then /b-commit". The
cycle terminates there (no per-cycle yield signal). Keep this generic — do not inject
goal-mode semantics; goal-mode completion belongs only in b-plan/b-phase templates.

### Step 6 — `skills/b-plan/SKILL.md` (templates + headings)
- Line 176 phrasing "Ralph-ready phases" → "OMP-ready execution phases".
- Line 177: "If the user wants Ralph automation but..." → "If the user wants an
  automated execution session but the plan does **not** need phasing, keep the plan
  non-phased and add a minimal **Execution Instructions** section for the single-unit
  cycle: `/b-build` → `/b-review` → `/b-iterate` if in-plan issues → `/b-docs` if doc
  impact → `/b-save` → `/b-commit`. Out-of-plan findings spawn a separate `/b-plan` →
  `/b-build` cycle, not an iterate loop." (note: **no trailing yield signal** — the
  agent works the cycle continuously; under `/goal`, the recommended default,
  completion is the terminal `goal({op:"complete"})` audit; under other modes the user
  drives it.)
- "## Non-Phased Ralph Plans" (line ~194) → "## Non-Phased Execution-Ready Plans".
  Rewrite the body template: the durable mini-cycle is the same and mode-neutral;
  b-plan recommends running it under `/goal set "<User Goal>" --budget
  <omp_goal_budget>` as the default envelope (a recommendation, not auto-set). Drop
  `ralph_done` from the enumerated steps; add a terminal-completion note for goal mode.
- "## Ralph Instructions" headings inside the two templates (non-phased + phased) →
  "## Execution Instructions". Drop `ralph_done` from the final enumerated step in
  each; for the phased template, keep the per-phase `omp_execution` keyword precondition.
- Recommended Plan Structure: "## Ralph Instructions" → "## Execution Instructions".

### Step 7 — `skills/b-phase/SKILL.md` (frontmatter + 4 sections + integration)
- Frontmatter template (line 163): **drop** the `ralph_complexity: single | multi`
  line entirely with **no replacement field**. Sizing is covered by `difficulty` plus
  resume semantics (`status: in-progress`, acceptance criteria, save/commit cadence).
- "## Ralph Mini-Cycle Instructions" (line ~217) → "## Per-Phase Execution Loop".
  Reframe "If executing this phase inside a Ralph loop" → "If executing this phase
  inside an OMP execution session" (neutral). Drop `ralph_done` from step 5; reframe
  step 6 resume. Keep the `omp_execution` keyword-precondition expansion table intact.
- "## Ralph Workflow Instructions" (line ~316) → "## Execution Workflow". Reframe
  "Ralph's durable navigation map" → "the durable navigation map for an OMP execution
  session". Drop `ralph_done` from step 6/7; step 7 "next Ralph iteration resumes" →
  "the session resumes". Keep the commit invariant.
- "## Ralph Execution Checklist" (line ~328) → "## Execution Checklist".
- "### Ralph Instructions Template" (line ~348) → "### Execution Instructions
  Template". Rename the canonical text block's headings to match; drop `ralph_done`;
  reframe the non-phased single-unit note (line ~371) to remove `ralph_done`.
- Step 7 Summarize (line ~394): "start a Ralph loop with the phases overview as the
  task source, and have each iteration follow build → review → ... → `ralph_done`" →
  "start an OMP execution session — by default `/goal set "<plan User Goal>"
  --budget <omp_goal_budget>` — and work the phases overview top-to-bottom; each phase
  runs build → review → iterate if in-plan → docs if impact → save → commit. Under goal
  mode, run `goal({op:"complete"})` once all acceptance criteria pass the 6-step audit."
- Integration-with-Buck-Workflow (line ~431): "Ralph loops" bullet → "OMP execution
  sessions" bullet, dropping `ralph_done`.

### Step 8 — `docs/buck-workflow.md`
- Line 1054: "Ralph loops: run `/b-commit` before `ralph_done`" → "Execution
  sessions: run `/b-commit` before yielding the turn".
- OMP Autonomous Loops "How buck-workflow surfaces them" (lines ~87/97): rename the
  in-prose "Ralph Mini-Cycle Instructions"/"Ralph Instructions" references to
  "Per-Phase Execution Loop"/"Execution Instructions".

### Step 9 — `presentations/omp-integration-buck-workflow/blueprint.html`
- Lines ~583, 597: drop `ralph_complexity: single | multi` from the two frontmatter
  code samples with **no replacement field** (the surrounding `difficulty`/`status`
  fields carry the sizing/resume signal).
- Line ~795 mitigation text: "Phase file's `ralph_complexity: multi` already encodes..."
  → "Phase file's `difficulty: hard` plus resume semantics (`status: in-progress`,
  acceptance criteria) already encode 'phase may span multiple turns.'"

## Verification

1. **No Ralph refs on the live surface**:
   ```
   search ralph|ralph_done|ralph_complexity|ralph_status|ralph_mini
     paths: [skills, prompts, extensions, docs, presentations, AGENTS.md,
             GLOBAL_OR_PROJECT-AGENTS.md, README.md]
   ```
   Expect **zero matches**. (`.context/**` is excluded and expected to still match —
   it is historical record.)
2. **Cross-references intact**: `prompts/omp-goal.md`, `prompts/omp-workflow.md`,
   `prompts/omp-orchestrate.md` and the `docs/buck-workflow.md` "OMP Autonomous Loops"
   section still resolve (no broken links introduced).
3. **Backward-compat spot check**: confirm b-iterate and b-review describe honoring an
   active iterate artifact via `status` (the authoritative field). Old artifacts resume
   cleanly because `status` was always co-written — no legacy-token handling is required.
4. **Consistency pass**: the mini-cycle wording (`/b-build` → `/b-review` → `/b-iterate`
   if in-plan → `/b-docs` if impact → `/b-save` → `/b-commit`) reads identically
   across b-plan, b-phase, b-build, b-review, b-iterate, b-pr-review-2-issues — no
   file now terminates the cycle with `ralph_done`.

## Risks

| Risk | Mitigation |
|---|---|
| A future agent reads an old `.context/**` phase file with `ralph_complexity` and errors | Readers never *required* the field; `difficulty` + resume semantics are the size signal. Old field is inert — no code reads it. |
| Old `iterate-*.md` with `ralph_status: pending` becomes invisible to the new loop logic | `status` was always co-written alongside `ralph_status`, so reading `status` as source of truth detects every active artifact. No legacy-token handling needed. |
| `blueprint.html` is a generated artifact; hand-editing it may be overwritten on next generation | Edit it for correctness now; note in the closeout that it should be regenerated if b-present is re-run over this subject. It is checked-in documentation either way. |
| Terminology drift: a stray "Ralph" survives in prose | The verification grep is case-insensitive across the full live surface; treat any survivor as a build defect. |
| Over-scope creep into `.context/**` | Explicitly out of scope; the user can request a separate history-rewrite later if desired. |

## Risks accepted

- None beyond the above. This is a terminology + framing scrub of prose/skill text and
  one generated HTML file. No runtime code, no tests, no package manifest touched.
