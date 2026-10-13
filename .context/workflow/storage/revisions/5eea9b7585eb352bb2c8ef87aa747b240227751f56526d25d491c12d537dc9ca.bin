---
status: active
date: 2026-06-07
subject: 2026-06-06.omp-integration-buck-workflow
topics: [cross-harness, compat, slash-commands, eval-kernel, b-phase, b-plan, omp-execution-recommendation, omp-autonomous-loops, b-grill]
research: [research-omp-integration.md]
iterations: []
spec: []
memory: []
---

# Plan: Cross-harness compat + phased kernel

## User Goal

Maintainer of `buck-workflow-pi` (and downstream packages following the same pattern) who installs on **any** of the five supported harnesses (Pi, OMP, Claude Code, OpenCode, Codex). The work makes the omp-integration surfaces safely no-op on non-OMP harnesses instead of producing misleading slash commands, and it elevates the eval-kernel work from a one-shot starter template into a phased workstream with concrete deliverables.

## Goal

Two pieces, deliberately split so a small change does not block a large one:

1. **Cross-harness compat (Phase 1)** — three small targeted edits that make the new OMP surfaces behave correctly on every harness, not just OMP.
2. **Phased kernel (Phases 2–4)** — break the eval-kernel integration into discrete phases (contract doc → real-usage examples → `b-grill*` integration) so the work does not conflate with the compat fixes and can be paused, reviewed, or re-ordered.

## Context used / assumptions

- **User-provided context** (this turn): "those three and phase the kernel" — `those three` = the three compat fixes proposed in the prior turn; `phase the kernel` = treat the eval-kernel integration as a phased workstream.
- **Session context**: just completed the F1–F7 build (3 slash-command stubs, docs, AGENTS cross-ref, `omp_execution` frontmatter field, `b-plan` recommendation rules, eval cell template, `b-review` 6-step audit). All committed to working tree; tests pass (163/163).
- **Artifacts used**:
  - `research-omp-integration.md` (16.9 KB) — source-verified analysis of the three primitives and the eval-kernel.
  - `follow-ups.md` (6.3 KB) — F1–F9 plus the "do not" list. F9 is the explicit kernel follow-up.
  - `skills/cross-platform-pi-omp-loading/SKILL.md` — already documents the slash-command mirror and the per-harness discovery model.
- **Assumptions**:
  - The active subject folder remains `.context/2026-06-06.omp-integration-buck-workflow/`. Both pieces of work belong here.
  - The user wants the kernel phasing **inside this plan**, not as a separate `/skill:b-phase` invocation. (`/skill:b-phase` is recommended in the Ralph Instructions for execution-time phase-file generation.)
  - "Phase the kernel" is interpreted as: turn the kernel integration into a phased workstream with discrete phases, not "run b-phase to break an unspecified plan into phases."
  - No new Pi extension or state machine — same constraint as F1–F7.
- **Open questions** (raised in plan, not blocking):
  - Phase 3 says "1–2 example cells" — is one enough, or should it be two? Default: two (review-audit + migration-sweep), one of each shape.
  - Phase 4 (F9) hooks `b-grill-me` and `b-grill-with-docs`. Is the `decision_domains` data shape stable enough to pre-populate `PHASES`? Defer to Phase 4 — if not stable, F9 splits into a spec + plan.

## Scope

**In scope:**

1. Three targeted compat edits (Phase 1).
2. Eval-kernel contract documentation (Phase 2) — a `docs/eval-kernel.md` file that captures the prelude helpers, the eval tool's API, the agent-loop contract, and the budget semantics. Source-verified against omp v15.10.0.
3. Two real example `eval-*.py` cells (Phase 3) — review-audit pattern and migration-sweep pattern, written to `.context/2026-06-06.omp-integration-buck-workflow/eval-review-audit.py` and `eval-migration-sweep.py`. Both verified with `ast.parse`. Both demonstrate the full `parallel()` → `pipeline()` → `llm()` flow with a real schema.
4. `b-grill*` integration with the cell (Phase 4) — F9 from follow-ups. `b-grill-me` and `b-grill-with-docs` auto-derive the cell's `PHASES` list and `build_prompt()` body from `decision_domains`. New skill section, not new skill.

**Out of scope:**

