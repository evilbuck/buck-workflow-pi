---
status: completed
date: 2026-11-17
updated: 2026-11-17
subject: 2026-11-17.b-loop-repair
topics: [review, iteration, b-loop]
informs: []
addresses: phase-1-entry-and-validation.md
completed: 2026-11-17
from_review: b-review
---

# Iteration: Phase 1 Entry & Validation (`2026-11-17.b-loop-repair`)

## Source
- Reviewed after: `/b-build` on `phase-1-entry-and-validation.md`
- Phase: `phase-1-entry-and-validation.md`

## Critical Issues

### 1. Unescaped `$ARGUMENTS` interpolation in `prompts/b-loop.md`
- **File**: `prompts/b-loop.md`
- **Problem**: Putting `$ARGUMENTS` inside a double-quoted JS string inside a backtick template literal allows `"`, `\`, `\n`, `` ` ``, or `${...}` in slash-command args to break out and execute arbitrary JS inside OMP's Bun `eval` worker.
- **Proposed fix**: Move raw `$ARGUMENTS` outside the executable JS snippet and require JSON-escaped serialization when binding `rawArgs`; add injection-character regression tests in `eval-buck-loop.test.ts`.

### 2. Fail-open bugs in hand-rolled YAML storage config parser & ambiguous origin matching
- **File**: `skills/b-loop/scripts/validation.ts`
- **Problem**: `parseStorageYaml` drops `projects.<name>.storage.adapter` when `connection_env`/`database`/`root` precedes `adapter`, ignores 4-space-indented projects, fails open on flow syntax (`origins: [...]`, `storage: { adapter: postgres }`), and `findMatchingProject` picks the first match rather than rejecting `matches.length > 1`.
- **Proposed fix**: Replace with an indent-tracking YAML subset parser supporting arbitrary valid indentation, any key ordering inside `storage:`, inline `origins: [...]` lists, fail-closed rejection of `{...}` flow mappings and anchors/aliases, and ambiguous-project rejection when `matches.length > 1`.

## Warnings

1. **Git validation ignores `cwd`**: Pass `cwd` as a validated directory via `git -C <cwd>` in `validateNamedBranch` and `tryReadGitOrigin`.
2. **Unguarded `budget` global in `prompts/b-loop.md`**: Use `typeof <name> !== "undefined"` guards so missing host bindings surface cleanly as structured `blocked` verdicts instead of `ReferenceError`.
3. **Frontmatter YAML edge cases (`skills/b-loop/scripts/frontmatter.ts`)**: Strip unquoted `#` comments safely, require `value.length >= 2` in `stripOuterQuotes`, and split inline `[...]` arrays with quote awareness.
4. **Tool error masking & dead `kind` filter**: Throw on `isError: true` in `unwrapToolResult`, fail closed on malformed `workflow_state` rows, and enforce `kind` + `[^/\\]*` checks on plan/phase filtering.
5. **Duplicated runner resolution & path/config guards**: Deduplicate by removing unused `resolveInstalledRunnerPath` export and harden `prompts/b-loop.md` resolver (`statSync(...).isFile()`, scoped `config.yml` sections, fail-closed `BUCK_LOOP_RUNNER`, empty-string env guards) while testing `prompts/b-loop.md`'s resolver directly.
6. **Minor `runSh` blank output fallback & env guards**: Check `rec.output.trim()`, tighten anchor detection, and avoid empty env var strings matching files.

## Recommended Workflow

Execute fixes via `/b-iterate`, re-run verification + isolated `b-review` standards check + `npm run guardrails:check`, and mark `iterate-phase-1-entry-and-validation.md` completed before `/b-save` → `/b-commit`.
