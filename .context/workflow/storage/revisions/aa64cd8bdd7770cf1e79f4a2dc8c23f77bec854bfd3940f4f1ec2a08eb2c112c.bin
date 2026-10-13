---
status: active
date: 2026-05-20
subject: 2026-05-20.b-research-b-explore-split
topics: [b-research, b-explore, web-research, crawl4ai, subject-index, skills]
research: []
iterations: []
spec: null
memory: [b-research-b-explore-plan-2026-05-20.md]
---

# Plan: Split code exploration into `b-explore` and repurpose `b-research` for web research

## Goal
Refactor the Buck workflow so codebase exploration lives under `b-explore`, external/web investigation lives under a new `b-research`, and both produce durable, incrementally updated subject artifacts with a consistent subject entrypoint.

## Context used / assumptions
- User-provided context:
  - Current `b-research` is really codebase exploration and should become `b-explore`.
  - A new `b-research` should focus on web research and use tools/skills such as Crawl4AI plus browser/API search tools.
  - Research should be durable and updated incrementally while the agent is still gathering information.
  - Subject folders should gain a stable entrypoint/TOC (`index.md` or similar).
  - A complementary Crawl4AI skill should exist and include setup/bootstrap guidance.
- Session context:
  - This repo already uses the portable skill + thin wrapper model.
  - Plan mode and Buck mode already treat `/b-research` as a planning/research command.
- Code/docs inspected:
  - `skills/b-research/SKILL.md`
  - `skills/b-plan/SKILL.md`
  - `skills/b-brainstorm/SKILL.md`
  - `prompts/b-research.md`
  - `prompts/b-plan.md`
  - `docs/buck-workflow.md`
  - `extensions/index.ts`
  - `.context/2026-05-12.prompt-to-skill-portability/plan-prompt-to-skill-portability.md`
- Assumptions / open questions:
  - Use `index.md` as the standard subject entrypoint; avoid subject-specific filenames unless a later need emerges.
  - Preserve existing root-level `research-*.md` compatibility for final artifacts even if incremental notes move into a subject-local `research/` subdirectory.
  - Treat `b-explore` as an internal-investigation command and `b-research` as an external-investigation command, but allow each to invoke the other’s helper skills when useful.
  - Open question: whether `/b-research` should hard-require web access or degrade gracefully into local-only note-taking when web tooling is unavailable.

## Scope
- Define the command/skill split between `b-explore` and `b-research`.
- Add a complementary `crawl4ai` skill with installation/bootstrap guidance and usage patterns.
- Define durable artifact rules for incremental research capture.
- Introduce a subject-level `index.md` convention and wire the relevant skills/docs around it.
- Update the loose Buck workflow docs/routing so agents know when to use `b-explore` vs `b-research`.
- Keep runtime work minimal: no new orchestration extension, only small edits to the existing Buck extension if command discoverability absolutely requires them.

## Out of scope
- Building a new orchestration extension, supervisor loop, crawler daemon, or autonomous runtime.
- Full implementation of a generic autonomous crawler/orchestrator beyond the Buck workflow surface.
- Reworking unrelated Buck commands (`b-build`, `b-review`, etc.) except where they must read the new artifacts.
- Adding extension-level browser tooling if existing Pi/browser/web-search surfaces are already sufficient.
- Migrating historical subject folders to the new `index.md` or `research/` conventions in the same pass.

## Affected files
- `skills/b-research/SKILL.md` — rewrite around external/web research behavior.
- `skills/b-explore/SKILL.md` — new skill for codebase exploration / architecture tracing.
- `skills/crawl4ai/SKILL.md` — new complementary skill with install/bootstrap guidance.
- `prompts/b-research.md` — retarget wrapper to the new web-research skill behavior.
- `prompts/b-explore.md` — new wrapper for the exploration workflow.
- `skills/b-plan/SKILL.md` — teach planning to look for subject `index.md` and both exploration/research artifacts.
- `skills/b-brainstorm/SKILL.md` — optionally seed or update subject `index.md` when creating a subject.
- `skills/b-present/SKILL.md` and possibly `skills/b-review/SKILL.md` — read `index.md` and preserve artifact discoverability.
- `docs/buck-workflow.md` — rename/reframe the research phase documentation and workflow diagrams.
- `README.md` — update command table and skill inventory.
- `extensions/index.ts` *(optional/minimal)* — only if `/b-explore` needs the same discoverability/plan-mode affordances as other planning commands.

## Proposed architecture
### 1. Command/skill taxonomy
- **`/b-explore` / `skills/b-explore`**: internal codebase discovery, architecture tracing, data-flow mapping, repo-local investigation.
- **`/b-research` / `skills/b-research`**: external/web investigation, source collection, evidence capture, synthesis from online materials.
- **`skills/crawl4ai`**: specialized helper skill for deep website crawling/extraction, install/bootstrap checks, and repeatable crawl recipes.

