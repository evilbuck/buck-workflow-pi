---
cluster: BUILD, REVIEW & QUALITY GATES
skills_covered: 10
---

## Verdict

- **Core purpose:** Implement work with TDD, enforce machine-checkable quality via `guardrails.json`, and gate shipping through `b-review` against plan/spec acceptance contracts.
- **Spine:** `b-build` → `/b-guardrails-check` (closeout) → `b-review` → (`b-iterate` → `b-review`)* → `b-save` / `b-commit`.
- **Distinctive mechanic:** `b-review` is the only workflow **gate** — it runs `/b-guardrails-check`, fills a completion matrix with file:line evidence, classifies findings as in-plan vs out-of-plan, and writes `iterate-*.md` only for in-plan defects (`skills/b-review/SKILL.md:149-188`, `324-388`).
- **Parallel review is opt-in:** Release/domain skills (`code-review`, `node5-code-review`, `code-smells` audit) fan out specialists; `b-review` and `code-review-universal` default to single-pass review.
- **Guardrails are brownfield-safe:** Six gates with patch (90%) + monotonic coverage ratchet + complexity burn-down, recorded in `guardrails.json` and measured read-only by `b-guardrails-check` (`skills/b-init-guardrails/docs/ratchet-protocol.md:82-161`).
- **No dedicated debugging skill** in this cluster; `b-iterate` covers lightweight diagnostics only.

## Skill Table

| Skill | Invocation | Input | Output (exact paths) | Workflow position | Distinctive mechanic |
|---|---|---|---|---|---|
| b-build | `/b-build`, `/b-build-hard` | Plan/spec/phase/subject via subject-resolution; optional phased `plan-*-phases.md` | `.context/YYYY-MM-DD.<subject>/draft-commit.md`; updates `phase-*.md` frontmatter; session memory in `.context/workflow/current-session.json` | After `b-plan` (sibling); before `b-review` | Mandated red→green→refactor loop; UI work requires Playwright-first (`skills/b-build/SKILL.md:28-35`, `58-119`); closeout proof is `/b-guardrails-check` not ad-hoc vitest (`331`) |
| b-iterate | `/b-iterate` | Active `iterate-*.md` in subject folder; or inline user description | Updates `iterate-*.md` (`status: completed`); `draft-commit.md` in subject or `.context/draft-commit.md` | After `b-review` finds in-plan issues; before re-`b-review` | Tiny diffs only; reruns **lint + unit-test gates only** (`skills/b-iterate/SKILL.md:25`); escalates to `b-build` if scope spreads (`24`) |
| b-review | `/b-review` | Optional plan/spec/phase/subject path; else git + subject-resolution | `iterate-*.md` in `.context/YYYY-MM-DD.<subject>/` when in-plan issues (`336-338`); chat report with Guardrails Verdict section | After `b-build`/`b-iterate`; before `b-save`/`b-commit` | Single-pass acceptance audit + 6-step goal-completion protocol; routes in-plan → `/b-iterate`, out-of-plan → `/b-plan` (`149-193`) |
| b-auto-fix | `bun run skills/b-auto-fix/scripts/auto-fix.ts -- --repo owner/repo` | GitHub issue in isolated worktree; run state dir | `.context/auto-fix/<run-id>/issue-<n>/{research,plan,build,review}.md` | End-to-end per issue: `b-research`→`b-plan`→`b-build`→`b-review` (siblings) | CLI orchestrates worktrees; `review_blocked` is a hard-fail (`skills/b-auto-fix/SKILL.md:44-46`, `91`, `102`) |
| code-review | Skill load (no YAML frontmatter) | Release-candidate PR number + base/head branches | `/mnt/c/Code/plans/review-PR-<NUMBER>-<slug>.md` per originating feature PR (`134`) | Standalone release audit; not a buck workflow gate | **Parallel agents per risk area** (migrations, integrations, frontend, etc.) then consolidate (`50-67`, `113-128`) |
| code-review-universal | Skill name; PR URL / `#N` / local path / none | PR URL, `owner/repo#N`, `#N`, file path, or git diff | `.context/YYYY-MM-DD.<pr>-<kebab>/review-pr-<N>.md` (PR mode) or `<subject>/review-<slug>-YYYY-MM-DD.md` (local) (`180-183`) | Complements `b-review`; not a workflow gate (`45-50`) | **Single reviewer**, 4 phases; posts **one atomic** GitHub review via `code-review/scripts/submit-review.ts` (`229-292`) |
| node5-code-review | Skill name; optional plan/spec/phase/subject/context | Same path patterns as `b-review` + freeform context | Markdown report (templates at `skills/node5-code-review/SKILL.md:146-203`; no fixed write path) | Complement to `code-review`; follow-up `/b-iterate` or `/b-build` (`225`) | **Parallel `task` subagents per risk area** with concrete failure-scenario requirement (`54-72`, `137-142`) |
| code-smells | "Scan for code smells" / audit mode | Scope path (default cwd); optional `CODE_SMELLS_DOCS` override | `.context/YYYY-MM-DD.code-smells-scan/report.md` + `findings.json` (`66`, `196-240`) | Pre-remediation audit; handoff to `/b-plan` or OMP goal mode (`253-268`) | **5 parallel category subagents** (23 smells); hard gate on doc resolution before fan-out (`37-61`, `80-88`) |
| b-guardrails-check | `/b-guardrails-check` | Repo root `guardrails.json` via 5-step contract-resolution chain | Structured JSON verdict (stdout/agent); **never writes files** (`10`, `111-163`) | At build closeout, during `b-review`, or dispatched as background OMP `task` (`177-192`) | Measure-never-edit; six gates compared to `guardrails.json` (`97-110`) |
| b-init-guardrails | `/b-init-guardrails` | Repo cwd | `guardrails.json` at repo root; managed block in `AGENTS.md`/`CLAUDE.md` (`121-131`) | One-shot before durable guardrails exist; repair when contract broken | Brownfield baseline capture + propose-then-approve tooling (`59-78`); idempotent refresh mode (`31-37`) |

