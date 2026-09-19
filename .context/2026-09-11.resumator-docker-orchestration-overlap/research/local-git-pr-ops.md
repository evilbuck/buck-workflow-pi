---
cluster: GIT, PR & OPS/PLATFORM
skills_covered: 12
---

## Verdict

- **FOR:** Git/PR lifecycle, GitHub handoffs, local git hygiene, dev-server tmux dispatch, pi subprocess RPC, and Pi/OMP package/factory bootstrap — the operational spine around shipping and running agent workflows.
- **Spine:** `b-save` → `git-commit` (or `git-commit-improved`) → `b-pr`; PR feedback either plans (`b-pr-review-2-issues`) or acts (`fix-pr`); plans hand off via `b-issue-create`.
- **Most distinctive mechanic:** `b-pr` runs deterministic `pr-preflight.ts`, caches the chosen base in `.git/b-pr-base`, auto-rebases with `--autostash`, and **strictly separates** `implementation_files[]` (PR deliverable) from `.context/**` (research that informed the work).
- **Worktrees:** Created conditionally by `b-pr-review-2-issues` (`skills/b-pr-review-2-issues/SKILL.md:47-51`); removed/managed by `git-clean-orphans` (`skills/git-clean-orphans/SKILL.md:17-18,155-159`). `fix-pr` mentions worktree only as a checkout fallback (`skills/fix-pr/SKILL.md:54`).
- **Absent here:** CI status polling/wait-for-green loops, deployment/release automation, dedicated worktree-per-task orchestration.

## Skill Table