### 2. Artifact model
- Keep the current **subject folder root** as the canonical home for summary artifacts consumed by other Buck commands:
  - `research-<topic>.md` → final synthesized research summary
  - `plan-<topic>.md`, `spec-*.md`, `tasks.md`, etc.
- Add an optional **subject-local `research/` subdirectory** for rolling notes and source captures during web research:
  - `research/notes-<topic>.md`
  - `research/sources-<topic>.md`
  - optional fetched/raw outputs if Buck decides they are worth keeping
- Add **`index.md`** in the subject root as the stable entrypoint linking all of the above.

### 3. Incremental research behavior
- `b-research` should not wait until the end to persist findings.
- During a long research pass it should:
  1. create/update `index.md`
  2. append/update rolling research notes in `research/`
  3. keep an explicit assessment/conclusion section current as evidence changes
  4. finish by consolidating into the canonical `research-<topic>.md`
- `b-explore` can stay lighter-weight, but should still update `index.md` and persist important internal findings.

### 4. Compatibility strategy
- Existing Buck consumers already look for `research-*.md`; keep that as the canonical summary artifact to avoid a large migration.
- Add `index.md` lookup before broad file scanning so agents have a fast subject entrypoint.
- Update workflow docs/diagrams to show `b-explore` for codebase discovery and `b-research` for web discovery.

## Implementation steps
See `tasks.md` for the persistent checklist.

1. Finalize the naming and compatibility rules:
   - `b-explore` handles repo-local exploration.
   - `b-research` handles external/web research.
   - `research-*.md` remains the canonical summary artifact.
   - `index.md` becomes the standard subject entrypoint.
2. Author `skills/b-explore/SKILL.md` by extracting and tightening the current codebase-investigation behavior from `skills/b-research/SKILL.md`.
3. Rewrite `skills/b-research/SKILL.md` around external research:
   - query refinement
   - source selection
   - iterative note capture
   - conclusion updates
   - final synthesis into `research-<topic>.md`
4. Create `skills/crawl4ai/SKILL.md` with:
   - install/bootstrap detection
   - safe install instructions
   - basic crawl/extract recipes
   - guidance on when `b-research` should invoke it vs lighter tools.
5. Add/update thin wrappers:
   - `prompts/b-explore.md`
   - `prompts/b-research.md`
6. Update Buck workflow consumers so they read the subject entrypoint first when present:
   - `b-plan`
   - `b-brainstorm`
   - `b-present`
   - any other skill/docs surface that currently assumes only root artifact scanning
7. Optionally update the existing Buck extension/runtime references only if discoverability or plan-mode handling for `/b-explore` needs it:
   - `PLAN_MODE_COMMANDS`
   - Buck mode guidance strings
   - intent/routing copy mentioning only `b-research`
8. Update documentation (`README.md`, `docs/buck-workflow.md`) to explain the split, the new `index.md` convention, and the incremental research artifact flow.
9. Verify end-to-end behavior with at least two dry-run scenarios:
   - local architecture exploration via `/b-explore`
   - web research via `/b-research`

## Verification
- `/b-explore` is discoverable and clearly distinct from `/b-research` in README/docs and prompt wrappers.
- `skills/b-explore/SKILL.md` stays read-only outside `.context/` and matches the current exploration intent.
- `skills/b-research/SKILL.md` explicitly captures incremental durable notes plus a final `research-*.md` summary.
- `skills/crawl4ai/SKILL.md` includes dependency/bootstrap guidance that degrades gracefully when the tool is unavailable.
- A new subject created by `b-research` or `b-explore` contains a usable `index.md` entrypoint.
- `b-plan` can resolve context from `index.md` + `research-*.md` without breaking legacy subjects that lack `index.md`.
- Workflow docs and diagrams no longer describe codebase exploration as `b-research`.

## Risks
- **Naming churn**: users may still mentally map `b-research` to internal exploration. Mitigation: keep docs and wrappers explicit; consider short alias/transition guidance.
- **Artifact drift**: rolling notes in `research/` can diverge from the final `research-*.md`. Mitigation: require explicit consolidation rules in the skill.
- **Compatibility breakage**: broadening artifact lookup or renaming commands can break current docs and automation. Mitigation: keep `research-*.md` as the canonical summary and make `index.md` additive.
- **Tooling fragility**: Crawl4AI or browser tooling may not be installed everywhere. Mitigation: ship graceful fallback instructions and prefer capability checks before installs.
- **Scope creep**: adding a new command, new skill, new artifact convention, and doc/runtime updates spans multiple surfaces. Mitigation: phase the work.

## Recommended next step
This plan looks large enough to benefit from phasing. Run `/skill:b-phase` to break it into sequential Ralph-ready phases with dependency analysis, per-phase model hints, and resume-safe execution instructions.

If you want to execute without phasing, use `/b-build-hard` because this change spans multiple skills, wrappers, docs, and extension behavior.