## Detail

### b-build (`skills/b-build/SKILL.md`, 343 lines)
- **Procedure**: (1) Resolve subject + load plan/spec/phase artifacts (`221-236`). (2) Plan behaviors and test type; get user approval (`60-68`). (3) Red: write one failing test (`70-82`). (4) Green: minimal implementation (`84-98`). (5) Refactor only when green (`100-111`). (6) Repeat RED→GREEN→REFACTOR (`113-119`). (7) Run `/b-guardrails-check` at closeout (`329-331`). (8) Write `draft-commit.md`; recommend `/b-review` (`329-343`).
- **Gates/stops**: Soft User Goal flag if plan lacks `## User Goal` — never blocks (`238-251`). Hard phase difficulty mismatch warning standard vs hard phase (`265-269`). Escalate to `b-build-hard` if scope grows (`324-327`). OMP execution: do not yield without `/b-save` durable state (`316-322`).
- **Supporting files**: Uses `skills/_shared/subject-resolution.md`; references repo `playwright.config.ts`, `tests/e2e/*.spec.ts` (`135-148`).
- **Explicitly does NOT do**: Planning (`b-plan` sibling); review/commit (`b-review`, `b-save`, `b-commit` recommended only); does not replace guardrails check with ad-hoc test runs at closeout (`331`).

### b-iterate (`skills/b-iterate/SKILL.md`, 80 lines)
- **Procedure**: (1) Resolve subject; find `iterate-*.md` (`10-19`). (2) Fix Critical then Warnings (`19`). (3) Rerun lint + unit-test gates only (`25`). (4) Update session memory (`32-47`). (5) Mark iterate artifact completed (`49-51`, `57-60`). (6) Write/update `draft-commit.md` (`63-71`). (7) Tell user to re-run `/b-review` (`52`, `73`).
- **Gates/stops**: Active iterate artifact blocking until review passes (`19`). Escalate to `b-build` if work spreads (`24`). OMP: do not yield until review passes and `/b-save` (`73`).
- **Supporting files**: `skills/_shared/subject-resolution.md` (`12`).
- **Explicitly does NOT do**: Coverage/patch/complexity gates (`25`); planning or full rebuild (escalates instead).

### b-review (`skills/b-review/SKILL.md`, 410 lines)
- **Procedure**: (1) Resolve scope from path or git discovery (`12-50`). (2) Build completion matrix against plan/spec (`52-71`). (3) Run 6-step goal-completion audit (`82-106`). (4) Run `/b-guardrails-check` — fail verdict blocks pass (`123-130`). (5) Check documentation/how-to impact (non-blocking) (`202-243`). (6) Classify issues in-plan vs out-of-plan (`149-193`). (7) Write `iterate-*.md` for in-plan issues only (`324-388`). (8) Emit Pass/Needs work verdict (`305-402`).
- **Gates/stops**: `b-guardrails-check` fail → verification `❌ missing` (`128-129`). Read-only unless writing iterate artifact (`236`). Out-of-plan issues never block current plan verdict (`184-193`).
- **Supporting files**: `skills/_shared/subject-resolution.md` (`28`); references `skills/b-docs/SKILL.md`, `b-howto` routing (`224-243`).
- **Explicitly does NOT do**: Edit application code; plan new scope (routes out-of-plan to `/b-plan`); write iterate for doc-impact or out-of-plan findings (`217-221`, `328-329`).

