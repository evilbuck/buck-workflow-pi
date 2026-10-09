---
status: active
date: 2026-10-06
subject: 2026-10-06.worktrees-active-recap
topics: [worktrees, extension, git, recap]
research: []
iterations: []
memory: []
---

# Plan: `/worktrees-active-recap`

## User Goal

An operator with several git worktrees can run `/worktrees-active-recap` and see which checkouts are not merged into the base branch, what those branches already committed, and what is still dirty, without spending a model turn.

Synthesized from the request. Correct it before `/b-build` if the beneficiary or the change is wrong.

## Goal

Add a read-only extension command that repeats the session's worktree recap in deterministic git plumbing: unmerged linked checkouts, optional activity window defaulting to 4 days, and a fixed text description of committed work versus dirty work.

## Context used / assumptions

- User-provided context: create an extension, call it `/worktrees-active-recap`, list active worktrees that have not been merged, optional timeframe defaulting to 4 days, describe what each worktree is working on and what is done, prefer deterministic code for speed and tokens.
- Session context: the manual recap used `git worktree list`, `git merge-base --is-ancestor`, `git rev-list --left-right --count`, `git log master..HEAD`, `git diff --stat`, and `git status --porcelain`. The prose synopsis was the only model step. One listed worktree (`/tmp/buck-loop-commit-phase-identity`) was prunable and the directory was gone.
- Code: slash commands that must not call a model are `pi.registerCommand` handlers that `ctx.ui.notify` a preformatted string (`extensions/token-attribution/index.ts`). `extensions/subprocess.ts` already wraps `execFile` without a shell. `skills/git-clean-orphans/SKILL.md` treats `git merge-base --is-ancestor` as the merged check. `package.json` loads only `extensions/index.ts`. Prompt files become slash commands on both Pi and OMP, so a prompt with this name would collide with the extension and spend a turn.
- SQL recall against `git@github.com:evilbuck/buck-workflow-pi.git` returned no worktree-recap decision. Injected memory that still applies: branch merge status does not mean the worktree is clean, and a missing checkout can remain in `git worktree list` as prunable.
- Subject: fresh folder. The session pointer `2026-10-03.buck-loop-iterate-closeout` is a different active subject and was not reused.
- Assumptions / open questions: none that block build. The 96-hour default is overridable; see A-1.

## Decision Closure

Selected course: an extension-only command. No prompt, no skill, no model, no `gh`, no `git fetch`, no git writes. History and merge checks use commit SHAs from the current repo. Dirtiness uses `git status` only when the checkout path exists. Delivery is `ctx.ui.notify`, matching `/tokens`.

Evidence: the user asked for an extension and for deterministic programming; the session recap's useful facts all came from git; `/tokens` is the existing read-only report pattern; a same-named prompt would register a second slash command and burn tokens.

Excluded scope: LLM synopsis, remote freshness, cleanup, merged-but-dirty listings, PR titles, patch-id equivalence, JSON output, and a skill fallback.

Next action: `/b-build` against this plan.

## Assumptions Ledger

- A-1: "4 days" means 96 hours before the command's injected clock, not calendar dates. Status: deferred. Blocking: false. Validation path: the default is a named constant and `--days <n>` / `--all` override it; the operator can reject the default before relying on it, and the unit test pins 96 hours so a later change is visible.

## Material Risks

- failure_mode: the report is mistaken for a cleanup list and a merged-but-dirty checkout is omitted.
- impact: uncommitted work in a worktree whose HEAD is already an ancestor of the base is invisible to this command.
- mitigation: the report header states that it lists unmerged HEAD commits only, not dirty checkouts on the base. Out of scope keeps cleanup in `git-clean-orphans`.
- rollback_or_fallback: the command never writes git state. Recovery is `git status` in the omitted checkout, or revert of the implementation commit.
- validation_path: collector tests assert every git argv is a read (`worktree`, `rev-parse`, `symbolic-ref`, `merge-base`, `rev-list`, `log`, `status`) and that an ancestor HEAD is absent even when the injected status is dirty.

