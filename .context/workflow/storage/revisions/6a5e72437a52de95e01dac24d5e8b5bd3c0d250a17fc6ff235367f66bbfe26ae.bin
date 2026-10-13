---
status: active
date: 2026-08-27
subject: 2026-08-27.b-pr-improved-existing-pr
topics: [b-pr-improved, github, pull-request, idempotency]
research: []
iterations: []
spec: null
memory: []
---

# Plan: Make `/b-pr-improved` Reuse an Existing Open PR

## User Goal

A developer can rerun `/b-pr-improved` on a subject branch that already has an open pull request and receive that PR's URL as a successful, idempotent result instead of a `gh pr create` warning.

## Goal

Before pushing, synthesizing a description, or invoking `gh pr create`, query GitHub for an open pull request whose head is the resolved subject branch and whose base is the resolved target branch. If one exists, stop successfully and surface its URL. If the lookup cannot be completed reliably, fail closed with a clear warning rather than attempting a duplicate create.

## Capability Probe

- State: `full`
- Probe source: system available-skills catalog
- Sentinels resolved: `b-build`, `b-review`, `b-save`

## Context Used / Assumptions

- `extensions/b-pr-improved/index.ts:302-333` already gets `current_branch` and `chosen_base` from deterministic preflight, then performs push, model synthesis, and `gh pr create` in that order.
- The observed duplicate-PR failure occurs only at the final create step, after avoidable push and model work.
- `skills/b-pr/scripts/pr-preflight.ts` emits both `current_branch` and `chosen_base`; no additional Git inference is needed.
- The existing `skills/b-pr` fallback does not check for an existing PR. This plan is intentionally limited to `extensions/b-pr-improved/`, matching the request.
- “Already open” means `state=open` for the exact head/base pair in the current GitHub repository. Closed or merged PRs do not block creation of a new PR.
- Lookup errors, non-JSON output, or GitHub authentication/network failures must not be interpreted as “no PR”; proceeding would reintroduce the duplicate-create race and mask the real lookup failure.

## Scope

### In scope

- Add a deterministic existing-PR lookup using `gh pr list` with exact head, base, and open-state filters.
- Run the lookup after successful preflight and the existing dry-run early return, but before push and description synthesis.
- Treat an existing PR as successful completion and display its canonical URL.
- Stop with a clear warning when the lookup command fails or its response cannot be parsed safely.
- Add regression coverage proving the command does not push, synthesize, or invoke `gh pr create` when an open PR already exists.

### Out of scope

- Updating, retargeting, reopening, or editing an existing PR.
- Treating closed or merged PRs as reusable.
- Changing base-branch resolution, rebase behavior, force-push rules, title generation, or PR body synthesis.
- Adding the same guard to `skills/b-pr/SKILL.md` or `skills/b-pr/scripts/pr-preflight.ts`.
- Eliminating the unavoidable server-side race between the lookup and a later `gh pr create`; the existing create-error path remains the final concurrency safeguard.

## Affected Files

| File | Planned change |
|---|---|
| `extensions/b-pr-improved/index.ts` | Add the open-PR query/parser and early-success branch before push/synthesis/create. |
| `extensions/b-pr-improved/__tests__/wire.test.ts` | Add command-level regression fixtures for existing, absent, and failed lookups. |

No living documentation change is expected: this is an idempotency correction to existing command behavior, not a new architecture decision or user-facing invocation contract.

## Implementation Steps

1. **Add a narrow existing-PR query helper.**
   - Invoke `execFileCaptured("gh", ["pr", "list", "--head", head, "--base", base, "--state", "open", "--json", "url", "--limit", "1"], cwd)`.
   - Parse stdout as an array of objects containing `url`.
   - Return the URL when the first valid non-empty URL exists; return `null` only for a successful, valid empty array.
   - Throw or return a typed failure for a non-zero exit, malformed JSON, or malformed result shape so callers cannot confuse lookup failure with absence.

