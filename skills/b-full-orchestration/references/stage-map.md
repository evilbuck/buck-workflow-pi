# Stage map

Two machines. The orchestrator steps the outer machine; each run worker steps the run machine. The ordered tables below are the only routing authority: take the first row whose guard is true. An effect is a subagent dispatch, a script, or a stop. Re-detect after the effect's evidence is verified. No true row is `blocked` — stop and name the missing proof.

Artifacts and retained revisions win over `orchestration.md` and over any start-stage hint. `enter` is detection, not a stage: never dispatch a worker named `enter`.

## Stage target resolution

Every dispatch target names a command, not a skill directory. Resolve before dispatch; never create a synthetic directory for an alias. Preserve stage arguments (`b-grill --mode auto` keeps its mode).

| Target | Procedure | The brief must pass |
|---|---|---|
| `b-build-hard` | `skills/b-build/SKILL.md` | difficulty **hard** |
| `b-commit` | `skills/git-commit/SKILL.md` | only the verified slice's prepared selection and expected parent |
| any other `b-<stage>` | `skills/<stage>/SKILL.md` | stage arguments |

## Outer machine

| from | to | guard | effect |
|---|---|---|---|
| detect | blocked | no subagent tool | stop, name the missing tool |
| detect | blocked | a worker returned a material unanswered question | relay it to the user once; resume this subject with the answer |
| detect | brainstorm | no formed task, only a vague idea | dispatch `b-brainstorm` |
| detect | explore | formed non-fix task, a named codebase fact is missing, no covering explore or research artifact | dispatch `b-explore` |
| detect | research | formed non-fix task, a named external fact is missing, no covering artifact | dispatch `b-research` |
| detect | plan | formed non-fix task, no named missing fact, no `plan-*.md` | dispatch `b-plan` |
| detect | plan-update | a plan has open questions and a covering artifact now answers them | dispatch `b-plan-update` |
| detect | explore | plan open questions need the codebase, ideation returns under 2 | dispatch `b-explore` |
| detect | research | plan open questions need external facts, ideation returns under 2 | dispatch `b-research` |
| detect | blocked | plan open questions remain and ideation returns is 2 | stop, name the questions |
| detect | phase | the plan recommends phasing and no `phase-N-*.md` exists | dispatch `b-phase` |
| detect | grill | the user asked to stress-test, no grill record | dispatch `b-grill --mode auto` |
| detect | present | the user asked to share, no presentation | dispatch `b-present` |
| detect | run | an incomplete run remains: a quick fix, or a ready plan with unfinished phases | dispatch one run worker |
| detect | backlog | every run committed, out-of-plan findings remain | dispatch `b-backlog` |
| detect | done | every run committed, no out-of-plan findings | stop |
| any stage | detect | stage artifact verified | re-detect |
| run | detect | run returned a commit that is the current tip | re-detect |
| run | blocked | run returned blocked or a question | stop |
| backlog | done | findings recorded, or named in the report | stop |

A run is the first incomplete phase in dependency order, the whole unphased plan, or one quick fix. Do not parallelize runs; they share this worktree. A phase with `status: completed`, every acceptance box `[x]`, and a commit containing its declared `files:` is not a run — wherever that commit sits in history.

## Run machine

| from | to | guard | effect | cap |
|---|---|---|---|---|
| enter | returned | verified completion for this exact slice (see Completion) | return | |
| enter | iterate | an active `iterate-*.md` for this slice, or a fresh quick fix with no implementation and no completion proof | start at `b-iterate` | |
| enter | buildHard | no implementation, and `buck_hint` is `b-build-hard` or the plan calls the work complex, ambiguous, or risky | start at `b-build-hard` | |
| enter | build | no implementation | start at `b-build` | |
| enter | review | implementation exists, no current review: none retained for this slice and cycle, or its fingerprint differs from the slice's content now | start at `b-review` | |
| enter | docs | current review pass, documentation impact, living docs not updated | start at `b-docs` | |
| enter | howto | current review pass, how-to impact only, docs impact none or handled | start at `b-howto` | |
| enter | guardrails | current review pass, doc gates clear, code touched, not docs-only, guardrails not passed | start at `b-guardrails-check` | |
| enter | save | current review pass, gates clear, no current save evidence | start at `b-save` | |
| enter | closeout | final plan-backed run, saved, subject closure pending | run `close-verified` | |
| enter | commit | saved, closure verified or not required, not committed | start at `b-commit` | |
| enter | blocked | no true row | stop, name the missing proof | |
| build | review | implementation verified | dispatch `b-review` | |
| buildHard | review | implementation verified | dispatch `b-review` | |
| review | iterate | verdict has in-plan issues, iterate count under 3 | dispatch `b-iterate` | 3 |
| review | buildHard | major in-plan and newly complex, iterate count under 3 | dispatch `b-build-hard` | 3 |
| review | build | major in-plan and not newly complex, iterate count under 3 | dispatch `b-build` | 3 |
| review | blocked | in-plan issues remain and iterate count is 3 | stop, name them | |
| review | docs | passed, documentation impact | dispatch `b-docs` | |
| review | howto | passed, how-to impact only | dispatch `b-howto` | |
| review | guardrails | passed, doc gates clear, code touched, not docs-only | dispatch `b-guardrails-check` | |
| review | save | passed, gates clear | dispatch `b-save` | |
| iterate | review | fix verified | dispatch `b-review` | |
| docs | guardrails | code touched, not docs-only, guardrails not passed | dispatch `b-guardrails-check` | |
| docs | save | docs-only, or guardrails passed, skipped, or not required | dispatch `b-save` | |
| howto | guardrails | code touched, not docs-only, guardrails not passed | dispatch `b-guardrails-check` | |
| howto | save | docs-only, or guardrails passed, skipped, or not required | dispatch `b-save` | |
| guardrails | iterate | required gate failed, guardrails fix count under 2 | dispatch `b-iterate` | 2 |
| guardrails | blocked | required gate failed and guardrails fix count is 2 | stop | |
| guardrails | save | pass, skip, or advisory | dispatch `b-save` | |
| save | closeout | final run and a plan exists | run `close-verified` | |
| save | commit | not the final run, or no plan | dispatch `b-commit` | |
| closeout | commit | `close-verified` ok | dispatch `b-commit` | |
| closeout | blocked | `close-verified` returned blockers | stop | |
| commit | returned | the new commit is the current tip, with the prepared parent and patch | return | |
| commit | blocked | protected branch, inseparable dirty paths, candidate mismatch, or commit failed | stop | |