| Skill | Invocation | Input | Output (exact paths) | Workflow position | Distinctive mechanic |
|---|---|---|---|---|---|
| git-commit | `/b-commit` (Buck) or `/git-commit`; optional `force` | Staged changes only; optional `.context/<subject>/draft-commit.md` or `.context/draft-commit.md`; optional user context | Terminal: commit message + `git status`/`git log` output; deletes draft-commit on success (`skills/git-commit/SKILL.md:107-110,37-38,71-72`) | After `b-save`/`b-build`; before `b-pr` (`skills/b-pr/SKILL.md:307`) | Skips diff analysis when draft `## Title` exists; protected-branch guard unless `force` (`skills/git-commit/SKILL.md:35-38,21-23`) |
| git-commit-improved | `/b-commit-improved [args]`; flags `--force`, `--no-draft`, `--dry-run`, `--model` | Same staged-only + draft-commit contract as git-commit | Git commit via `extensions/b-commit-improved/index.ts`; `--dry-run` may write draft for re-run (`skills/git-commit-improved/SKILL.md:22-24,37-40`) | Same slot as `git-commit` (deterministic alternative) | Git plumbing in code (`commit-preflight.ts` + extension), not agent prose (`skills/git-commit-improved/SKILL.md:8-11,37-40`) |
| b-pr | `/b-pr`; `--base`, `--no-cache`, `--draft`, `--dry-run` | Current feature branch; optional base override | **Real PR URL** via `gh pr create`; cache `.git/b-pr-base`; temp body file `/tmp/pr-body.md` (`skills/b-pr/SKILL.md:250,61,246-248`) | After `b-commit` in recommended flow (`skills/b-pr/SKILL.md:307`); conflicts may invoke inline resolve or `b-fix-rebase-conflict` | `pr-preflight.ts` JSON splits implementation vs `.context/**`; cached base skips re-prompt (`skills/b-pr/SKILL.md:36-41,93-96`) |
| b-pr-review-2-issues | `/b-pr-review-2-issues` (alias `pr-review-2-issues`); optional PR number/URL | PR URL or number; interactive if omitted | `.context/<subject>/comment-<N>.md`; `.context/YYYY-MM-DD.<pr>-<kebab>/index.md`; `plan-pr-solutions.md` or phased `plan-*-phases.md` + `phase-N-*.md` (`skills/b-pr-review-2-issues/SKILL.md:66-67,94-96,133-134,218`) | After human PR review; before `b-build`/`b-build-hard` (`skills/b-pr-review-2-issues/SKILL.md:271-276`) | User must approve comment groupings before plan write (`skills/b-pr-review-2-issues/SKILL.md:103-125,256`); **no GitHub issues** (`skills/b-pr-review-2-issues/SKILL.md:11,260`) |
| fix-pr | `/skill:fix-pr` or skill-by-name; `fix-pr <pr>`, `--issues-only`, `--fix-only`, `--dry-run` | PR URL/number or current-branch open PR | Code commits + push; optional **real issues** via `gh issue create`; `.context/memory/fix-pr-<pr>-YYYY-MM-DD.md`; `.context/memory/index.md` (`skills/fix-pr/SKILL.md:243-247,259-264`) | Alternative to `b-pr-review-2-issues` when feedback should be fixed now, not planned (`skills/fix-pr/SKILL.md:19-25,294-295`) | Validate-then-act size gate; ingests human **and bot** reviews (`skills/fix-pr/SKILL.md:205-215,152,300`) |
| b-issue-create | Skill `b-issue-create` (native `/b-issue-create` per harness table in `b-init-factory` pattern) | Active subject plan/spec/research; branch state; `docs/agents/issue-tracker.md` conventions | `.context/<subject>/items/<slug>.md`; `.context/backlog/items/<slug>.md`; `.context/<subject>/github-issue-<slug>.md`; **real GitHub issue URL**; updated `index.md` + memory (`skills/b-issue-create/SKILL.md:43-48,69,107-109,187-192`) | After finalized `b-plan`/`b-phase`; before AFK implementation pickup (`skills/b-issue-create/SKILL.md:264-267`) | Cold-start AFK handoff: branch + presentation + executable acceptance criteria required (`skills/b-issue-create/SKILL.md:88-99,224-226`) |
| git-clean-orphans | Natural-language trigger ("clean merged branches and worktrees") | Local repo; user confirmation at Step 5 | Chat report only; mutates local worktrees/branches (`skills/git-clean-orphans/SKILL.md:183-198`) | Standalone housekeeping; downstream of merged PRs | Foreign/agent sandboxes never touched; unmerged branches need per-branch consent (`skills/git-clean-orphans/SKILL.md:62-69,105-109,204-208`) |
| b-fix-rebase-conflict | `/b-fix-rebase-conflict` (no args) | Active rebase/merge with conflict markers | Staged resolved files; optional `.context/` resolution report; **manual gate** — no `--continue` (`skills/b-fix-rebase-conflict/SKILL.md:115-146,150-152`) | During `git rebase`/`merge` conflicts; also mirrors `b-pr` exit-3 path (`skills/b-pr/SKILL.md:74-80`) | `rebase-conflict-analyze.ts` JSON + `.context/` artifact-guided semantic merge (`skills/b-fix-rebase-conflict/SKILL.md:54-66,87-100`) |
| run-in-idle-pane | Skill auto-load when starting dev servers | Shell command to run (e.g. `npm run dev`); must be inside tmux | Pane target `session:window.pane`; command sent via `tmux send-keys` (`skills/run-in-idle-pane/SKILL.md:28-35`) | During build/verify when a long-running server is needed | Process-based idle detection via `pane_current_command` + `$TMUX_PANE` scoping (`skills/run-in-idle-pane/SKILL.md:39-43,76-77`) |
| pi-rpc | Skill load; `python3 <skill_dir>/scripts/pi-prompt.py` | Prompt string; optional `--cwd`, `--model`, `--no-session`, `--timeout` | Assistant text on stdout (or raw JSONL with `--json`); subprocess exit code (`skills/pi-rpc/SKILL.md:24-33,103-106`) | When delegating a sub-task to headless pi from scripts/another agent (`skills/pi-rpc/SKILL.md:12-15`) | JSONL over stdin/stdout to `pi --mode rpc`; LF-only framing rule (`skills/pi-rpc/SKILL.md:64-68`) |
| cross-platform-pi-omp-loading | Skill load when authoring/debugging dual-runtime packages | Package directory with `package.json`, `prompts/`, `commands/`, `skills/` | No artifacts — verification commands only (`skills/cross-platform-pi-omp-loading/SKILL.md:110-135`) | When adding slash commands/skills to buck-workflow-pi or porting packages | `prompts/` source-of-truth + `commands/` symlink mirror for OMP (`skills/cross-platform-pi-omp-loading/SKILL.md:10-14,40-41`) |
| b-init-factory | `/b-init-factory [factory-root]`; optional `refresh` | Factory root path (`.claude`, `.omp`, `.agents`, etc.) or project default | `<factory_root>/AGENTS.md` (from template); `<factory_root>/docs/` created empty (`skills/b-init-factory/SKILL.md:91-95,102-104`) | When nesting a skills/commands factory inside a harness dir (`skills/b-init-factory/SKILL.md:15-17`) | Never defaults to `.claude/`; resolves root via told → project default → ask (`skills/b-init-factory/SKILL.md:40-62`) |