- Real OMP-side changes (e.g., a JS eval-kernel variant, prelude helper additions) — those are upstream omp PRs, separate repo.
- New Pi extension or state machine — explicitly forbidden by the F1–F7 build's "do not" list.
- Backporting the three compat fixes to the legacy OpenCode deployment — pre-existing, not in this plan.
- A new `b-phase-kernel` skill — the existing `b-phase` skill can produce phase files; the kernel work does not warrant a new skill.
- Multi-language (JS) eval cell — `b-plan`'s eval template notes a JS variant; not building one in this pass.

## Out of scope

Recap of the items above, grouped by where they belong:

- **Upstream omp** — JS eval-kernel variant, prelude helper additions. These are separate PRs against `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/`, not part of this plan.
- **buck-workflow-pi** — new Pi extension, new state machine, new `b-phase-kernel` skill, JS eval cell. All explicitly excluded by the F1–F7 build's "do not" list and the F1 follow-ups.
- **OpenCode legacy deployment** — the `command/` (singular) vs `commands/` (plural) asymmetry is pre-existing and not in scope.

## Affected files

| Phase | File | Change |
|---|---|---|
| 1 | `prompts/omp-orchestrate.md` | Add no-op-on-non-OMP header guard |
| 1 | `prompts/omp-workflow.md` | Add no-op-on-non-OMP header guard |
| 1 | `prompts/omp-goal.md` | Add no-op-on-non-OMP header guard |
| 1 | `skills/b-plan/SKILL.md` | Add top-row harness guard to OMP Execution Recommendation table |
| 1 | `skills/b-plan/SKILL.md` | Add runtime probe to eval cell template prelude |
| 1 | `docs/buck-workflow.md` | Note: not strictly required (header guard is the user-facing change) — but a one-line update in the "OMP Autonomous Loops" section pointing at the guard keeps docs in sync |
| 2 | `docs/eval-kernel.md` | **new** — eval-kernel contract documentation |
| 2 | `skills/b-plan/SKILL.md` | Cross-reference `docs/eval-kernel.md` from the eval template section |
| 3 | `.context/2026-06-06.omp-integration-buck-workflow/eval-review-audit.py` | **new** — review-audit example cell |
| 3 | `.context/2026-06-06.omp-integration-buck-workflow/eval-migration-sweep.py` | **new** — migration-sweep example cell |
| 3 | `skills/b-plan/SKILL.md` | Append "Example cells" subsection to eval template section |
| 4 | `skills/b-grill-me/SKILL.md` | New section: "Feeding the workflow-kernel cell" |
| 4 | `skills/b-grill-with-docs/SKILL.md` | Same section (the two skills are siblings — `b-grill-with-docs` is `b-grill-me` plus doc awareness) |
| 4 | `docs/eval-kernel.md` | Append "decision_domains → PHASES" mapping |
| 4 | `.context/2026-06-06.omp-integration-buck-workflow/index.md` | Update status: active → completed once Phase 4 lands |

Plus the standard plan-iteration files produced by `/skill:b-phase` if the user invokes it:
`.context/2026-06-06.omp-integration-buck-workflow/plan-cross-harness-kernel-phases.md` (overview) and `phase-{1,2,3,4}-*.md` (per-phase files).

## Implementation steps

The plan is structured as four phases. **Each phase is a discrete unit**: read the active phase file, run only that scope, review, iterate if needed, save, commit, then move to the next.

### Phase 1: Cross-harness compat (easy, ~30 min)

Goal: make the new OMP surfaces no-op cleanly on Pi / Claude Code / OpenCode / Codex. Hard deps on nothing — this is the foundation phase.

1. **Edit `prompts/omp-orchestrate.md`** — prepend a header guard:

   ```markdown
   > **Harness note:** This command documents the omp `orchestrate` keyword contract.
   > On non-OMP harnesses (Pi, Claude Code, OpenCode, Codex) it is a no-op — the keyword
   > does not exist and the orchestrator contract does not apply. Skip this command on
   > non-OMP sessions; use `/b-plan` + `/skill:b-phase` for normal phased execution.
   ```

2. **Edit `prompts/omp-workflow.md`** — same shape, `workflow`-flavored.
3. **Edit `prompts/omp-goal.md`** — same shape, `/goal`-flavored. Note that `/goal` is **also** an omp slash command at `src/slash-commands/builtin-registry.ts:97`; on Claude Code the `/goal` slash command is a different namespace entirely.
4. **Edit `skills/b-plan/SKILL.md` "OMP Execution Recommendation" table** — add a top-row guard:

   ```markdown
   | If the active harness is not OMP, return `none` (omit) immediately. The remaining rules assume OMP. | `none` (omit) | Prevents recommending a primitive the harness cannot invoke. Detect from session state (omp has an `omp` tool / `omp.runtime` field; Pi has `pi.runtime`; Claude Code has none) or from the package's `package.json` `omp` field presence. |
   ```