- failure_mode: `ctx.ui.notify` truncates a long report.
- impact: later worktrees disappear from the visible recap.
- mitigation: cap each worktree at 8 commit subjects and 8 dirty paths, and put a single `… N more` line instead of dumping the rest. Do not cap the number of matching worktrees.
- rollback_or_fallback: revert the formatter commit; the collector result is unchanged.
- validation_path: a formatter fixture with 9 commits and 9 dirty paths renders 8 of each plus the overflow line, and no second section repeats the overflow.

## Scope

Register `/worktrees-active-recap` from `extensions/index.ts`.

Resolve the base once, without fetching:

1. `git symbolic-ref --quiet refs/remotes/origin/HEAD`, then resolve that remote ref to a SHA.
2. Else `master` if it resolves.
3. Else `main` if it resolves.
4. Else fail the command with the resolution error.
5. `--base <ref>` replaces that search and is resolved to a SHA before any worktree is classified. An unresolvable `--base` fails the command.

A worktree is in the active list only when all of these hold:

- `git worktree list --porcelain -z` returned it.
- Its `HEAD` SHA is not an ancestor of the base SHA (`git merge-base --is-ancestor` exit 1). Exit 0 excludes it, including the primary checkout when that checkout is the base. Any other exit is an error row, not a silent exclude.
- Its checkout directory exists.
- Its activity is inside the window. Activity is the command clock when `git status --porcelain=v1 -z` is non-empty. Otherwise activity is `git log -1 --format=%ct <HEAD>`. Default window is 96 hours. `--days <positive integer>` replaces it. `--all` disables it. `--days 0`, a negative day count, a missing value, and an unknown flag fail closed before git inventory.

Each active row contains:

- checkout path, branch name or `(detached)`, and short HEAD
- ahead/behind from `git rev-list --left-right --count <base>...<head>` (left is behind, right is ahead)
- **Done:** up to 8 `%s` subjects from `git log -n 9 --format=%s <base>..<head>`. A ninth subject becomes `… N more`, where N is `git rev-list --count <base>..<head>` minus 8. Zero subjects render `nothing committed beyond base`.
- **Working on:** status-letter counts plus up to 8 paths. Clean renders `clean`. A ninth path becomes `… N more`.

A listed worktree whose directory is missing, including `prunable`, goes to a separate **Unreachable** section. It is not active. If its HEAD object exists, show the same Done line and say the checkout path is missing. Do not run `git status` on a missing path. A missing path does not fail the rest of the report.

One worktree's git failure becomes an error line on that row. Inventory failure or base-resolution failure fails the whole command.

## Out of scope

- Deleting, pruning, or stashing worktrees.
- Listing a checkout whose HEAD is already merged, even if it is dirty.
- `git fetch`, `gh`, patch-id equivalence, and commit bodies or diffs.
- A prompt, skill, command symlink, or model/Jev call.
- Adding this command to Buck model-stage routing.
- JSON output.

## Affected files

- `extensions/worktrees-active-recap/args.ts` — flag parser
- `extensions/worktrees-active-recap/collect.ts` — git inventory and classification
- `extensions/worktrees-active-recap/format.ts` — text report
- `extensions/worktrees-active-recap/index.ts` — `wire()` and `registerCommand`
- `extensions/worktrees-active-recap/__tests__/args.test.ts`
- `extensions/worktrees-active-recap/__tests__/collect.test.ts`
- `extensions/worktrees-active-recap/__tests__/format.test.ts`
- `extensions/worktrees-active-recap/__tests__/wire.test.ts`
- `extensions/index.ts` — call `wire`
- `docs/extension-loading.md` — inventory bullet
- `docs/buck-workflow.md` — extension-command table rows that already enumerate `/tokens`'s siblings
- `docs/howto/recap-active-worktrees.md` — new how-to
- `docs/howto/README.md` — index link

Do not add `prompts/worktrees-active-recap.md` or a `commands/` symlink.