## Detail

### git-commit (`skills/git-commit/SKILL.md`, 111 lines)
- **Procedure**: (1) Find active `.context/YYYY-MM-DD.*/` subject folder (`skills/git-commit/SKILL.md:29-32`) (2) Read `draft-commit.md`; if `## Title` present, use it and skip diff (`skills/git-commit/SKILL.md:35-38`) (3) Else gather `git status`, staged diff, recent log (`skills/git-commit/SKILL.md:42-45`) (4) Block if protected branch without `force` (`skills/git-commit/SKILL.md:47-48`) (5) Block if nothing staged (`skills/git-commit/SKILL.md:49-50`) (6) Draft Conventional Commits message (`skills/git-commit/SKILL.md:52-56`) (7) Run `git commit` immediately (`skills/git-commit/SKILL.md:58-69`) (8) Delete draft; amend to include deletion (`skills/git-commit/SKILL.md:71-77`) (9) Retry once on hook-modified files if commit failed (`skills/git-commit/SKILL.md:79-87`) (10) Verify message; show status/log (`skills/git-commit/SKILL.md:89-105`)
- **Gates/stops**: Protected branch without `force` (`skills/git-commit/SKILL.md:21-23`); nothing staged (`skills/git-commit/SKILL.md:23,49-50`); does not auto-stage (`skills/git-commit/SKILL.md:23`)
- **Supporting files**: None in skill directory (SKILL.md only)
- **Explicitly does NOT do**: Stage files; commit unstaged/untracked work (`skills/git-commit/SKILL.md:14,23`); dry-run mode

### git-commit-improved (`skills/git-commit-improved/SKILL.md`, 44 lines)
- **Procedure**: (1) Invoke via `/b-commit-improved` or `extensions/b-commit-improved/index.ts` (`skills/git-commit-improved/SKILL.md:37-40`) (2) `commit-preflight.ts` detects subject folder, reads draft, guards protected branch, gathers staged diff (`skills/git-commit-improved/SKILL.md:37-40`; script at `skills/git-commit-improved/scripts/commit-preflight.ts:4-17`) (3) Extension performs commit, cleanup, verify per git-commit contract (`skills/git-commit-improved/SKILL.md:8-11`) (4) Cross-platform fallback: follow `skills/git-commit/SKILL.md` exactly (`skills/git-commit-improved/SKILL.md:42-44`)
- **Gates/stops**: Protected branch without `--force` (`skills/git-commit-improved/SKILL.md:29`); nothing staged (`skills/git-commit-improved/SKILL.md:30`); rejects unfilled `$TITLE`/`$BODY` placeholders (`skills/git-commit-improved/SKILL.md:31`); `--dry-run` never mutates (`skills/git-commit-improved/SKILL.md:22-24`)
- **Supporting files**: `skills/git-commit-improved/scripts/commit-preflight.ts`; implementation in `extensions/b-commit-improved/index.ts`; `commands/b-commit-improved.md` (`skills/git-commit-improved/SKILL.md:9-10,37-40`)
- **Explicitly does NOT do**: Agent-interpreted git plumbing (`skills/git-commit-improved/SKILL.md:3,13`)