5. **Edit `skills/b-plan/SKILL.md` "Eval Cell Template" prelude** — replace the bare `from prelude import ...` with a guarded import:

   ```python
   try:
       from prelude import agent, parallel, pipeline, llm, phase, log, budget  # noqa: F401
   except ImportError:
       # The eval cell is OMP-specific. On non-OMP runtimes, the helpers do not
       # exist; surface a clear no-op so the user knows the cell is not portable.
       def _no_op(*_args, **_kwargs):
           print("eval cell: omp runtime required (prelude helpers missing); skipped.")
           return None
       agent = parallel = pipeline = llm = phase = log = budget = _no_op  # type: ignore
   ```

6. **Edit `docs/buck-workflow.md`** — in the "OMP Autonomous Loops" section, add one sentence under "What the workflow does NOT do" pointing at the header guard and runtime probe as the cross-harness safety net.

**Verification:** `npx vitest run` (163/163 pass). `diff <(ls prompts/) <(ls commands/)` (in sync). `python3 -c "import ast; ast.parse(...)"` on the eval template (parses). Each `omp-*.md` opens with a visible harness note.

**Acceptance criteria:**
- [ ] `prompts/omp-{orchestrate,workflow,goal}.md` each have a harness-note blockquote in the first 5 lines
- [ ] `b-plan` "OMP Execution Recommendation" table has a harness guard as row 1
- [ ] Eval cell template prelude is wrapped in `try / except ImportError` and the cell still parses
- [ ] `docs/buck-workflow.md` "OMP Autonomous Loops" mentions the guard/probe in the "does NOT" list

### Phase 2: Kernel contract doc (medium, ~1 hr)

Goal: capture the eval-kernel contract for downstream skills (and for the next agent). Hard dep: Phase 1 (the contract doc references the runtime probe from Phase 1).

