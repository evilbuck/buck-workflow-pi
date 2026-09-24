# Plan: Configurable models in buck-loop

## User Goal
An engineer sets up named model profiles and switches the active one. Each profile maps buck-workflow stage groups to model-id sets and thinking levels, instead of the workflow inheriting one phase-wide `modelRoles` chain.

## What we might build
- Named profiles the engineer switches between.
- Each profile maps a workflow stage group to a set of `provider/model` ids.
- Each stage group also configures the OMP thinking level used by its selected model.
- Early input examples used `plan|phase`, `build-hard`, and `build`; the settled grouping is recorded under Decisions so far.

## Why it matters
- Today every work skill in a phase shares one model, chosen by a binary `difficulty:` collapse.
- The choice call is hardcoded to `smol`.
- Phase files already carry `easy|medium|hard`, `model_hint`, and `buck_hint`. The loop ignores two of those and collapses the third.
- There is no `/buck-loop` flag, per-skill role, thinking level, or temperature knob.

## Constraints / preferences
- Not decided. Adjacent work that must not be silently folded in:
  - `.context/2026-09-19.settings-api-model-roles/` is active and about **how roles are read** (hand-rolled YAML → omp Settings API). It does not change which role each loop step uses. In-app role writing is explicitly out of scope there.
  - `.context/2026-05-02.b-phase-model-hints/` is the authoring side (`difficulty`, `model_hint`, `buck_hint`). This subject is the runtime side.
- Nested work sessions set `disableExtensionDiscovery: true` and do not include the `task` tool. Extension model paths do not run inside a loop child unless we later decide they should.

## Setup UI
Required. Profile setup is not a hand-edited YAML-only path.

The engineer can:
- Create and name a profile.
- Select the active profile without rewriting its model lists.
- Edit the model-id set and thinking level for each stage group: `[brainstorm, plan]`, `[phase]`, `[build, build-hard]`, `[review]`, `[iterate]`, `[save]`, `[commit]`, `[docs, howto]`, `[choice]`, `[research]`, `[grill]`, `[present]`.
- See, per stage, whether the entry came from the project profile or fell through from user-global.
- See warnings for model ids unavailable in the current OMP environment without being prevented from saving a portable profile.

Writes:
- Project: `<cwd>/.omp/config.yml`
- User-global: `~/.omp/agent/config.yml`

Current OMP constraint: `/settings` and `omp config set` write the global file. They do not write arbitrary project keys. The only project write today is `modelRoles` when `modelRoleStorage: project`. A project-profile UI needs its own write path. Hand-editing the YAML still works, and is not the setup path.

Surface: `/buck-models`, a dedicated command rather than `/settings`. It can write either the project file or the user-global file. The engineer picks the write scope inside it.
- Each model id has an optional note. An empty note means Jev sees the id alone. A missing note does not block save.

## Open questions
- None currently identified.

## Intake status
Stopped by the user on 2026-09-24. The brainstorm remains a draft; `/b-plan` was not invoked.

## Decisions so far
- A profile drives the whole buck-workflow, not only `/buck-loop` calls. Interactive commands consult the active profile too.
- Profiles live in the project `.omp` config, then `~/.omp/agent`. Not `omp --profile`. An active-profile name selects one profile. Switching changes that name, not the lists.
- Per-stage fallthrough: a stage present in the project profile wins. A stage the project profile omits uses the same stage from the user-global profile. A stage missing from both stops the run and names the stage. The loop blocks. An interactive command refuses. No host-default model.
- A blank project active-profile name uses the user-global active profile. A name that exists in neither place stops the run and names it. If the global name is also blank, that is the same stop. Interactive commands use this same resolver.
- Setup UI is `/buck-models`, not the `/settings` panel. It creates and names profiles, selects the active profile, edits each stage group's model-id set and thinking level, shows per-stage fallthrough, and warns about currently unavailable models. It writes `<cwd>/.omp/config.yml` or `~/.omp/agent/config.yml`, chosen in the UI. Hand-editing YAML is not the setup path.
- Each model id may have an optional note so Jev can tell candidates apart. If the note is empty, Jev sees the id alone. Saving a profile does not require notes.
- An unavailable model does not make a profile unsavable. This keeps project profiles portable across machines and provider setups.