### b-pr (`skills/b-pr/SKILL.md`, 307 lines)
- **Procedure**: (1) Run `bun skills/b-pr/scripts/pr-preflight.ts`; resolve base from flag → `.git/b-pr-base` cache → candidates (`skills/b-pr/SKILL.md:33-61`) (2) On exit 0/3: auto-rebase with `--autostash`; resolve conflicts inline (`skills/b-pr/SKILL.md:65-82`) (3) Synthesize dual-section PR body from `implementation_files[]` vs `context_artifacts[]` (`skills/b-pr/SKILL.md:86-199`) (4) Optional parallel subagent polish (`skills/b-pr/SKILL.md:201-229`) (5) `gh pr create --body-file` with no confirmation gate (`skills/b-pr/SKILL.md:231-251`) (6) Report PR URL (`skills/b-pr/SKILL.md:260-270`)
- **Gates/stops**: Exit 1 errors stop (`skills/b-pr/SKILL.md:70`); `--dry-run` stops before rebase/create (`skills/b-pr/SKILL.md:71,253,283`); never auto-push (`skills/b-pr/SKILL.md:279`); unresolvable conflicts stop (`skills/b-pr/SKILL.md:82`)
- **Supporting files**: `skills/b-pr/scripts/pr-preflight.ts` (`skills/b-pr/SKILL.md:36,12-16`)
- **Explicitly does NOT do**: List `.context/**` under "Files Changed"; pad description; re-derive file lists from memory (`skills/b-pr/SKILL.md:196-197,281-282`)

### b-pr-review-2-issues (`skills/b-pr-review-2-issues/SKILL.md`, 277 lines)
- **Procedure**: (1) Parse/validate PR (`skills/b-pr-review-2-issues/SKILL.md:30-42`) (2) Optionally `git worktree add ../.worktrees/<head>` if not on PR head (`skills/b-pr-review-2-issues/SKILL.md:44-54`) (3) `gh pr view --comments`; write `comment-<N>.md` per comment (`skills/b-pr-review-2-issues/SKILL.md:58-80`) (4) Classify + dedupe (`skills/b-pr-review-2-issues/SKILL.md:84-90`) (5) Create subject folder; group by theme; **get user approval** (`skills/b-pr-review-2-issues/SKILL.md:94-125`) (6) Write `plan-pr-solutions.md` or phased plan (`skills/b-pr-review-2-issues/SKILL.md:127-237`) (7) Report (`skills/b-pr-review-2-issues/SKILL.md:239-249`)
- **Gates/stops**: User must approve groups (`skills/b-pr-review-2-issues/SKILL.md:103-125,256`); read-only on source code (`skills/b-pr-review-2-issues/SKILL.md:253`); no GitHub issue creation (`skills/b-pr-review-2-issues/SKILL.md:260`)
- **Supporting files**: None in skill directory
- **Explicitly does NOT do**: Code changes; dismiss/resolve PR comments on GitHub (`skills/b-pr-review-2-issues/SKILL.md:253-254`); auto-delete worktrees (`skills/b-pr-review-2-issues/SKILL.md:255`)

