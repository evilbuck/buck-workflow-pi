---
status: active
date: 2026-09-20
subject: 2026-09-20.pr20-b-save-salvage
topics: [pr-20, b-save, buck-loop, cleanup]
research: []
iterations: []
memory: []
---

# Plan: Retain PR #20’s B-Save Engine and Remove B-Kickoff

## User Goal

Keep PR #20’s updated deterministic `b-save` implementation while removing the obsolete `b-kickoff` `/goal set` prompt now replaced by the working `/buck-loop` extension.

## Goal

Prepare the existing clean PR #20 worktree (`../buck-workflow-pi-pr20`, branch `feat/b-kickoff-goal-prompt`, `b038e70`) for a focused follow-up: preserve the `extensions/b-save/` XState engine and its command wiring, remove the obsolete prompt-only autonomous-loop surface, and leave no live repository documentation or backlog contract claiming that `b-kickoff` is available.

## Evidence Base

- PR #20 is open, has requested changes, and is based on `feat/b-kickoff-goal-prompt`. Its diff contains both the `b-kickoff` prompt and a distinct `b-save` replacement.
- The current working branch wires `/buck-loop` in `extensions/index.ts` through `wireBuckLoop(pi)`. Its direct command supports start, status, resume, and stop; this supersedes an instruction-only goal prompt.
- In the PR worktree, `prompts/b-kickoff.md` is the executable prompt surface. `skills/b-loop/SKILL.md`, `.context/backlog/todo.md`, and `.context/backlog/items/b-loop-skill-and-mirror.md` describe it as an available goal objective.
- PR #20’s `extensions/b-save/index.ts` is a 22,616-byte XState-based command implementation; it is separate from the current branch’s 5,420-byte `extensions/b-save-improved/index.ts`. Removing the kickoff prompt must not remove, rename, or otherwise alter the PR’s `b-save` engine, commands, tests, role modules, snapshot/evaluation/apply/effects modules, or registration.

## Scope

- Reuse the existing, clean PR #20 worktree rather than create a duplicate worktree.
- Delete `prompts/b-kickoff.md`.
- Remove its live-surface references from `skills/b-loop/SKILL.md` and active backlog material, replacing them with `/buck-loop` as the executable autonomous-loop surface where needed.
- Preserve the PR’s `extensions/b-save/` implementation and every source, command, test, and support module it requires.
- Preserve historical `.context` plans and memory entries as records of what was previously proposed; do not rewrite history merely to erase old references.

## Out of Scope

- Reimplementing, changing, or reviewing the retained `b-save` engine.
- Rebasing PR #20, resolving its GitHub merge conflict, pushing, closing, or merging the PR.
- Changing `/buck-loop` behavior or adding a new `/goal` launcher.
- Editing unrelated historical artifacts.

## Implementation Steps

1. **Confirm the isolated baseline.** In `../buck-workflow-pi-pr20`, confirm the worktree remains clean and on `feat/b-kickoff-goal-prompt`. Record its starting commit before source edits.
2. **Remove the obsolete prompt surface.** Delete `prompts/b-kickoff.md`. Do not substitute another generic goal prompt; `/buck-loop` is the intended execution surface.
3. **Cut over live references.** Update `skills/b-loop/SKILL.md` to remove the `b-kickoff` “Surfaces” description and any instruction that directs operators to `/goal set ... prompts/b-kickoff.md`. Update active backlog text and the `b-loop-skill-and-mirror` item so they no longer list the deleted prompt as a contract or acceptance criterion. Retain historical `.context` evidence unchanged.
4. **Protect the retained engine.** Review the staged diff to verify that all `extensions/b-save/**` files, its `extensions/index.ts` registration, `commands/b-save.md`, and corresponding tests stay present and semantically untouched by this cleanup.
5. **Verify the cutover.** Run a repository-wide non-historical search confirming no live source/docs/backlog reference to `prompts/b-kickoff.md` or a `b-kickoff` executable surface remains. Run the focused `b-save` command/handler and registration tests from the PR worktree, then resolve and run the repository’s guardrail contract because the branch contains code changes.

## Acceptance Criteria

- `prompts/b-kickoff.md` is absent from the PR worktree.
- No live source, skill, active backlog, or command documentation advertises `b-kickoff` or instructs users to invoke the deleted prompt.
- Historical `.context` records remain untouched.
- The complete PR #20 `b-save` engine remains present and wired; no `extensions/b-save/**`, `commands/b-save.md`, or `extensions/index.ts` `b-save` registration is deleted or weakened.
- Focused `b-save` tests and the resolved guardrail contract pass in the PR worktree.

## Verification

- `git diff --check` in `../buck-workflow-pi-pr20`.
- Search non-historical live paths for `prompts/b-kickoff.md` and `b-kickoff`; expected result: no executable/live-surface matches.
- Inspect the cleanup diff against the PR baseline and confirm it is limited to the prompt and its current-facing references.
- Run the focused `extensions/b-save/**` test suite and command-registration tests using the repository’s existing test runner.
- Run `npm run guardrails:check` (or its resolved equivalent) in the PR worktree after the edit batch.

## Risks

- Removing every textual `b-kickoff` occurrence would corrupt historical planning and memory. Limit edits to live interfaces and active contracts.
- A broad deletion could accidentally remove the independent `b-save` engine introduced by the same PR. Diff-review `extensions/b-save/**`, `commands/b-save.md`, and registration before committing.
- PR #20 is stale and GitHub reports it dirty. This plan deliberately does not rebase; resolve merge drift as separately scoped work after the cleanup is validated.

## Execution Instructions

Implement in `../buck-workflow-pi-pr20` only. Start with the prompt and current-facing references; do not modify the retained `b-save` subsystem.