- Audience: an engineer configuring the workflow, not a per-run model flag for one loop.
- Unit of configuration: a named profile, switched as a whole.
- A profile maps a workflow stage to a set of model ids. Not an OMP role name (`smol` / `slow` / `default`).
- Stage groups, by model need: `[brainstorm, plan]`, `[phase]`, `[build, build-hard]`, `[review]`, `[iterate]`, `[save]`, `[commit]`, `[docs, howto]`, `[choice]`, `[research]`, `[grill]`, `[present]`. A group shares one model set. `build` and `build-hard` stay one set. `research`, `grill`, and `present` are separate keys.
- Each stage group may carry one OMP thinking level: `off`, `minimal`, `low`, `medium`, `high`, or `xhigh`. If omitted, runtime uses `off`, preserving current buck-loop behavior.
- Runtime passes that level to OMP, which clamps it to the selected model's capabilities. Temperature is not configurable in this version.
- Selection is not a fallback chain and not a hand-reordered ranking. Runtime first resolves the stage's configured ids against the current OMP environment and excludes unavailable candidates without mutating the saved profile.
- If no available candidate remains, the loop blocks and an interactive command refuses; the error names the stage and excluded ids.
- Ask Jev which id from the remaining stage set to run, given the context. Run the model Jev picks.
- Jev question type is Choice: one option from the set, plus a probability per option and a confidence on the pick. Code owns the call. Jev does not generate the prompt or run the skill.
- Jev state always includes the stage key, available candidate ids and notes, and the skill about to run. Loop/nested stages add the plan or phase path, body, and `difficulty:` when present. Interactive stages add the current command/user request, any resolved subject artifacts, and a bounded conversation tail: the last 8 user/assistant messages, at most 12,000 characters, oldest content trimmed first. System and tool traffic are excluded. This covers stages such as `/b-brainstorm` before a plan exists. Not labels only. Not an engineer-defined template.
- If Jev itself cannot pick (service unavailable, error, or no answer): choose uniformly at random from the available stage set. Not the first id. Not the host session model. Not a block.
- A low-confidence pick is still a pick. Run it. No confidence threshold. Random is only when Jev returns no answer.
- A failed model call does not immediately re-ask Jev. The host's built-in retry runs first: `retry.modelFallback` (default on), `retry.fallbackChains`, and a role's built-in priority list when its chain is unset. Context overflow is compaction, not this path.
- If that host path recovers the turn, keep the result. Do not also ask Jev.
- If the host does not recover, ask Jev again. Remove the failed id from the set. Then the existing rules apply: run Jev's pick; if Jev cannot pick, random from what remains.
- "Host did not recover" means the nested session ended failed after the host retry path finished. That includes empty text the host does not classify as retryable. Do not wait for a specific `auto_retry_end` event, and do not limit reselection to retry-classified errors.

## Brainstorm notes

Inventory of model choices and specifications during one `/buck-loop` run. Grounded in current code, 2026-09-22. Not a design.

### Calls that actually hit a model

The supervisor is not a model call. `/buck-loop` is not in `MODEL_SWITCH_COMMANDS`, so the parent session model is not switched. Two call sites only.

#### 1. Closed-set choice — `extensions/buck-loop/choice.ts`

Fires only when the machine returns `effect.kind === "choose"`.

| Occasion | Legal set |
|---|---|
| Postcondition scan ambiguous on building, iterating, documenting, saving, or committing | `retry`, `advance`, `block` |
| Review report unparseable and no iterate/docs artifact disambiguates | `iterate`, `document`, `save`, `block` |

Specification, all hardcoded:

- Model: `resolveOmpRole(cwd, "smol") ?? resolveOmpRole(cwd, "default")`.
- `resolveOmpRole` already returns `roles.default` when the named role is missing. The `??` second call is dead: if the first returns undefined, default is also missing and the second returns undefined too.
- Effective rule: `smol` if set, else `default` if set, else omit `modelOverride`.
- Omitted override means `runOmpModelSession` sets no `modelPattern`. The child uses the host session default.
- Thinking: not passed. Helper default is `"off"`.
- Temperature: not set.
- Tools: empty. Timeout: 60s. Two attempts, then block.
- No per-call override. No CLI flag.

#### 2. Nested work session — `extensions/buck-loop/run-step.ts`

One child coding session per skill effect. Skills: `b-build`, `b-build-hard`, `b-review`, `b-iterate`, `b-docs`, `b-howto`, `b-save`, `b-commit`.

Model selection:

1. Read `difficulty:` from the phase file, else the plan file (`loop.ts` `difficultyOf` / `readDifficulty`). Regex `^difficulty:\s*(.+)$`. Missing file or missing key → not-hard.
2. `parsePhaseDifficulty`: only exact `hard` (trim, lower-case) is hard. `easy`, `medium`, typos, and empty all become `not-hard`.
3. `phaseDifficultyToTier`: hard → tier `hard`; not-hard → tier `medium`.
4. `mappingFromOmpRoles(cwd)[tier]` becomes `modelPattern`.
5. If the mapping is null, `modelPattern` is omitted and the child uses the host session default.

The loop never passes tier `easy`, even though `runStep` accepts it and tests cover `easy → smol`.