### fix-pr (`skills/fix-pr/SKILL.md`, 321 lines)
- **Procedure**: (1) Resolve PR; fetch reviews + inline + conversation via `pr://` or `gh`/`fetch-feedback.sh` (`skills/fix-pr/SKILL.md:108-146`) (2) Build working table; classify duplicates/stale/nits (`skills/fix-pr/SKILL.md:148-173`) (3) Validate each item against HEAD code (`skills/fix-pr/SKILL.md:174-203`) (4) Size gate: fix vs issues (`skills/fix-pr/SKILL.md:205-215`) (5a) Fix, test, commit, push (`skills/fix-pr/SKILL.md:221-235`) or (5b) `gh issue create` per theme (`skills/fix-pr/SKILL.md:239-251`) (6) Write `.context/memory/fix-pr-*.md` + closeout report (`skills/fix-pr/SKILL.md:255-283`)
- **Gates/stops**: `--dry-run` no mutate after Phase 3 (`skills/fix-pr/SKILL.md:215-219,287-289`); `--fix-only` stops if too large (`skills/fix-pr/SKILL.md:213`); ask engineer only for `unsure` (`skills/fix-pr/SKILL.md:190-201,293`); no push on failing tests (`skills/fix-pr/SKILL.md:237,310`)
- **Supporting files**: `skills/fix-pr/scripts/fetch-feedback.sh` (`skills/fix-pr/SKILL.md:131-137`)
- **Explicitly does NOT do**: Plan-only theater — hand off to `b-pr-review-2-issues` for large planning (`skills/fix-pr/SKILL.md:294-295`); no prompt/command wrapper (`skills/fix-pr/SKILL.md:29-42`)

### b-issue-create (`skills/b-issue-create/SKILL.md`, 269 lines)
- **Procedure**: (1) Read memory/backlog; confirm plan has acceptance criteria (`skills/b-issue-create/SKILL.md:52-65`) (2) Draft `.context/<subject>/items/<slug>.md` (`skills/b-issue-create/SKILL.md:67-101`) (3) Write `github-issue-<slug>.md` body file (`skills/b-issue-create/SKILL.md:103-147`) (4) Update backlog + index; commit handoff artifacts (`skills/b-issue-create/SKILL.md:149-162`) (5) `git push -u origin <branch>` (`skills/b-issue-create/SKILL.md:164-172`) (6) `gh issue create --body-file` (`skills/b-issue-create/SKILL.md:174-192`) (7) Link issue URL back into `.context` + memory (`skills/b-issue-create/SKILL.md:194-208`)
- **Gates/stops**: Stop if plan unresolved or missing acceptance criteria (`skills/b-issue-create/SKILL.md:65,224`); inspect labels before assuming `ready-for-agent` (`skills/b-issue-create/SKILL.md:176-179,228`)
- **Supporting files**: References `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md` (`skills/b-issue-create/SKILL.md:37-39`)
- **Explicitly does NOT do**: Create issues from vague/unscoped ideas (`skills/b-issue-create/SKILL.md:18-20`); bundle unrelated code in handoff commit (`skills/b-issue-create/SKILL.md:227`); implementation (`skills/b-issue-create/SKILL.md:20`)

### git-clean-orphans (`skills/git-clean-orphans/SKILL.md`, 241 lines)
- **Procedure**: (1) `git fetch --prune origin` (`skills/git-clean-orphans/SKILL.md:28-34`) (2) Inventory worktrees + branches (`skills/git-clean-orphans/SKILL.md:36-49`) (3) Classify worktrees: skip foreign/detached sandboxes (`skills/git-clean-orphans/SKILL.md:54-69`) (4) Classify branches merged vs unmerged; print reflog for unmerged (`skills/git-clean-orphans/SKILL.md:83-103`) (5) Present table; **wait for approval** (`skills/git-clean-orphans/SKILL.md:105-146`) (6) Remove worktrees, `-d`/`-D` branches (`skills/git-clean-orphans/SKILL.md:148-181`) (7) Report (`skills/git-clean-orphans/SKILL.md:183-198`)
- **Gates/stops**: Blocks on Step 5 user input; no `--force` bypass (`skills/git-clean-orphans/SKILL.md:237-240`); stops if no conventional base branch (`skills/git-clean-orphans/SKILL.md:51-52`)
- **Supporting files**: None in skill directory
- **Explicitly does NOT do**: Remote branch deletion; `git push --prune`; touch foreign worktrees (`skills/git-clean-orphans/SKILL.md:219-233`)