2. **Short-circuit the command before side effects and model work.**
   - Keep the current `--dry-run` behavior unchanged; it does not create a PR and should not require GitHub lookup.
   - Immediately after the dry-run return, show a progress step for checking existing PRs and call the helper with preflight’s `head` and `base`.
   - If a URL is returned, call `progress.done` with a neutral success message such as `PR already open: <url>` and return.
   - If lookup fails, notify at warning level with the underlying `gh`/parse detail and return without push, synthesis, or create.
   - If no PR exists, preserve the current push → synthesize → `gh pr create` flow unchanged.

3. **Add command-level regression coverage.**
   - Extend the temporary repository fixture with a bare `origin`, a pushed feature branch, and an explicit `--base main` so preflight reaches the GitHub lookup deterministically.
   - Put a temporary executable `gh` shim first on `PATH`; have it record arguments and return controlled JSON for `pr list` without contacting GitHub.
   - Existing-PR case: return `[{"url":"https://github.com/example/repo/pull/10"}]`; assert the handler reports that URL and the shim records no `pr create` call. Also assert the remote feature tip is unchanged, proving the early return occurred before push.
   - No-existing-PR case: return `[]` for `pr list`, then allow/assert the existing create path reaches `gh pr create` using the resolved base. Stub model invocation only if needed to keep this test deterministic.
   - Lookup-failure and malformed-output cases: assert a warning and no `pr create` call. These cases enforce fail-closed behavior.

4. **Run targeted and contract verification.**
   - Run the `b-pr-improved` Vitest file directly.
   - Smoke the real command against the current branch, which already has PR #10, and observe a successful existing-PR URL without a duplicate-create warning. This smoke test is read-only at the GitHub PR layer; the early return must occur before push.
   - Run the repository guardrails contract because implementation changes touch TypeScript.

## Acceptance Criteria

- Rerunning `/b-pr-improved` for an exact head/base pair with an open PR reports the existing PR URL as success.
- The existing-PR path does not call `git push`, the model session, or `gh pr create`.
- A successful lookup returning no open PR preserves current creation behavior.
- Closed or merged PRs are ignored because the lookup filters `--state open`.
- Lookup command failure, invalid JSON, or invalid response shape stops with a warning and does not attempt creation.
- `--dry-run` remains local to preflight reporting and does not perform the new GitHub lookup.
- The regression suite verifies exact `gh pr list` filters: current head, chosen base, open state, URL-only JSON, and one-result limit.

## Verification

1. Targeted tests:
   - `npx vitest run extensions/b-pr-improved/__tests__/wire.test.ts`
2. Behavioral smoke:
   - Run `/b-pr-improved --base master` on `feat/deterministic-bsave` while PR #10 is open.
   - Expected: successful `PR already open: https://github.com/evilbuck/buck-workflow-pi/pull/10`; no `gh pr create failed` warning.
3. Deterministic project contract:
   - Run `/b-guardrails-check` and require `status: pass` before completion.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `gh pr list` fails due to auth/network state. | Fail closed and surface the command detail; never treat failure as an empty result. |
| Head branch names collide across forks. | Scope the lookup to the current repository and exact base; retain command-level tests for the generated filters. If fork-head ambiguity appears in practice, qualify head with owner in a separate fix using repository metadata. |
| A PR is opened after lookup but before create. | Preserve the existing `gh pr create` error handling as the final race safeguard; this plan removes ordinary rerun errors, not distributed races. |
| Regression test accidentally contacts GitHub or depends on developer auth. | Use a temporary `gh` executable and isolated bare remote; do not use ambient GitHub configuration. |
| Early return happens after push/model work. | Place and test the lookup directly after the dry-run branch, before line 311’s push block. |

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact for in-plan issues, run `/b-iterate`, then re-run `/b-review`. Route out-of-plan findings to a separate plan. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory and artifacts.
5. Run `/b-commit` to checkpoint durable state.
6. If interrupted, record the active plan in session memory and resume from it.

OMP execution recommendation: none. This is a bounded, non-phased, low-risk change suitable for one build/review cycle.

## Recommended Next Step

Run `/b-build .context/2026-08-27.b-pr-improved-existing-pr/plan-existing-pr-check.md`.
