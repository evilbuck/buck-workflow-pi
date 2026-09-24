---
status: active
date: 2026-09-23
subject: 2026-09-22.buck-loop-model-config
topics: [buck-loop, model-profiles, jev, buck-models]
research: []
iterations: [iterate-buck-loop-model-config.md, iterate-phase-1-profile-config.md, iterate-phase-1-complexity.md, iterate-phase-5-buck-models-command.md]
memory: [buck-model-config-phasing-2026-09-23.md, buck-model-config-phase-1-save-2026-09-23.md, buck-model-config-phase-2-2026-09-23.md, buck-model-config-phase-2-save-2026-09-24.md, buck-model-config-phase-3-save-2026-09-24.md, buck-model-config-phase-4-save-2026-09-24.md, buck-model-config-phase-5-build-2026-09-24.md]
---

# Plan: Configurable model profiles for Buck workflow

## User Goal

An engineer sets up named model profiles and switches the active one. Each profile maps buck-workflow stage groups to model-id sets and thinking levels, instead of the workflow inheriting one phase-wide `modelRoles` chain.

## Goal

Replace difficulty-collapsed `modelRoles` selection with a named profile the engineer switches as a whole. At each stage, runtime filters the configured ids to models present in the current OMP environment, asks Jev which remaining id to run, and passes that id plus the stage thinking level. `/buck-models` is the setup surface. Missing configuration stops the run. It does not fall through to the host session model.

## Context used / assumptions

- User-provided context: `/b-plan` on `.context/2026-09-22.buck-loop-model-config/`.
- Session context: none beyond that path. Prior decisions were taken from the subject brainstorm and verified against code, not from this chat.
- Artifacts used: `brainstorm-buck-loop-model-config.md`. No `research-*.md`, `spec-*.md`, or `iterate-*.md` in the subject. Intake in that file says the brainstorm stopped 2026-09-24 with no open product questions and that `/b-plan` had not yet been invoked.
- Code checked: `extensions/buck-loop/run-step.ts` (`mappingFromOmpRoles` + `thinkingLevel: "off"`), `extensions/buck-loop/choice.ts` (hardcoded `smol`), `extensions/omp-models.ts` (`DIFFICULTY_TO_ROLE`, `parseModelRoles`), `extensions/index.ts` (`MODEL_SWITCH_COMMANDS` is only `b-build`, `b-build-hard`, `b-iterate`, `b-review`), `extensions/buck-loop/index.ts` (`pi.registerCommand("buck-loop")`), `extensions/typed-output/evaluator.ts` (`createTypeSafeEvaluator`).
- Assumptions:
  - Product decisions in the brainstorm are locked. This plan does not reopen them.
  - `difficulty: hard` still selects the `b-build-hard` prompt variant. It no longer selects a model.
  - `model_hint` and `buck_hint` stay unread. Authoring them is the other subject.
  - Jev is called from the parent extension via `createTypeSafeEvaluator`, not by a child that has extension discovery disabled.
  - A stage key present with an empty model list is "present and empty", not "omitted". Empty after availability filtering stops the run.
  - Omitted thinking level means `off`. OMP still clamps to the selected model's capabilities.
  - Interactive commands and `/buck-loop` share one resolver. `/buck-loop` itself is not a model call. Its children and its closed-set choice are.
  - Light Grill skipped. The brainstorm closed the product questions, and the schema below is an implementation pin, not a new product choice.

## Scope

- Config schema `buckModels` in project `<cwd>/.omp/config.yml` and user-global `~/.omp/agent/config.yml` (honor `OMP_AGENT_DIR` the same way the existing role reader does).
- Resolver: active-profile name, per-stage project-then-global fallthrough, availability filter, hard stop with a named stage.
- Runtime pick for loop work sessions, loop closed-set choice, and interactive Buck commands that map to a stage group.
- Host retry stays first. Jev is asked again only after the nested session ends failed, with the failed id removed.
- `/buck-models` command: create/rename is create-and-name, select active profile, edit each stage group's ids, notes, and thinking level, show fallthrough source, warn on unavailable ids, write either project or user-global file.
- Tests for resolver, selection, refusal, and command writes.
- Docs for the new command and the replacement of the difficulty→role loop path.

### Config shape (pinned)

```yaml
buckModels:
  active: work          # blank or missing → use the user-global active name
  profiles:
    work:
      brainstorm-plan:  # group key, not a skill name
        thinking: medium   # optional; omitted → off
        models:
          - id: provider/model-a
            note: "long-context planner"   # optional
          - id: provider/model-b
```