### b-fix-rebase-conflict (`skills/b-fix-rebase-conflict/SKILL.md`, 201 lines)
- **Procedure**: (1) Run `rebase-conflict-analyze.ts`; exit 2 = no conflict (`skills/b-fix-rebase-conflict/SKILL.md:51-66`) (2) Read `.context/` artifacts for intent (`skills/b-fix-rebase-conflict/SKILL.md:68-85`) (3) Semantic-merge each hunk; `git add` (`skills/b-fix-rebase-conflict/SKILL.md:87-98`) (4) Verify no markers; targeted tests (`skills/b-fix-rebase-conflict/SKILL.md:102-113`) (5) Write resolution report (`skills/b-fix-rebase-conflict/SKILL.md:115-146`) (6) **Stop** — user runs `--continue` (`skills/b-fix-rebase-conflict/SKILL.md:150-152`)
- **Gates/stops**: Never `rebase --continue`, `commit`, `abort`, or `push` (`skills/b-fix-rebase-conflict/SKILL.md:34-37,175-177`); stop if verification fails (`skills/b-fix-rebase-conflict/SKILL.md:113`)
- **Supporting files**: `skills/b-fix-rebase-conflict/scripts/rebase-conflict-analyze.ts`; `rebase-conflict-analyze.test.ts` (`skills/b-fix-rebase-conflict/SKILL.md:54`)
- **Explicitly does NOT do**: Advance git operation (`skills/b-fix-rebase-conflict/SKILL.md:8,150-152`)

### run-in-idle-pane (`skills/run-in-idle-pane/SKILL.md`, 102 lines)
- **Procedure**: (1) Prefer idle pane over new window/foreground (`skills/run-in-idle-pane/SKILL.md:12-16`) (2) Run `find_idle_pane.sh` → `session:window.pane` (`skills/run-in-idle-pane/SKILL.md:28-29`) (3) `tmux send-keys -t "$TARGET" '<cmd>' Enter` (`skills/run-in-idle-pane/SKILL.md:32-33`) (4) Verify via `tmux capture-pane` or curl health (`skills/run-in-idle-pane/SKILL.md:85-91`)
- **Gates/stops**: Exit 1 if not inside tmux (`skills/run-in-idle-pane/SKILL.md:45` per script contract)
- **Supporting files**: `skills/run-in-idle-pane/scripts/find_idle_pane.sh`; external `~/.bin/run-in-idle-pane.sh` (chezmoi) (`skills/run-in-idle-pane/SKILL.md:22,47-68`)
- **Explicitly does NOT do**: Use hub-managed processes (skill predates/alternates to tmux-dev-server pattern); no file artifacts

### pi-rpc (`skills/pi-rpc/SKILL.md`, 121 lines)
- **Procedure**: (1) Choose one-shot `pi-prompt.py` or direct JSONL (`skills/pi-rpc/SKILL.md:19-27,51-62`) (2) Spawn `pi --mode rpc` (`skills/pi-rpc/SKILL.md:59`) (3) Send LF-terminated JSON commands (`skills/pi-rpc/SKILL.md:60-62`) (4) Read events until `agent_end` (`skills/pi-rpc/SKILL.md:98-106`) (5) Handle `extension_ui_request` or use `--no-extensions` (`skills/pi-rpc/SKILL.md:101,110`)
- **Gates/stops**: Do not spawn if already inside pi for simple skill invoke (`skills/pi-rpc/SKILL.md:17`); timeout sends `abort` (`skills/pi-rpc/SKILL.md:41`)
- **Supporting files**: `skills/pi-rpc/scripts/pi-prompt.py`; `skills/pi-rpc/reference.md` (`skills/pi-rpc/SKILL.md:116-120`)
- **Explicitly does NOT do**: Replace in-session `/skill:name` when already in pi (`skills/pi-rpc/SKILL.md:17`)