The iterate cap counts `review` → `iterate`, `build`, and `buildHard` transitions. The guardrails cap counts `guardrails` → `iterate` transitions. They do not share a counter.

On a pass edge, record out-of-plan findings. They are not a backward edge and do not block the slice. The outer machine backlogs them after the last run.

`b-docs` follows `b-howto` when both apply, so a docs impact does not also take the howto edge.

## Completion, currency, caps

- **Completion (checked before any task label).** A phase is complete with `status: completed`, every `acceptance_criteria` box `[x]`, and a commit containing its declared `files:` anywhere in history — a valid historical checkpoint need not remain the tip after later phases. An unphased plan's final run is complete with plan `status: completed` from a non-empty fully verified checklist, verified subject closure, and a commit containing the plan's scope. A quick fix is complete with a verified commit whose diff is exactly the fix's paths. A newly returned commit, by contrast, must match the current tip before the outer machine starts the next run.
- **Review currency.** A review is current iff a retained `review` artifact exists for this subject, slice, and cycle, and its implementation fingerprint matches the slice's content now. `run.md` owns the fingerprint recipe. Changed bytes with an unchanged `HEAD` still invalidate the pass.
- **Caps.** Reconstruct both counts from slice-specific evidence on every entry: iterate count from prior `review → iterate`/`build`/`buildHard` transitions visible in retained review artifacts and `iterate-*.md` revisions, guardrails fix count from prior `guardrails → iterate` transitions. Restarting does not replenish a spent cap.

## Guard notes

- **Quick fix.** A small defect in current context, with no plan and no feature scope. Do not invent a plan for it.
- **Phase required.** The plan recommends phasing, or `skills/b-phase/SKILL.md` would phase it. That skill owns the split.
- **Docs-only.** Use the project's docs-only predicate. Do not invent one. Docs-only skips the guardrails gate.
- **Off this path unless the user asked.** `b-blueprint`, user-mode grill, `b-capture`. Grill on this path is `--mode auto`. Do not interview.
- **Ideation returns.** Only plan → explore/research → plan(-update) counts. The cap is 2.

## Worked examples

These illustrate the tables; the tables decide. Each names the observed next stage, not a new rule.

1. **Clear feature, familiar code, no prior artifacts.** Intake: formed task, no named missing fact, no plan → the `plan` row. After the plan verifies → `run`. The unphased run builds, reviews, clears gates, saves, closes, commits — no invented research artifact, no approval pause for save or commit.
2. **Two dependent phases; restart after phase 1's clean review.** Phase 1's run re-enters past `review`: the retained pass is current, fingerprint unchanged, so no re-review; downstream effects complete and phase 1 commits as the new tip; the outer machine then starts phase 2. In a separate trial, edit reviewed content without moving `HEAD`: the fingerprint differs, `enter → review` fires, and the old pass cannot advance.
3. **Final unphased plan; restart after save.** Saved with closure pending → the next effect is `close-verified`, not commit. An open criterion blocks plan completion and the commit both. With closure already verified and unrelated work staged: exactly the slice lands, the unrelated work stays staged.

## orchestration.md

Hint only. Re-detect from artifacts if they disagree.

```yaml
---
status: active
subject: <folder name>
updated: YYYY-MM-DD
---
```

Then a table: run, slice, stage, evidence path or commit SHA. `status: completed` only when the skill's Done criteria hold.