## Implementation steps

1. Parse args in a pure function. Defaults: `{ days: 4, all: false, base: null }`. Accept `--days <n>`, `--days=<n>`, `--all`, and `--base <ref>` / `--base=<ref>`. Reject every other token, including `--days 0`.
2. Add a collector that takes an injected `execFile` and `now`. Parse `git worktree list --porcelain -z`. Resolve the base SHA with the order above. Classify each record. Run independent per-worktree reads with a bounded `Promise.all` (8). Use `execFileCaptured` from `extensions/subprocess.ts` in the production runner; tests pass a fake runner and must not invoke real git.
3. Format the two sections exactly as **Active** and **Unreachable**. Header names the base ref, short base SHA, and either `window <n>d` or `window all`. Empty active section: `No unmerged worktrees in the last <n> days.` or `No unmerged worktrees.` when `--all`.
4. `wire(pi)` registers `worktrees-active-recap` with description `List unmerged worktrees and what each has committed or left dirty`. Handler parses args, collects from `ctx.cwd`, and `ctx.ui.notify`s the report at `info`, or the error at `error`. If `pi.getCommands()` already contains the name, notify the collision and do not register a synonym.
5. Call that `wire` from `extensions/index.ts`. Do not import judge, completion, or the interactive model switch map.
6. Cover the acceptance cases with injected fixtures, including: ancestor excluded even when dirty; clean HEAD older than 96 hours excluded; dirty HEAD older than 96 hours included; `--all` includes the old clean row; `--days 1` drops a 2-day-old clean row; missing path is Unreachable and the other row still renders; detached HEAD; ninth commit and ninth path overflow; unknown flag and bad `--days` never call git; one status failure stays on that row; base resolution order and `--base` failure.
7. Add the extension inventory bullet, the buck-workflow command-table row, and `docs/howto/recap-active-worktrees.md` in the existing how-to shape: numbered steps, then **Eat**. Link it from `docs/howto/README.md`. State that the report uses local refs, that a merged dirty checkout is omitted, and that the slash command appears only after the extension reloads.

## Acceptance criteria

- [ ] `/worktrees-active-recap` is registered only by the extension. No prompt, skill, or `commands/` entry exists for that name.
- [ ] Default window is 96 hours. `--days <positive integer>` and `--all` change it. Invalid flags fail before inventory.
- [ ] Unmerged means the worktree HEAD is not an ancestor of the resolved base SHA.
- [ ] Each active row shows path, branch or detached, ahead/behind, up to 8 commit subjects, and a dirty-or-clean working summary capped at 8 paths.
- [ ] A dirty checkout stays in the window even when its HEAD is older than the window. A clean checkout outside the window is omitted unless `--all`.
- [ ] A missing checkout path is Unreachable, not a command failure, and does not get a status scan.
- [ ] The primary checkout is omitted when its HEAD is an ancestor of the base.
- [ ] The handler performs no model, Jev, fetch, or git write.
- [ ] Docs name the command, the default window, and the reload requirement.

## Verification

- `bun x vitest run extensions/worktrees-active-recap`
- Collector tests fail if any injected argv is not in the read allowlist.
- After the unit tests pass, run the collector once against this repo through a throwaway script and confirm it omits `master` and includes the current unmerged worktrees from `git worktree list`. Delete the script before commit.
- `npm run guardrails:check` at the coherent point after the edit batch. A required-gate failure blocks completion.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:

1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a separate `/b-plan` → `/b-build` follow-up. If review flags documentation impact beyond the how-to already in this plan, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`.
6. If interrupted, resume from this plan.

## Risks

- Local `origin/HEAD` can be stale. The header prints the resolved ref so the operator can pass `--base` or fetch before re-running. The command itself does not fetch.
- `git status` on a large checkout is the slow part. That cost is still cheaper than a model synopsis, and it is required to keep a dirty old HEAD inside the default window.
- The slash command is absent until Pi/OMP reloads the extension. The how-to says so.