### cross-platform-pi-omp-loading (`skills/cross-platform-pi-omp-loading/SKILL.md`, 141 lines)
- **Procedure**: (1) Lay out `prompts/` + symlinked `commands/` + `skills/` + `extensions/` (`skills/cross-platform-pi-omp-loading/SKILL.md:25-37`) (2) Declare `pi` and `omp` keys in `package.json` (`skills/cross-platform-pi-omp-loading/SKILL.md:42-61`) (3) Account for OMP shim gaps (`getModel`, `registerCommand`, events) (`skills/cross-platform-pi-omp-loading/SKILL.md:88-106`) (4) Run verification checklist (`skills/cross-platform-pi-omp-loading/SKILL.md:110-135`)
- **Gates/stops**: `omp.commands` pointing at `prompts/` is a dead end (`skills/cross-platform-pi-omp-loading/SKILL.md:79-86`)
- **Supporting files**: `skills/cross-platform-pi-omp-loading/slash-command-mirror/SKILL.md`; external `docs/extension-loading.md` (`skills/cross-platform-pi-omp-loading/SKILL.md:14,139-140`)
- **Explicitly does NOT do**: Make `b-mode`/`b-restrict` work in OMP (deferred) (`skills/cross-platform-pi-omp-loading/SKILL.md:106`)

### b-init-factory (`skills/b-init-factory/SKILL.md`, 105 lines)
- **Procedure**: (1) Resolve factory root: told → project default → ask (`skills/b-init-factory/SKILL.md:46-62`) (2) If `AGENTS.md` exists and no `refresh`, report and ensure `docs/` only (`skills/b-init-factory/SKILL.md:82-83`) (3) Copy `references/factory-agents.md` → `<factory_root>/AGENTS.md` (`skills/b-init-factory/SKILL.md:89-91`) (4) Create empty `docs/` (`skills/b-init-factory/SKILL.md:93-95`) (5) Report (`skills/b-init-factory/SKILL.md:97-99`)
- **Gates/stops**: Stop until root resolved (`skills/b-init-factory/SKILL.md:62`); never default to `.claude/` or repo root (`skills/b-init-factory/SKILL.md:40-41`); idempotent skip without `refresh` (`skills/b-init-factory/SKILL.md:82-83`)
- **Supporting files**: `skills/b-init-factory/references/factory-agents.md` (`skills/b-init-factory/SKILL.md:91,104`)
- **Explicitly does NOT do**: Wrapping-project AGENTS.md; guardrails (`b-init-guardrails`); session memory (`b-save`); fill `docs/` content (`skills/b-init-factory/SKILL.md:11,19,95`)

## Cross-cutting answers

### Q1. Worktrees
**Yes, but narrowly scoped — no dedicated worktree orchestration skill.**
- **Create:** `b-pr-review-2-issues` adds `../.worktrees/<head-branch>` when current branch ≠ PR head (`skills/b-pr-review-2-issues/SKILL.md:47-51`); reuses existing dir if present (`skills/b-pr-review-2-issues/SKILL.md:265`).
- **Remove/manage:** `git-clean-orphans` inventories and removes in-project registered worktrees whose remote is gone, with user approval (`skills/git-clean-orphans/SKILL.md:17-18,155-159`).
- **Mention only:** `fix-pr` lists `git fetch` + checkout / worktree as a checkout fallback (`skills/fix-pr/SKILL.md:54`), not creation logic.
- **Absent:** No skill that provisions isolated worktrees per task/agent as a first-class workflow primitive.

### Q2. CI polling / wait-for-green
**Absent.** No skill in this cluster polls `gh pr checks`, watches GitHub Actions, or loops until CI is green. `fix-pr` explicitly tells agents to ignore bot noise like "CI still running" (`skills/fix-pr/SKILL.md:300`) — it does not wait on CI.

### Q3. Automated bot review comments
**Partially — no bot-specific adapters.**
- `fix-pr` ingests submitted review bodies from **human + bot** and treats concrete bot findings as valid (`skills/fix-pr/SKILL.md:152,300`). No separate CodeRabbit/Copilot/CodeQL ingestion path.
- `b-pr-review-2-issues` fetches via `gh pr view --comments` (`skills/b-pr-review-2-issues/SKILL.md:60`) without distinguishing human vs bot authors in its classification table (`skills/b-pr-review-2-issues/SKILL.md:84-89`).