### b-auto-fix (`skills/b-auto-fix/SKILL.md`, 102 lines)
- **Procedure**: (1) `b-research` → `<run-dir>/research.md` (`20-24`). (2) `b-plan` → `plan.md` (`26-30`). (3) `b-build` → `build.md` (`32-36`). (4) `b-review` → `review.md` (`38-42`). (5) CLI pushes/PRs on success (`53-54`).
- **Gates/stops**: Any stage error classified via `hard_fails` (`44-46`); `review_blocked` hard-fail (`46`, `91`, `102`). `--list` / `--dry-run` observation modes (`74-82`).
- **Supporting files**: `scripts/auto-fix.ts`, `scripts/auto-fix/lib/*`, `auto-fix.config.json` (`51-93`).
- **Explicitly does NOT do**: Own research/plan/build/review logic (delegates to sibling skills `24`, `30`, `36`, `42`).

### code-review (`skills/code-review/SKILL.md`, 198 lines)
- **Procedure**: (1) Fetch PR metadata via `gh` (`14-27`). (2) Map files to originating PRs/commits (`31-46`). (3) Fan out parallel agents per risk area (`50-67`). (4) Each agent diffs + reads full files + returns severity/file:line findings (`63-67`, `71-109`). (5) Consolidate master list (`113-128`). (6) Write per-PR review files (`132-162`). (7) Verify claims before finalizing (`166-175`). (8) Output assignment summary table (`179-188`).
- **Gates/stops**: Do not run git add/commit/push (`198`). Downgrade unverified third-party API claims (`170-175`).
- **Supporting files**: `scripts/pr-context.ts`, `submit-review.ts`, `pr-ref.ts` (referenced by `code-review-universal`).
- **Explicitly does NOT do**: Git mutations (`198`); buck workflow iterate routing (standalone release prompt).

### code-review-universal (`skills/code-review-universal/SKILL.md`, 433 lines)
- **Procedure**: (1) Select local vs GitHub PR mode (`33-41`). (2) Context gather 2-3 min (`126-144`). (3) High-level review 5-10 min (`146-155`). (4) Line-by-line 10-20 min (`157-164`). (5) Summary + approve/comment/request-changes (`166-174`). (6) PR mode: `pr-context.ts` → review → `findings.json` + `summary.md` → dry-run → `submit-review.ts` (`235-291`). (7) Write durable `.context/` report (`176-227`).
- **Gates/stops**: Never gates buck workflow (`45-50`). Self-PR must use `COMMENT` event (`301`). Validation errors block posting (`279-284`, `329-337`).
- **Supporting files**: `reference/*.md` (20+ language guides), `reference/cross-cutting/*`, `assets/review-checklist.md`, `scripts/pr-analyzer.py`, reuses `code-review/scripts/*` (`237-239`).
- **Explicitly does NOT do**: Replace `b-review` workflow gate (`45-50`); loop until clean (one-shot per invocation).

### node5-code-review (`skills/node5-code-review/SKILL.md`, 226 lines)
- **Procedure**: (1) Scope resolution from path or git (`23-37`). (2) Identify relevant risk areas (`39-52`). (3) Delegate parallel `task` per area (`54-74`). (4) Area-specific checklists (`76-114`). (5) Universal security/data/perf checks (`116-125`). (6) Compile severity-sorted findings (`127-140`). (7) Produce plan-contract or freeform report (`144-211`).
- **Gates/stops**: Stay read-only (`216`). Drop findings without concrete failure scenario (`137-142`, `218`).
- **Supporting files**: None in skill dir (self-contained checklist).
- **Explicitly does NOT do**: GitHub inline posting (defers to `code-review` per `225`); workflow gate (complement only).

### code-smells (`skills/code-smells/SKILL.md`, 436 lines)
- **Procedure**: (0) Hard gate: resolve all 23 docs via `skill://code-smells/docs` (`37-61`). (1) Scope + create `.context/YYYY-MM-DD.code-smells-scan/` (`63-68`). (2) Fan out 5 category subagents in parallel (`70-88`). (3) Each subagent applies detection playbook + returns finding schema (`90-160`). (4) Dedupe, rank, write `report.md` (`192-240`). (5) Optional `b-blueprint` visual (`244-251`). (6) Handoff to `/b-plan` or OMP goal (`253-268`).
- **Gates/stops**: STOP if docs not resolvable — no partial audit (`37-55`, `57-61`). Budget exhaustion → `status: partial` (`74`).
- **Supporting files**: `docs/*.md` (23 smell definitions + `index.md`); OMP starter Python cell embedded (`271-373`).
- **Explicitly does NOT do**: Fix smells inline (report + handoff only); fabricate definitions without docs (`29`, `55`).

