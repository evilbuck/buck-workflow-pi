# Stage map

Two machines. The orchestrator steps the outer machine; each run worker steps the run machine. The ordered tables below are the only routing authority: take the first row whose guard is true. An effect is a subagent dispatch, a script, or a stop. Re-detect after the effect's evidence is verified. No true row is `blocked` — stop and name the missing proof.

Artifacts and retained revisions win over `orchestration.md` and over any start-stage hint. `enter` is detection, not a stage: never dispatch a worker named `enter`.

## Stage target resolution

Every dispatch target names a command, not a skill directory. Resolve before dispatch; never create a synthetic directory for an alias. Preserve stage arguments (`b-grill --mode auto` keeps its mode).

| Target | Procedure | The brief must pass |
|---|---|---|
| `b-build-hard` | `skills/b-build/SKILL.md` | difficulty **hard** |
| `b-commit` | `skills/git-commit/SKILL.md` | the verified slice checkpoint and disposable detached worktree |
| any other `b-<stage>` | `skills/b-<stage>/SKILL.md` | stage arguments |

### Stage brief

Both the orchestrator and run workers use this brief when dispatching a stage subagent. Populate the conditional lines from the resolution table above.

```text
You are the worker for this stage only. Load and follow <procedure file from the resolution table>.
You are already the delegate. Do not dispatch another worker for this same stage.
Subject: <subject folder or "none yet">
Slice: <plan, phase, or task>
Stage arguments: <preserved arguments from the resolution table, or "none">
Difficulty: <standard | hard — b-build only; pass hard for b-build-hard; omit otherwise>
Commit scope: <slice checkpoint and disposable detached worktree — b-commit only; omit otherwise>
Repair scope: <exact review and iterate revisions and the in-plan findings — repair only; omit otherwise>
Decision authority: an approved slice needs no routine reapproval. Return a material
unanswered question to the supervisor with your partial state — do not guess or wait invisibly.
Do only this stage. Stop when its artifact exists. Return artifact paths, verdict, and blockers. Do not start the next stage.
```

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
| detect | blocked | plan open questions remain and ideation returns is 2 or more | stop, name the questions |
| detect | blocked | a plan still has a material open question after the applicable plan-update or research routes | relay user decisions once, or name the missing evidence |
| detect | phase | the plan recommends phasing and no `phase-N-*.md` exists | dispatch `b-phase` |
| detect | grill | the user asked to stress-test, no grill record | dispatch `b-grill --mode auto` |
| detect | present | the user asked to share, no presentation | dispatch `b-present` |
| detect | run | an incomplete run remains: a quick fix, an unfinished unphased plan, or a ready phased plan with unfinished phases | dispatch one run worker |
| detect | backlog | every run committed, out-of-plan findings remain | dispatch `b-backlog` |
| detect | done | every run committed, no out-of-plan findings | stop |
| any stage | detect | stage artifact verified | re-detect |
| run | detect | run returned a commit that is the current tip | re-detect |
| run | blocked | run returned blocked or a question | stop |
| backlog | done | findings recorded, or named in the report | stop |

A run is the first incomplete phase in dependency order, the whole unphased plan, or one quick fix. Do not parallelize runs; they share this worktree. A phase with verified completion under the Completion rule is skipped wherever its checkpoint sits in reachable history.

## Run machine

| from | to | guard | effect | cap |
|---|---|---|---|---|
| enter | returned | verified completion for this exact slice (see Completion) | return | |
| enter | commit | the current slice has a verified promoted commit with pending live-index reconciliation | reconcile from its checkpoint before any other stage | |
| enter | review | implementation or prior review evidence exists, and no review is current | start at `b-review` | |
| enter | review | a current legacy failing review predates the repair-route field | refresh with `b-review` | |
| enter | review | the current failing review has a verified completed repair | start at `b-review` | |
| enter | blocked | a current failing review with in-plan issues has no verified repair route | stop, name the missing or invalid repair evidence | |
| enter | blocked | a current failing review has a verified repair route, no recorded repair for this review, and iterate count is 3 or more | stop, name the spent iterate cap and open issues | |
| enter | buildHard | a current failing review has repair route `b-build-hard`, and the repair is within cap or already recorded for this review | start or resume `b-build-hard` | |
| enter | build | a current failing review has repair route `b-build`, and the repair is within cap or already recorded for this review | start or resume `b-build` | |
| enter | iterate | a current failing review has repair route `b-iterate`, and the repair is within cap or already recorded for this review | start or resume `b-iterate` | |
| enter | iterate | fresh quick fix with no implementation, no review history, and no completion proof | start at `b-iterate` | |
| enter | buildHard | no implementation or review history, and either the initial `buck_hint` is `b-build-hard` or `/b-build-hard`, or the plan calls for hard difficulty | start at `b-build-hard` | |
| enter | build | no implementation or review history | start at `b-build` | |
| enter | docs | current review pass, documentation impact, living docs not updated | start at `b-docs` | |
| enter | howto | current review pass, how-to impact only, docs impact none or handled | start at `b-howto` | |
| enter | guardrails | current review pass, doc gates clear, code touched, not docs-only, guardrails not passed | start at `b-guardrails-check` | |
| enter | save | current review pass, gates clear, no current save evidence | start at `b-save` | |
| enter | closeout | current review pass, final plan-backed run, saved, subject closure pending | run `close-verified` | |
| enter | commit | current review pass, saved, closure verified or not required, not committed | start at `b-commit` | |
| enter | blocked | no true row | stop, name the missing proof | |
| build | review | implementation verified | dispatch `b-review` | |
| buildHard | review | implementation verified | dispatch `b-review` | |
| review | blocked | in-plan issues remain, and either the verified repair route is missing or invalid or the iterate count is 3 or more | stop, name the missing proof or open issues | |
| review | buildHard | in-plan issues, verified repair route `b-build-hard`, iterate count under 3 | dispatch `b-build-hard` | 3 |
| review | build | in-plan issues, verified repair route `b-build`, iterate count under 3 | dispatch `b-build` | 3 |
| review | iterate | in-plan issues, verified repair route `b-iterate`, iterate count under 3 | dispatch `b-iterate` | 3 |
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
| guardrails | blocked | required gate failed and guardrails fix count is 2 or more | stop | |
| guardrails | save | pass, skip, or advisory | dispatch `b-save` | |
| save | closeout | final run and a plan exists | run `close-verified` | |
| save | commit | not the final run, or no plan | prepare, dispatch `b-commit`, then verify, promote, and reconcile | |
| closeout | commit | closure re-inspected and verified with no blockers | prepare, dispatch `b-commit`, then verify, promote, and reconcile | |
| closeout | blocked | `close-verified` returned blockers | stop | |
| commit | returned | the verified commit is the current tip and live-index reconciliation is complete | return | |
| commit | blocked | protected branch, inseparable dirty paths, candidate mismatch, or commit failed | stop | |