### Q4. Real tracker artifacts vs local markdown
| Skill | Real `gh` artifacts | Local `.context`/markdown only |
|---|---|---|
| **b-pr** | `gh pr create` → real PR (`skills/b-pr/SKILL.md:250`) | Uses `/tmp/pr-body.md`; caches `.git/b-pr-base` |
| **b-issue-create** | `gh issue create` → real issue (`skills/b-issue-create/SKILL.md:182-192`) | `.context/<subject>/items/<slug>.md`, `.context/backlog/items/<slug>.md`, `github-issue-<slug>.md`, memory/index updates (`skills/b-issue-create/SKILL.md:43-48`) |
| **fix-pr** | `gh issue create` when issues path (`skills/fix-pr/SKILL.md:243-247`); also `git commit` + `git push` | `.context/memory/fix-pr-<pr>-YYYY-MM-DD.md` (`skills/fix-pr/SKILL.md:259-264`) |
| **b-pr-review-2-issues** | **None** — explicitly no issue creation (`skills/b-pr-review-2-issues/SKILL.md:11,260`) | `comment-<N>.md`, subject `index.md`, `plan-pr-solutions.md` / phased plans (`skills/b-pr-review-2-issues/SKILL.md:66-67,133-134`) |
| **git-commit / git-commit-improved** | Git commits only (not GitHub tracker) | May consume/delete `draft-commit.md` (`skills/git-commit/SKILL.md:33-38`) |
| **git-clean-orphans, b-fix-rebase-conflict, run-in-idle-pane, pi-rpc, cross-platform-pi-omp-loading, b-init-factory** | None | Optional `.context/` reports (b-fix-rebase-conflict); factory `AGENTS.md` (b-init-factory) |

### Q5. Deployment / release / infrastructure
**Absent as a dedicated capability.** `run-in-idle-pane` starts local dev servers in tmux (`skills/run-in-idle-pane/SKILL.md:3,12`). `cross-platform-pi-omp-loading` mentions "tagging a release" only as a **package verification** step, not deploy (`skills/cross-platform-pi-omp-loading/SKILL.md:110`). `b-init-factory` scaffolds a nested factory, not infrastructure (`skills/b-init-factory/SKILL.md:9-11`). No deploy, release, k8s, or cloud provisioning skill in this cluster.

## Gaps

- No CI status polling or "wait until PR checks pass" loop.
- No dedicated worktree-per-unit-of-work provisioner (only conditional create in `b-pr-review-2-issues` and cleanup in `git-clean-orphans`).
- No PR **update** skill (edit body, push new commits to existing PR) — only **create** (`b-pr`).
- No deployment/release/infrastructure automation.
- No remote branch cleanup (`git-clean-orphans` is local-only per `skills/git-clean-orphans/SKILL.md:219-221`).
- No bot-review-specific parsers (CodeRabbit/Copilot) — generic `gh` comment ingestion only.
- No `gh pr merge` / auto-merge workflow in this cluster.

## Open questions

- Q-G1: Does `b-pr-review-2-issues`'s `gh pr view --comments` capture inline review threads, or only conversation comments? The skill body shows one fetch call (`skills/b-pr-review-2-issues/SKILL.md:60`) while `fix-pr` merges three API surfaces (`skills/fix-pr/SKILL.md:122-124`) — overlap audit should flag possible under-ingestion.
- Q-G2: Is `extensions/b-commit-improved/index.ts` always present in consumer repos, or only in buck-workflow-pi itself? `git-commit-improved` defers all orchestration to that extension (`skills/git-commit-improved/SKILL.md:37-40`).
- Q-G3: Should `b-issue-create` and `fix-pr` share label conventions (`ready-for-agent`, `needs-triage`) via a single canonical doc, or are `docs/agents/triage-labels.md` paths guaranteed in every consumer repo?