Role chains in `DIFFICULTY_TO_ROLE` (`extensions/omp-models.ts`). First hit, then `default`:

| Tier | Role order | Used by the loop? |
|---|---|---|
| easy | `smol`, `tiny`, `task`, else `default` | No |
| medium | `slow`, `task`, `default` | Yes — every non-hard phase, and missing difficulty |
| hard | `default`, `plan`, `slow` | Yes — only when frontmatter is exactly `hard` |

Other work-session specs, also hardcoded and shared by every skill:

- `thinkingLevel: "off"`.
- No temperature.
- `disableExtensionDiscovery: true`, MCP off, LSP off, in-memory session.
- Tool allowlist differs by skill. Model does not.
- `b-build-hard` is the same skill file as `b-build` plus the line "This is the hard variant of b-build." Same tools. Same model as `b-build` on a hard phase. The loop picks it only when `difficulty` is hard. It does not read `buck_hint`.

So a phase has one model. Build, review, iterate, docs, howto, save, and commit all get it.

### Parent session — specified by absence

`MODEL_SWITCH_COMMANDS` is `b-build`, `b-build-hard`, `b-iterate`, `b-review` (`extensions/index.ts`). `/buck-loop` is not in that set.

Interactive buck-mode auto-switch is a parallel path, not a loop path. On those four slash commands it reads the same phase difficulty, calls `pi.setModel` on the parent, and restores on `agent_end`. It does not run inside loop children, because extension discovery is off.

The supervisor failure record (`kind: "supervisor"`) has no model field.

### Specifications written on the plan that the loop ignores

`b-phase` writes these on every phase file. Runtime behavior:

| Field | Written as | Loop behavior |
|---|---|---|
| `difficulty` | `easy` \| `medium` \| `hard` | Only `hard` vs everything else. `easy` and `medium` both become the medium tier. |
| `model_hint` | prose | Never read. |
| `buck_hint` | `/b-build` \| `/b-build-hard` | Never read. Hard prompt variant comes only from `difficulty: hard`. |
| `omp_execution`, `omp_goal_budget` | execution recommendation | Not model selection. Not consumed by the loop. |

`skills/b-build/SKILL.md` tells the child to surface the model hint and warn if a hard phase is running in standard mode. Inside the loop the child cannot switch models. Extensions are disabled, and the tool list has no `task`.

### Model systems that look related but do not run in the loop

Because children disable extension discovery:

- `b-save-improved`: scribe = `default`, auditor = `smol`, `--model` pin, smol fallback on empty scribe. The loop loads `skills/b-save/SKILL.md` and does the save itself.
- `b-commit-improved`: commit-message model. The loop loads `skills/git-commit/SKILL.md`.
- `code-review-iteration`: reviewer/fixer catalog, thinking, temperature, `modelRoles.reviewer`. The loop loads `skills/b-review/SKILL.md`.
- `jev` tool: not called by `choose()`.
- `b-pr-improved`: not a loop skill.

`bash` is on most allowlists, so a child could shell out. That is not a specified model path. `b-review`, `b-save`, `b-iterate`, `b-howto`, and `git-commit` skill text do not name a model or a subagent.

### Config surface today

- Source: project `.omp/config.yml` `modelRoles`, else `~/.omp/agent/config.yml` (or `OMP_AGENT_DIR`). First file that contains any roles wins. No merge.
- Reader: hand-rolled line parser `parseModelRoles`. Not the omp Settings API. That swap is the other active subject.
- buck-loop does not read `.pi/settings.json` `buckModelMapping`. Interactive buck-mode still has that fallback.
- `/buck-loop` flags are only `--resume`, `--status`, `--stop`. No `--model`.

### Opportunities (inventory, not decisions)

1. Choice role. Hardcoded `smol`, then `default`, then host default.
2. Work-session tier map. `easy` unused. Anything but `hard` is medium. Hard resolves `default`, then `plan`, then `slow`.
3. Per-skill model. Review, build, save, commit, and choice cannot differ.
4. Per-phase model. Honor three-way `difficulty`, `model_hint`, or an explicit model id.
5. `buck_hint` vs difficulty-derived `b-build-hard`. Prompt variant, not a model change. Easy to confuse with one.
6. Thinking level. Hardcoded off on every work session and on the choice helper default.
7. Temperature. Unset on both call sites.
8. Missing-role fallback. Silent host default. No warning from the loop itself.
9. Parent session model. Unchanged for `/buck-loop`. Probably irrelevant unless the operator expects the interactive auto-switch.
10. Whether the loop should call the extension model paths (`b-save-improved`, code-review) instead of the skill markdown. It does not today.
11. One-run CLI override.
12. Project vs global precedence. First file with any roles wins, so a project file that sets only `default` hides a global `smol`/`slow`.