### b-guardrails-check (`skills/b-guardrails-check/SKILL.md`, 220 lines)
- **Procedure**: (1) Resolve contract via `docs/contract-resolution.md` (`27-37`). (2) Run unit + functional test gates per ecosystem (`39-46`). (3) Run lint gate diff-scoped or whole-repo (`48-62`). (4) Run coverage + patch gate via diff-cover (`64-82`). (5) Run complexity via recorded cmd (`84-95`). (6) Compare thresholds (`97-110`). (7) Emit JSON verdict (`111-163`).
- **Gates/stops**: Malformed `guardrails.json` fails hard (`37`). Measure-never-edit — never modifies repo (`10`, `213`). Missing git/compare branch skips patch gate (`82`, `219`).
- **Supporting files**: `docs/contract-resolution.md`; consumes `skills/b-init-guardrails/scripts/detect-stack.ts` ephemerally (`contract-resolution.md:19-29`).
- **Explicitly does NOT do**: Fix code, add tests, or rewrite `guardrails.json` (`10`, `171-172`).

### b-init-guardrails (`skills/b-init-guardrails/SKILL.md`, 171 lines)
- **Procedure**: (0) Idempotency: create vs refresh vs v1→v2 upgrade (`31-37`). (1) `detect-stack.ts` (`39-57`). (2) Propose tooling — **wait for user approval** (`59-78`). (3) Measure baseline coverage/complexity/lint (`80-119`). (4) Write `guardrails.json` (`121-123`). (5) Install managed AGENTS block (`125-131`). (6) Report burn-down plan (`133-158`).
- **Gates/stops**: Failing test suites at init are blockers — never record known-failing state (`95-96`). Phase 2 approval required before file writes (`78`, `contract-resolution.md:3`).
- **Supporting files**: `scripts/detect-stack.ts`, `docs/ratchet-protocol.md`, `docs/tooling-matrix.md`, `docs/agents-block.md`.
- **Explicitly does NOT do**: Ongoing measurement (delegates to `b-guardrails-check`); auto-run without user approval on tooling changes (`78`).

## Cross-cutting answers

### Q1. TDD skill — enforced red/green/refactor with gate blocking implementation before failing test?

**Present as procedural discipline in `b-build`, not an automated enforcement gate.**

Quotes:
- `"write tests first"` — standard mode (`skills/b-build/SKILL.md:10`)
- UI mandate: `"Write a Playwright test FIRST"` → `"verify it fails (RED phase)"` → implement GREEN → refactor (`31-34`)
- `"Test fails → confirms the behavior doesn't exist yet."` (`82`)
- `"Never refactor while RED. Get to GREEN first."` (`111`)

**Absent:** No skill-level mechanism that *blocks* writing implementation until a failing test is observed. Closeout proof is `/b-guardrails-check` (exit-code gates), not red-phase verification (`329-331`). Plan step asks user approval before coding (`67`) but is not a hard stop.

### Q2. Review: single pass or parallel specialist reviewers?

**Both — depends on skill.**

| Mechanism | Skills | Evidence |
|---|---|---|
| **Single pass** | `b-review`, `code-review-universal` | `b-review` is one agent with completion matrix (`6-10`); universal runs Phases 1-4 sequentially (`126-174`) |
| **Parallel fan-out** | `code-review`, `node5-code-review`, `code-smells` (audit) | `code-review`: "Launch one agent per area **in parallel**" (`63`); `node5-code-review`: "Delegate each relevant area to a parallel subagent using `task`" (`56`); `code-smells`: "five category subagents run in parallel" (`72-76`) |

`b-review` MAY consult `code-review-universal` reference guides (`54`) but does not dispatch parallel reviewers.

### Q3. Adversarial / red-team review posture?

**No dedicated red-team skill in this cluster.**

- `code-review-universal` labels sibling `code-review` as a "**Brutally-honest tone variant**" (`51`) — tone framing, not an explicit attack-the-work mandate.
- `code-smells` audit requires tool-backed `evidence`; hypotheses are dropped (`162-163`) — analytical, not adversarial.
- `b-review` verifies against acceptance contract; uncertainty → `not-verifiable`, not hostile probing (`101-103`).