Group keys, exactly these, each shared by the skills in parentheses:

| Key | Skills |
|---|---|
| `brainstorm-plan` | `b-brainstorm`, `b-plan` |
| `phase` | `b-phase` |
| `build` | `b-build`, `b-build-hard` |
| `review` | `b-review` |
| `iterate` | `b-iterate` |
| `save` | `b-save` |
| `commit` | `b-commit` |
| `docs` | `b-docs`, `b-howto` |
| `choice` | buck-loop closed-set choice only |
| `research` | `b-research`, `b-explore` |
| `grill` | `b-grill`, `b-grill-me`, `b-grill-auto`, `b-grill-with-docs` |
| `present` | `b-present` |

Unknown keys are ignored. A skill with no row does not consult `buckModels`.

### Selection rules (pinned)

1. Resolve the active profile name. Blank project name uses the user-global name. A name in neither file stops and names it. Both blank stops.
2. Resolve the stage. A key present on the project profile wins, including an empty list. A key absent from the project profile uses the same key on the user-global profile. Absent from both stops and names the stage.
3. Drop ids that are not available in the current OMP environment. Do not rewrite the saved profile.
4. Zero ids left: loop blocks; interactive command refuses. Error names the stage and the excluded ids.
5. One or more ids: call TypeSafe Choice. State is stage key, candidate ids and notes, and the skill about to run. Loop and nested stages also include plan or phase path, body, and `difficulty:` when present. Interactive stages also include the current command text, resolved subject artifacts, and the last 8 user/assistant messages, capped at 12,000 characters, oldest trimmed first. System and tool traffic are excluded.
6. Run the id Jev picks, including a low-confidence pick. No confidence threshold.
7. Jev unavailable, error, or no answer: uniform random among the remaining ids. Not the first id. Not the host session model. Not a block.
8. Pass the stage thinking level (`off` if omitted). Do not set temperature.
9. On a failed model call, let host `retry.modelFallback` / `retry.fallbackChains` / role priority finish first. Context overflow is compaction, not this path. If the host recovers, keep the result. If the nested session ends failed after that path — including empty text the host does not classify as retryable — remove the failed id and repeat from step 5. Do not wait for `auto_retry_end`.

## Out of scope

- `.context/2026-09-19.settings-api-model-roles/`: how `modelRoles` is parsed. Do not delete `parseModelRoles` or switch that reader to the Settings API here.
- Temperature, `omp --profile`, and a per-run `--model` flag.
- Rewriting `difficulty`, `model_hint`, or `buck_hint` on phase files.
- Loading `b-save-improved`, `b-commit-improved`, or `code-review-iteration` inside loop children.
- Making `/buck-loop` switch the parent session model. The supervisor is not a model call.
- In-app `/settings` or `omp config set` as the writer. Those cannot write arbitrary project keys today.
- Migrating every non-Buck extension off `modelRoles`.

## Affected files

- `extensions/omp-models.ts` — add profile read/merge/write. Leave `parseModelRoles` / `mappingFromOmpRoles` in place for the settings-api subject; Buck selection must stop calling `mappingFromOmpRoles`.
- `extensions/buck-loop/run-step.ts` — model and thinking come from the resolver, not difficulty tier.
- `extensions/buck-loop/choice.ts` — `choice` stage, not hardcoded `smol`.
- `extensions/buck-loop/loop.ts` — block path uses the named-stage error; `difficultyOf` remains only for the build-hard prompt variant.
- `extensions/index.ts` — interactive Buck commands in the stage table resolve through the profile before the turn and restore after `agent_end`. `MODEL_SWITCH_COMMANDS` grows to that table, minus `choice` (loop-only).
- `extensions/buck-models/` (new) — `/buck-models` command, registered from `extensions/index.ts` the same way `wireBuckLoop` is.
- `extensions/typed-output/evaluator.ts` — call `createTypeSafeEvaluator`; do not spawn a child to use the `jev` tool.
- Tests beside those modules: `extensions/omp-models.test.ts`, `extensions/buck-loop/__tests__/run-step.test.ts`, choice tests, new buck-models tests.
- `docs/buck-workflow.md` — replace the difficulty→role loop description for this path. Do not rewrite the settings-api plan.

## Implementation steps