1. **Create `docs/eval-kernel.md`** with the following sections:
   - **What it is** — the persistent Python (or JS) kernel exposed by omp's `eval` tool. State persists across cells, tool calls, and subagents.
   - **Helpers** — `agent()` / `parallel()` / `pipeline()` / `llm()` / `phase()` / `log()` / `budget()`. Each with signature, return shape, and one example.
   - **Budget** — `budget.remaining()` semantics, hard vs. soft ceiling, `+Nk!` / Goal Mode interaction. Cite `src/eval/py/prelude.py` and `src/goals/runtime.ts:87-99`.
   - **Schemas** — `schema=` parameter passes a JSON Schema to the subagent; output is a parsed object. State the `additionalProperties: false` rule.
   - **Failure modes** — `agent()` raises past a hard ceiling; `parallel()` propagates the first throw; `pipeline()` barrier semantics.
   - **Cross-platform** — link to `docs/buck-workflow.md#omp-autonomous-loops`; the eval cell is OMP-only; on other harnesses the cell is a no-op (Phase 1's runtime probe).
2. **Edit `skills/b-plan/SKILL.md`** — in the "Eval Cell Template" section, after the closing ` ``` `, add a `> **See also:** docs/eval-kernel.md for the full helper API, budget semantics, and failure modes.` line.
3. **Update `.context/2026-06-06.omp-integration-buck-workflow/index.md`** — add `docs/eval-kernel.md` to the `artifacts:` list and note Phase 2 status.

**Verification:** `npx vitest run` (no regressions — the new doc doesn't change code). Open `docs/eval-kernel.md` in a text editor and confirm every section header is present and every helper has a signature line.

**Acceptance criteria:**
- [ ] `docs/eval-kernel.md` exists with the 6 sections above
- [ ] Every helper in the prelude has a signature, return shape, and one example
- [ ] Budget section cites `src/goals/runtime.ts:87-99` and `src/eval/py/prelude.py`
- [ ] `b-plan` eval template section cross-references the doc

### Phase 3: Real kernel usage examples (medium, ~1.5 hr)

Goal: prove the eval-kernel works end-to-end with two non-trivial patterns. Hard dep: Phase 2 (the example cells reference helper signatures documented in Phase 2's doc).

1. **Create `.context/2026-06-06.omp-integration-buck-workflow/eval-review-audit.py`** — a review-audit example. Edits:
   - Replace `<subject-folder-name>` and `<slug-N>` placeholders with concrete values for this subject.
   - Use a real `PHASES` list pointing at this subject's actual phase files.
   - Schema: per-phase `{verdict, evidence, risks, open_questions}` (already in the template).
   - `build_prompt()` references the actual file paths in `.context/2026-06-06.omp-integration-buck-workflow/`.
   - Add a `__main__` guard so the cell can also be run as a plain Python script for syntax checking without the prelude.
2. **Create `.context/2026-06-06.omp-integration-buck-workflow/eval-migration-sweep.py`** — a migration-sweep example. Different shape:
   - Each phase produces a `blockers` list (forward-portable to a follow-up plan).
   - `parallel()` runs the sweep per directory.
   - `pipeline()` synthesizes a single "ready to migrate" verdict.
   - Demonstrates the `llm()` judge with a multi-criterion schema (`compatibility_score`, `effort_estimate`, `blockers`).
3. **Append an "Example cells" subsection to `skills/b-plan/SKILL.md`** "Eval Cell Template" section — pointers to both files with one-sentence descriptions of when to use each.
4. **Verify both cells parse**: `python3 -c "import ast; [ast.parse(open(p).read()) for p in ['eval-review-audit.py', 'eval-migration-sweep.py']]"`.

**Verification:** `ast.parse` succeeds for both files. `npx vitest run` (no regressions). Open each cell and confirm the `PHASES` list points at real artifacts, the schemas use `additionalProperties: false`, and the `llm()` judge has a real multi-criterion schema.

**Acceptance criteria:**
- [ ] Both example cells exist in the subject folder
- [ ] Both cells have a `__main__` syntax-check guard
- [ ] `PHASES` lists in both cells reference real phase files (not placeholders)
- [ ] `b-plan` eval template section has a new "Example cells" subsection pointing at both files

### Phase 4: b-grill* integration with the cell (hard, ~2 hr)

Goal: F9 from follow-ups — `b-grill-me` and `b-grill-with-docs` pre-populate the eval cell's `PHASES` list from interview findings. Hard deps: Phases 2 and 3 (the mapping is defined in Phase 2's doc; the cell shape is exercised in Phase 3).

1. **Read `skills/b-grill-me/SKILL.md`** and `skills/b-grill-with-docs/SKILL.md` to confirm the `decision_domains` data shape (the output of a grilling session).
2. **Append a "Feeding the workflow-kernel cell" section to both skills** with:
   - A mapping table: `decision_domain` → `PHASES` entry (one `agent()` per domain, brief = domain rationale).
   - An auto-derive algorithm: enumerate `decision_domains`, for each emit `(N, slug_of(domain), difficulty=medium, brief=domain.rationale)`, write to `.context/<subject>/eval-<topic>.py` using the F6 template as the body.
   - A note: this only fires when the plan declares `omp_execution: workflow` AND the upstream `b-grill*` session produced at least one `decision_domain`. Otherwise the user fills the cell by hand.
3. **Append a "decision_domains → PHASES" subsection to `docs/eval-kernel.md`** — describe the mapping's invariants (one `agent()` per domain, schema is unchanged, judge prompt names the domains explicitly).
4. **Update `.context/2026-06-06.omp-integration-buck-workflow/index.md`** — set `status: completed`.

**Verification:** `npx vitest run` (no regressions). Read the new sections in both `b-grill*` skills and confirm the mapping table has a row for each `decision_domain` shape in the existing grilling output. Open `.context/.../index.md` and confirm `status: completed`.

**Acceptance criteria:**
- [ ] `b-grill-me` and `b-grill-with-docs` have a "Feeding the workflow-kernel cell" section
- [ ] Mapping table covers all `decision_domain` shapes the existing skills emit
- [ ] `docs/eval-kernel.md` has a "decision_domains → PHASES" subsection
- [ ] Subject folder index is `status: completed`

## Verification

**End-to-end:**

- `npx vitest run` — all 163 tests pass after every phase
- `diff <(ls prompts/) <(ls commands/)` — in sync (still 17 entries, no drift)
- `python3 -c "import ast; ast.parse(open('<path>').read())"` — every `*.py` cell parses
- `for f in commands/*.md; do [ -f "$f" ] || echo BROKEN; done` — every symlink resolves
- `grep -c "harness note" prompts/omp-*.md` — equals 3 (one per omp stub)

**Cross-harness smoke (Phase 1 specifically):**

- On Pi: `/omp-orchestrate` is registered (it is a Pi slash command via `prompts/`). Opening the prompt shows the harness-note blockquote. The body says "no-op on non-OMP sessions" — Pi is non-OMP, so the user follows the no-op guidance.
- On OMP: same prompt; OMP *does* trigger the keyword contract when the user types `orchestrate`. The harness note is a pre-flight reminder, not a contradiction.
- On Claude Code: `/omp-orchestrate` is registered via `commands/`. The harness note correctly says "Claude Code is non-OMP; skip." No contradictory instructions.
- On OpenCode: `commands/` is the plural form; OpenCode reads `command/` (singular). The pre-existing buck-workflow pattern means `/omp-*` is **not** registered on OpenCode. The user can still read the file directly. (Pre-existing asymmetry, not in scope.)
- On Codex: same as Claude Code — slash command registered, harness note applies.

**OMP Execution Recommendation (this plan's own meta-check):**

Applying the rules from `skills/b-plan/SKILL.md` "OMP Execution Recommendation":

- Plan is phased? Yes (4 phases).
- ≥ 4 phases? Yes.
- ≥ 1 HARD dependency between phases? Yes (each phase hard-depends on the previous).
- → First rule matches → **recommend `orchestrate`** (when the active harness is OMP).

Wording added to the Ralph Instructions section below.

## Ralph Instructions

<!-- OMP opt-in: this plan is recommended to run under `orchestrate` mode on OMP harnesses. 4 sequential phases, each hard-depends on the previous; the orchestrator contract (parallel `task` subagents, no-yield-between-phases, verify-after-every-phase) maps cleanly. On non-OMP harnesses, omit `omp_execution` (the Phase 1 top-row guard handles that case). -->

This is a phased Ralph-ready plan. Treat each phase as one unit:

1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. If the phase's `omp_execution` is `orchestrate | workflow | goal`, drop the matching keyword (or run `/goal set`) on the first turn before the build command — see the phase file's "Ralph Mini-Cycle Instructions" for the precondition.
4. Run `/b-review` against the phase file after implementation.
5. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
6. Run `/b-save` to consolidate memory, draft commits, and phase state.
7. Run `/git-commit` to checkpoint durable state before `ralph_done`.

Per the OMP Execution Recommendation table: this plan matches the first row (≥ 4 phases with hard deps) → recommend `orchestrate` on OMP. On non-OMP, the Phase 1 top-row guard returns `none` and the Ralph cycle runs without an opt-in keyword.

To generate discrete phase files (`plan-cross-harness-kernel-phases.md` overview + `phase-{1,2,3,4}-*.md`), run `/skill:b-phase <path to this plan>`. The phases-overview file replaces the per-phase instructions above.

## Risks

- **Header guard wording could read as "the command is broken" on first glance.** Mitigation: use the word "no-op," not "unsupported" or "deprecated." The slash command still appears in the palette; the body explains the no-op nature. Phase 1 acceptance criterion 1 is gated on the wording review.
- **Top-row guard could over-trigger on edge cases** (e.g., a session that started in OMP and was later swapped to a different harness). Mitigation: detect from runtime signal, not from a one-time check at skill load. The Phase 1 step 4 acceptance criterion notes the runtime detection rule.
- **Runtime probe in the eval template could mask legitimate import errors** (a typo in `prelude` would now be caught and turned into a no-op). Mitigation: the probe is specific to `ImportError`; other exceptions still propagate. The cell is a starter; the user is expected to read the prelude imports before editing.
- **Phase 3's "1–2 example cells"** is open. If only one is built, the migration-sweep pattern is undocumented in the subject folder. Mitigation: the plan says "two" as the default; the open question is raised in the Context section. If the user wants one, Phase 3 is shorter.
- **Phase 4 depends on `decision_domains` shape stability.** If the shape changes, the mapping is wrong. Mitigation: Phase 4 step 1 reads the existing skills to confirm the shape before adding the new section. If unstable, F9 splits into a spec + plan (out-of-scope note).
- **The 3 compat fixes do not address the OpenCode `command/` vs `commands/` asymmetry** — pre-existing, not introduced by this plan.