The iterate cap counts `review` → `iterate`, `build`, and `buildHard` transitions. The guardrails cap counts `guardrails` → `iterate` transitions. They do not share a counter.

On a pass edge, record out-of-plan findings. They are not a backward edge and do not block the slice. The outer machine backlogs them after the last run.

`b-docs` follows `b-howto` when both apply, so a docs impact does not also take the howto edge.

## Completion, currency, caps

- **Completion (checked before any task label).** Require the slice-specific retained commit checkpoint in [run.md](run.md), completed live-index reconciliation, and a reachable single-parent commit with its exact parent and tree. A phase also needs completed status and verified acceptance. A final unphased plan also needs its completed non-empty acceptance checklist and verified subject closure with no blockers. For a historical phase, check completion evidence at the checkpoint commit and its retained revisions. Later phases may change the same files. For a newly returned commit, require the SHA at the current tip.
- **Review currency.** Use the newest retained review for the exact subject and slice. It is current only when its implementation fingerprint matches the current slice. An iterate artifact routes repairs only through the current failing review's exact artifact reference. A passing review or a changed fingerprint prevents an older active artifact from directing rework. An older failing review without a recorded route must be refreshed by `b-review` before dispatching repair.
- **Caps.** Reconstruct both counts from retained repair dispatches for the exact slice. Count each distinct source review revision once for iterate/build/buildHard, and each distinct guardrails repair dispatch once for the guardrails cap. Record a dispatch before invoking its worker. Resuming the same recorded repair uses its existing slot.

## Guard notes

- **Quick fix.** A small defect in current context, with no plan and no feature scope. Do not invent a plan for it.
- **Phase required.** The plan recommends phasing, or `skills/b-phase/SKILL.md` would phase it. That skill owns the split.
- **Docs-only.** Use the project's docs-only predicate. Do not invent one. Docs-only skips the guardrails gate.
- **Off this path unless the user asked.** `b-blueprint`, user-mode grill, `b-capture`. Grill on this path is `--mode auto`. Do not interview.
- **Ideation returns.** Only plan → explore/research → plan(-update) counts. The cap is 2.
- **Repair route.** Read `recommended_workflow` from the exact iterate revision produced for this review and retained in the review record. The only accepted values are `b-iterate`, `b-build`, and `b-build-hard`. Standalone quick-fix intake and initial build difficulty are separate decisions. Review prose and legacy recommendations do not select repair routes.

## Worked examples

These illustrate the tables; the tables decide. Each names the observed next stage, not a new rule.

1. **Clear feature, familiar code, no prior artifacts.** Intake: formed task, no named missing fact, no plan → the `plan` row. After the plan verifies → `run`. The unphased run builds, reviews, clears gates, saves, closes, commits — no invented research artifact, no approval pause for save or commit.
2. **Two dependent phases; restart after phase 1's clean review.** Phase 1's run re-enters past `review`: the retained pass is current, fingerprint unchanged, so no re-review; downstream effects complete and phase 1 commits as the new tip; the outer machine then starts phase 2. In a separate trial, edit reviewed content without moving `HEAD`: the fingerprint differs, `enter → review` fires, and the old pass cannot advance.
3. **Final unphased plan; restart after save.** Saved with closure pending → the next effect is `close-verified`, not commit. An open criterion blocks plan completion and the commit both. With unrelated work staged, the detached commit and path-scoped reconciliation preserve those entries. A conflicting staged entry at a candidate path blocks promotion.

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