1. Add a pure profile module: parse `buckModels`, resolve active name, resolve one stage with project-then-global fallthrough, and format the stop errors (missing profile name, missing stage, no available id).
2. Add availability filtering against the current OMP model list. Unavailable ids are excluded only in the resolved set.
3. Add the parent-side picker: build the Jev state from the rules above, call `createTypeSafeEvaluator` with a Choice question, map no-answer to uniform random, and expose "remove failed id and pick again".
4. Cut `run-step.ts` and `choice.ts` over to that picker. Pass `thinkingLevel` from the stage. Keep `difficulty: hard` → `b-build-hard` prompt only.
5. Cut the interactive switch in `extensions/index.ts` over to the same resolver for every stage-table command except `choice`. Restore the previous model and thinking level on `agent_end`. Refuse before the skill runs when resolution stops.
6. Add `/buck-models`: scope picker (project file vs user-global file), profile create/select, per-stage editor for ids, notes, and thinking, fallthrough badge, unavailable-id warning that does not block save. Write YAML without dropping unrelated keys.
7. Update `docs/buck-workflow.md` and the command description so an engineer can find `/buck-models` and the stop conditions.
8. Tests listed under Verification. Do not add a host-default fallback test as a success path.

## Acceptance criteria

- [ ] An engineer can create a named profile, set model ids and an optional thinking level per stage group, and switch the active profile without rewriting the lists, via `/buck-models`, into either `<cwd>/.omp/config.yml` or `~/.omp/agent/config.yml`.
- [ ] A stage set on the project profile is used even when the user-global profile has a different set. A stage omitted from the project profile uses the user-global stage. A stage missing from both stops and names the stage. No host-default model.
- [ ] A blank project `buckModels.active` uses the user-global active name. An unknown name stops and names it.
- [ ] Saving a profile with an id that is not installed succeeds and warns. Runtime excludes that id and does not rewrite the file.
- [ ] Loop work sessions and closed-set choice run the Jev-picked id from the stage set, with the configured thinking level (default `off`). Interactive commands in the stage table do the same on the parent session.
- [ ] Jev no-answer picks uniformly at random from the available ids. A low-confidence pick still runs.
- [ ] A failed nested session re-picks only after host retry finishes, and the failed id is not a candidate.
- [ ] `difficulty: hard` still selects the hard build prompt. It does not select the model.
- [ ] `modelRoles` parsing behavior is unchanged.

## Verification

- Unit: project stage wins; omitted stage falls through; missing stage and missing profile name stop with the name in the message; empty-after-filter stops and lists excluded ids; blank project active name uses global; unknown active name stops.
- Unit: Jev Choice result is the id that runs; no-answer is uniform over the available set (inject the random source); low confidence still runs; second pick excludes the failed id.
- Unit: `runStep` receives `modelPattern` and `thinkingLevel` from the profile, not from `mappingFromOmpRoles`. `choice` no longer calls `resolveOmpRole(..., "smol")`.
- Unit: `/buck-models` write round-trips ids, notes, and thinking, and leaves unrelated YAML keys in the target file.
- Existing `mappingFromOmpRoles` tests still pass. That reader is not the Buck selection path anymore.
- Docs mention `/buck-models`, the twelve group keys, and the stop-not-host-default rule.

## Execution Instructions

Do not build this file as one unit. It crosses config, loop runtime, interactive model switch, a new command, and docs.

This plan looks large enough to benefit from phasing. Run `/skill:b-phase` to break it into sequential OMP-ready execution phases with dependency analysis, per-phase model hints, and resume-safe execution instructions.

After phases exist, use `/b-build-hard` on the resolver and picker phases. The selection and refusal rules are the load-bearing part. UI and docs can use `/b-build` if a phase file says so.

OMP execution: none on this overview file. `b-phase` owns `omp_execution` on the phase files. Do not start `/buck-loop` on this plan until those phase files exist. `listPhases()` is subject-wide, and this folder must not be treated as already phased.

## Risks

- `extensions/omp-models.ts` and `extensions/index.ts` are also in the settings-api-model-roles plan. Keep the `modelRoles` reader intact so the two subjects do not require a simultaneous cutover.
- YAML write must not clobber `modelRoles` or other keys. A hand-rolled rewrite that emits only `buckModels` is a data-loss bug.
- Children run with `disableExtensionDiscovery: true`. A picker that expects the child to call the `jev` tool will no-answer every time and silently randomize.
- Interactive restore on `agent_end` must run on refusal and on throw, or the parent session keeps the stage model.
- Random-on-Jev-failure makes tests flaky unless the random source is injected.
- Subject-wide phase scan: do not drop a completed sibling phase file into this folder during implementation. That false-completes `/buck-loop`.