**Absent:** Instructions like "assume the implementation is wrong and try to break it" or formal red-team reviewer role.

### Q4. Machine-checkable gates and threshold locations

**Six gates** (durable v2 contract): `unit_test_gate`, `functional_test_gate`, `lint_gate`, `patch_gate`, `global_ratchet`, `complexity_gate` (`skills/b-guardrails-check/SKILL.md:147-154`; `skills/b-init-guardrails/docs/ratchet-protocol.md:84`).

**Thresholds recorded in:**
1. **`guardrails.json` → `targets`** (per-repo): `coverage_min`, `coverage_target`, `cyclomatic_max`, `cyclomatic_hard_ceiling`, `patch_coverage_min` (`guardrails.json:3-8`; schema `ratchet-protocol.md:12-17`)
2. **`guardrails.json` → `ratchet`**: `baseline_coverage`, `baseline_complexity_inventory`, `baseline_lint_clean` (`guardrails.json:10-15`)
3. **Canonical defaults / authority table**: `skills/b-init-guardrails/docs/ratchet-protocol.md:164-175` (McCabe 10/15, Google Testing Blog 60/75/90%, patch ≥90%)

**This repo's live `guardrails.json` (v2):** `patch_coverage_min: 90`, `cyclomatic_max: 10`, `cyclomatic_hard_ceiling: 15`, `coverage_min: 60`, `coverage_target: 75`, `baseline_coverage: 54.9`, TypeScript `test_runner: "vitest run"`, `complexity_cmd` via lizard (`guardrails.json:1-241`). Lint/functional test `null` for detected ecosystems → gates skipped.

**Enforcement surface:** `b-guardrails-check` runs recorded commands and compares; `b-init-guardrails` writes the contract; managed `AGENTS.md` block makes checks blocking at coherent points (`agents-block.md:15-24`).

### Q5. Loop until clean vs one-shot?

**Explicit loop in buck workflow; one-shot for auxiliary reviewers.**

- **Loop:** `b-review` writes `iterate-*.md` → `/b-iterate` → "Hand back to `b-review` when done" (`skills/b-iterate/SKILL.md:26`); iterate artifact "blocking until review passes" (`19`); artifact recommends re-run `/b-review` (`384-385`).
- **One-shot:** `code-review-universal` completes one review report + optional GitHub post per invocation (`176-227`).
- **Pipeline:** `b-auto-fix` runs review once per issue; `review_blocked` requires manual fix + re-run (`102`), not an automatic inner loop.

### Q6. Systematic DEBUGGING skill (reproduce → root-cause → fix → regression test)?

**Absent from this cluster.**

- `b-iterate` lists "lightweight diagnostics" as a use case (`79`) but provides no reproduce→root-cause→regression-test protocol.
- `b-build` TDD inner loop covers test-first feature work, not incident debugging.
- No skill named or structured for systematic debugging appears in the assigned set.

## Gaps

- **No systematic debugging skill** — only TDD feature development and iterate-time "lightweight diagnostics."
- **No automated TDD gate** — red-phase discipline is agent prose, not a harness block on editing source before test failure.
- **No unified PR review entry** — four overlapping review skills (`b-review`, `code-review`, `code-review-universal`, `node5-code-review`) with different outputs, parallelism, and workflow roles; user must pick correctly.
- **`code-review` path is project-specific** — writes to `/mnt/c/Code/plans/` (`134`), not `.context/` buck conventions.
- **Guardrails lint/functional gates inactive in this repo** — `guardrails.json` has `lint_cmd: null` and `functional_test_cmd: null` for detected ecosystems (`guardrails.json:196-198`, `214-216`).
- **No security-scan automation** — security appears in review checklists (`code-review-universal` security guide) but not as a machine gate in `guardrails.json`.

## Open questions

- Q-B1: Is the `code-review` skill's `/mnt/c/Code/plans/` output path intentional for buck-workflow-pi, or stale copy from another project (`skills/code-review/SKILL.md:134`)?
- Q-B2: Does `code-review-universal`'s "Brutally-honest" `code-review` variant refer to the same `skills/code-review/SKILL.md` release prompt, or a missing/alternate skill body that writes `CODE-REVIEW.md` at repo root (`skills/code-review-universal/SKILL.md:51`)?
- Q-B3: Should `b-build` hard-mode "manual verification" (`55`) ever bypass `/b-guardrails-check`, or is that always subordinate to the deterministic contract (`331`)?
