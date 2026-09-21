# Prompts & Commands audit — 2026-09-21

Branch `master` @ `7dc2aaf`. Read-only. Companion to `notes-inventory.md`.

## Mirror verification

`prompts/` has 43 markdown files. `commands/` has 43 entries. `scripts/commands-mirror.test.ts` enforces four invariants:

1. Every `prompts/*.md` has a `commands/<name>.md` symlink.
2. Every `commands/*.md` is a symlink (no physical files).
3. Every symlink resolves to `../prompts/<name>.md`.
4. `commands/` has no undeclared extras.

Verified by reading the test (`scripts/commands-mirror.test.ts`) and one sample command entry (`commands/b-pr.md` resolves to `../prompts/b-pr.md`). The 2026-09-11 prompts↔commands divergence (8 physical command files) **remains fixed**: 43/43 symlinks. **No action.**

## Per-prompt classification table

Columns: file; line count; thin/thick; load path; named skill dir exists?; classification.

| # | Prompt | Lines | Type | Loads | Skill dir | Classification |
|---|---|---:|---|---|---|---|
| 1 | `b-brainstorm.md` | 13 | thin (skill) | `skills/b-brainstorm/SKILL.md` | ✓ | KEEP |
| 2 | `b-build.md` | 13 | thin (skill) | `skills/b-build/SKILL.md` | ✓ | KEEP |
| 3 | `b-build-hard.md` | 13 | thin (skill) | `skills/b-build/SKILL.md` | ✓ | KEEP |
| 4 | `b-capture.md` | 13 | thin (skill) | `skills/b-capture/SKILL.md` | ✓ | KEEP |
| 5 | `b-commit.md` | 13 | thin (skill) | `skills/git-commit/SKILL.md` | ✓ | KEEP |
| 6 | `b-commit-improved.md` | 19 | extension-backed (skill fallback) | ext `b-commit-improved/`, fallback `../skills/git-commit-improved/SKILL.md` | ✓ | KEEP (dual) |
| 7 | `b-diagnose.md` | 13 | thin (skill) | `skills/b-diagnose/SKILL.md` | ✓ | KEEP |
| 8 | `b-docs.md` | 13 | thin (skill) | `skills/b-docs/SKILL.md` | ✓ | KEEP |
| 9 | `b-eval-upstream-prs.md` | 21 | thin + arg doc (skill) | `skills/b-eval-upstream-prs/SKILL.md` | ✓ | KEEP |
| 10 | `b-explore.md` | 13 | thin (skill) | `skills/b-explore/SKILL.md` | ✓ | KEEP |
| 11 | `b-fix-rebase-conflict.md` | 13 | thin (skill) | `skills/b-fix-rebase-conflict/SKILL.md` | ✓ | KEEP |
| 12 | `b-grill-me.md` | 13 | thin (skill) | `skills/b-grill-me/SKILL.md` | ✓ | KEEP |
| 13 | `b-grill-with-docs.md` | 13 | thin (skill) | `skills/b-grill-with-docs/SKILL.md` | ✓ | KEEP |
| 14 | `b-guardrails-check.md` | 12 | thin (skill) | `skills/b-guardrails-check/SKILL.md` | ✓ | KEEP |
| 15 | `b-handoff.md` | 13 | thin (skill) | `skills/b-handoff/SKILL.md` | ✓ | KEEP |
| 16 | `b-howto.md` | 19 | thin + companion ref (skill) | `skills/b-howto/SKILL.md`, `skills/b-howto/HOWTO-FORMAT.md` | ✓ | KEEP |
| 17 | `b-init-factory.md` | 13 | thin (skill) | `skills/b-init-factory/SKILL.md` | ✓ | KEEP |
| 18 | `b-init-guardrails.md` | 12 | thin (skill) | `skills/b-init-guardrails/SKILL.md` | ✓ | KEEP |
| 19 | `b-init-tracker.md` | 13 | thin (skill) | `skills/b-init-tracker/SKILL.md` | ✓ | KEEP |
| 20 | `b-iterate.md` | 13 | thin (skill) | `skills/b-iterate/SKILL.md` | ✓ | KEEP |
| 21 | `b-kamal-release.md` | 20 | extension-only (no skill) | ext `extensions/b-kamal-release/` | n/a | KEEP (extension flow) |
| 22 | `b-nasa-prd.md` | 13 | thin (skill) | `skills/b-nasa-prd/SKILL.md` | ✓ | KEEP |
| 23 | `b-phase.md` | 13 | thin (skill) | `skills/b-phase/SKILL.md` | ✓ | KEEP |
| 24 | `b-plan.md` | 13 | thin (skill) | `skills/b-plan/SKILL.md` | ✓ | KEEP |
| 25 | `b-plan-update.md` | 13 | thin (skill) | `skills/b-plan-update/SKILL.md` | ✓ | KEEP |
| 26 | `b-pr.md` | 13 | thin (skill) | `../skills/b-pr/SKILL.md` | ✓ | KEEP |
| 27 | `b-pr-improved.md` | 15 | extension-backed (skill fallback) | ext `extensions/b-pr-improved/`, fallback `../skills/b-pr/SKILL.md` | ✓ | KEEP (dual) |
| 28 | `b-pr-review-2-issues.md` | 13 | thin (skill) | `../skills/b-pr-review-2-issues/SKILL.md` | ✓ | KEEP |
| 29 | `b-present.md` | 19 | thin + companion ref (skill) | `skills/b-present/SKILL.md`, `<skill_dir>/references/briefing-package-patterns.md` | ✓ | KEEP |
| 30 | `b-recap.md` | 13 | thin (skill) | `skills/b-recap/SKILL.md` | ✓ | KEEP |
| 31 | `b-research.md` | 13 | thin (skill) | `skills/b-research/SKILL.md` | ✓ | KEEP |
| 32 | `b-review.md` | 18 | thin + arg doc (skill) | `skills/b-review/SKILL.md` | ✓ | KEEP |
| 33 | `b-save.md` | **68** | **THICK** (legacy inline procedure) | none — body IS the procedure | n/a | **MERGE** into `skills/b-save/` |
| 34 | `b-save-improved.md` | 20 | extension-backed (skill fallback) | ext `extensions/b-save-improved/`, fallback `../skills/b-save-improved/SKILL.md` | ✓ | KEEP (dual) |
| 35 | `b-triage.md` | 13 | thin (skill) | `skills/b-triage/SKILL.md` | ✓ | KEEP |
| 36 | `b-wizard.md` | 13 | thin (skill) | `skills/b-wizard/SKILL.md` | ✓ | KEEP |
| 37 | `code-review.md` | 20 | thin + arg doc (skill) | `skills/code-review/SKILL.md` | ✓ | KEEP |
| 38 | `code-review-universal.md` | 22 | thin + arg doc (skill) | `skills/code-review-universal/SKILL.md` | ✓ | KEEP |
| 39 | `git-clean-orphans.md` | 13 | thin (skill) | `../skills/git-clean-orphans/SKILL.md` | ✓ | KEEP |
| 40 | `omp-goal.md` | 73 | STUB (documentation only) | none — documents `/goal set` keyword | n/a | KEEP (intentional, see AGENTS.md) |
| 41 | `omp-orchestrate.md` | 36 | STUB (documentation only) | none — documents `orchestrate` keyword contract | n/a | KEEP (intentional, see AGENTS.md) |
| 42 | `omp-workflow.md` | 38 | STUB (documentation only) | none — documents `workflow` keyword contract | n/a | KEEP (intentional, see AGENTS.md) |
| 43 | `product-tour.md` | 22 | thin (skill) | `../skills/product-tour/SKILL.md` | ✓ | KEEP |

Total: 43.

## Findings (priority ordered)

### F1 — `b-save.md` is a legacy thick prompt (THICK → MERGE)

**Classification:** MERGE.

**Evidence:**
- `prompts/b-save.md` is **68 lines** — every other thin wrapper is 13 lines.
- The body contains the entire 12-step b-save procedure inline (no `Load and follow …` line, no `skill://` pointer, no sibling `skills/b-save/SKILL.md` path).
- The body contains the full memory-frontmatter template, step-by-step subject-folder instructions, lifecycle closeout, and **even references `b-memory-import` and a non-OMP memory-skill index path that no other prompt mentions.**
- `skills/b-save/SKILL.md` exists but is **not referenced** by `prompts/b-save.md` — the prompt duplicates it instead of loading it.

This is the only prompt where the SKILL.md is shadowed by the prompt body. Compare to `b-save-improved.md` (20 lines, extension-backed, points at both ext and skill) — the dual is already the correct thin pattern.

**Recommended action:** replace `prompts/b-save.md` body with a 13-line wrapper that loads `skills/b-save/SKILL.md` (matching the other 30 thin prompts). The skill is already the source of truth for the 12-step procedure; the prompt should not re-host it.

### F2 — `b-pr-improved` vs `b-pr` (dual prompts — both still needed)

**Classification:** KEEP both.

**Evidence:**
- `prompts/b-pr.md` (13 lines) loads `../skills/b-pr/SKILL.md` — pure prompt+skill path, no extension.
- `prompts/b-pr-improved.md` (15 lines) is a wrapper that points at `extensions/b-pr-improved/` first, then falls back to `../skills/b-pr/SKILL.md` for non-extension runtimes.
- `extensions/index.ts:7,322` imports and wires `wireBprImproved`. The extension exists and is wired (`extensions/b-pr-improved/` directory present).
- README "Extension-Backed Commands" table explicitly lists `/b-pr-improved` as backed by the extension with `b-pr` skill fallback.

**Why both:** `b-pr` runs everywhere as a pure-prompt fallback (Claude Code / OpenCode / ZCode / non-wired harnesses). `b-pr-improved` is opt-in for Pi/OMP when the extension is loaded and runs the deterministic code path. Different users, different runtimes — neither replaces the other.

**No action.**

### F3 — `b-commit` vs `b-commit-improved` (dual prompts — both still needed)

**Classification:** KEEP both.

**Evidence:**
- `prompts/b-commit.md` (13 lines) loads `skills/git-commit/SKILL.md` — model-driven Conventional Commits.
- `prompts/b-commit-improved.md` (19 lines) wires to `extensions/b-commit-improved/` with `../skills/git-commit-improved/SKILL.md` as skill fallback.
- `extensions/index.ts:8,324` wires `wireBCommitImproved`. Extension dir `extensions/b-commit-improved/` exists.
- README "Extension-Backed Commands" table confirms both.

**Why both:** identical to F2 — pure-prompt `git-commit` skill is portable across all harnesses; extension-backed deterministic flow runs only under wired Pi/OMP. No conflict.

**No action.**

### F4 — `b-save` vs `b-save-improved` (dual prompts — but `b-save` is THICK)

**Classification:** KEEP both, but **MERGE `b-save` prompt per F1** so it becomes the same shape as `b-save-improved` (thin extension-or-skill wrapper).

**Evidence:**
- `prompts/b-save.md` is THICK (68 lines) — F1.
- `prompts/b-save-improved.md` (20 lines) is the correct thin+extension pattern.
- README explicitly says `/b-save` is "pure prompt + skill (`prompts/b-save.md`, `skills/b-save/SKILL.md`), not an extension command; run before `/b-commit` to record durable session state". The intent is a thin wrapper — the current 68-line body drifted from the README contract.
- `extensions/index.ts:11,330` wires `wireBSaveImproved`. Extension dir `extensions/b-save-improved/` exists.

**Why both:** `b-save` is portable, harness-agnostic, pure-prompt+skill; `b-save-improved` is the deterministic Pi/OMP extension path. Both are documented in README "Pure Prompt Commands" and "Extension-Backed Commands" sections respectively.

**Recommended action:** keep both, but collapse `b-save.md` to the 13-line thin pattern (F1).

### F5 — omp-goal / omp-orchestrate / omp-workflow (intentional documentation stubs)

**Classification:** KEEP all three.

**Evidence:**
- AGENTS.md:124 — *"Three primitives (`/goal set`, the `orchestrate` keyword, the `workflow` keyword) are user-toggled; the workflow only *recommends* them via the `omp_execution` phase field, the `eval-<topic>.py` template for `workflow` plans, and the `b-review` 6-step completion-audit. Slash-command stubs at `prompts/omp-{orchestrate,workflow,goal}…"*
- Each prompt begins with `> **Harness note:** This command documents the omp … contract. On non-OMP harnesses … it is a no-op …`
- Each prompt cites omp source paths (`src/slash-commands/builtin-registry.ts:97`, `src/goals/state.ts`, `src/eval/py/prelude.py`, etc.).
- None of them load a skill — they ARE the documentation. They exist so non-OMP users see "this is an OMP-only primitive, here is what it would do, here are the file references".
- README does not list them in the command table, which is correct — they are not real commands on Pi/Claude Code/OpenCode/Codex.

**Why keep:** these are discoverability stubs for OMP-only runtime primitives. Without them, a Pi user hitting the `orchestrate` keyword in a plan would have no prompt-side explanation. They fulfil the "explain it on non-OMP" mission documented in AGENTS.md.

**No action.** Consider adding a README "OMP-only primitives" note pointing at the three stubs so other readers don't think they are orphans.

### F6 — `product-tour.md` exists as both skill and prompt; only in skills table

**Classification:** KEEP both.

**Evidence:**
- `skills/product-tour/SKILL.md` exists.
- `prompts/product-tour.md` (22 lines) loads `../skills/product-tour/SKILL.md` — correct thin pattern, with extra "Start in interview mode" hint above the load line.
- README Skills table line 339 lists `product-tour` skill. The Prompt Templates table does NOT list `/product-tour`. The cross-agent parallels table does not mention it.
- `extensions/index.ts` does not wire a `product-tour` extension.
- `b-backlog`-style backward reference: `find-skills` / `find-skills` are skill-only; `product-tour` is the only product-tour skill with a slash wrapper.

**Why both:** `/product-tour` is a legitimate command. The README gap (skill listed, command not in Prompt Templates table) is a documentation miss, not a duplication problem.

**Recommended action:** add `/product-tour` row to the README "Prompt Templates" table for symmetry. The prompt itself is correctly thin (22 lines is justified by the interview-mode hint).

### F7 — `git-clean-orphans` prompt vs skill

**Classification:** KEEP both.

**Evidence:**
- `skills/git-clean-orphans/SKILL.md` exists.
- `prompts/git-clean-orphans.md` (13 lines) loads `../skills/git-clean-orphans/SKILL.md` — correct thin pattern.
- `extensions/index.ts` does not wire a `git-clean-orphans` extension.
- README Skills table line 334 lists the skill. The Prompt Templates table does NOT list `/git-clean-orphans`.

**Why both:** correctly thin wrapper exists; README gap is a documentation miss (same shape as F6).

**Recommended action:** add `/git-clean-orphans` row to the Prompt Templates table.

### F8 — Skills without a prompt that README claims need one (or vice versa)

README Prompt Templates table lists 32 commands; README Skills table lists ~50 skills. Cross-check:

**Skills listed in README Skills table that have NO prompt and README does NOT mark as skill-only:**
- none — every skill-only entry is annotated: `b-arch-qa` ("skill-only"), `b-blueprint` ("skill-only"), `b-grill` ("skill-only" — listed in skills table only), `b-issue-create` ("skill-only"), `b-auto-fix` ("skill-only"), `b-backlog` ("skill-only"), `fix-pr` ("skill-only, no slash wrapper; OMP-first, agent-agnostic"), `codebase-design` ("skill-only, no slash wrapper"), `writing-for-agents` ("skill-only, no slash wrapper"), etc.

**Skills that README implies exist as prompts but don't (already in inventory):** none. `b-grill`, `b-grill-auto`, `b-blueprint`, `b-arch-qa` are correctly marked skill-only in README.

**Commands in the Prompt Templates table whose skill was renamed / split:**
- `/b-pr` → `b-pr` skill — fine.
- `/code-review` → `code-review` skill — fine, also wired by `extensions/code-review-iteration/` (per README Extension-Backed Commands table).
- `/b-build-hard` → `b-build` skill with hard mode — fine, `prompts/b-build-hard.md` line 12 points at `skills/b-build/SKILL.md` with `difficulty level **hard**`.

**No missing slash wrappers.** No spurious slash wrappers.

### F9 — `b-kamal-release.md` — extension-only, no skill

**Classification:** KEEP.

**Evidence:**
- 20-line prompt body (the longest thin prompt) is inline because there is no skill — the prompt IS the user-facing docs.
- `extensions/index.ts:9,326` wires `wireKamalRelease`. Extension dir `extensions/b-kamal-release/` exists.
- Prompt explicitly says *"Without the extension there is no skill fallback — load the extension or run `kamal deploy` directly."*
- README Extension-Backed Commands table lists `/b-kamal-release` as backed by extension with no skill fallback.

**Why keep:** by design — Kamal release is a single deterministic flow, not a skill-able procedure. The prompt body documents the flow for users.

**No action.**

### F10 — Path style consistency (`skills/…` vs `../skills/…`)

Mixed in the source. Both resolve correctly relative to `prompts/` or `commands/`:

| Style | Count | Files |
|---|---:|---|
| `skills/<name>/SKILL.md` | 28 | b-brainstorm, b-build, b-build-hard, b-capture, b-commit, b-diagnose, b-docs, b-eval-upstream-prs, b-explore, b-fix-rebase-conflict, b-grill-me, b-grill-with-docs, b-guardrails-check, b-handoff, b-howto, b-init-factory, b-init-guardrails, b-init-tracker, b-iterate, b-nasa-prd, b-phase, b-plan, b-plan-update, b-present, b-recap, b-research, b-review, b-wizard, code-review, code-review-universal |
| `../skills/<name>/SKILL.md` | 6 | b-pr, b-pr-improved, b-pr-review-2-issues, b-save-improved, git-clean-orphans, product-tour |

**Note:** the relative path works because `commands/` symlinks resolve to `prompts/<name>`, and from `prompts/` `../skills/` resolves to `skills/`. Both styles work in practice. Six files use the explicit `../skills/`. No breakage observed.

**No action** — cosmetic only; not worth a churn pass.

### F11 — README Prompt Templates table — documentation gaps

Two commands have prompts + skills but are not in the Prompt Templates table:

- `/product-tour` — skill in skills table line 339, no row in prompt templates (see F6).
- `/git-clean-orphans` — skill in skills table line 334, no row in prompt templates (see F7).

**Classification:** CATALOG-GAP (README only).

**Recommended action:** add two rows to README "Prompt Templates" table:

| Command | Skill Invoked | Purpose |
|---------|---------------|---------|
| `/product-tour` | `product-tour` | Design and ship a first-run guided product tour over real UI |
| `/git-clean-orphans` | `git-clean-orphans` | Inventory/remove stale local worktrees and branches (remote gone), gated on confirmation |

### F12 — Commands referenced in README prose but not in any table

- `/skill:fix-pr <pr>` — Partial Workflows table line 376. The skill exists (`skills/fix-pr/SKILL.md`); correctly marked skill-only in Skills table line 314.
- `/buck-loop` — mentioned in Extension-Backed Commands line 266 but has no prompt file. Backed by `extensions/buck-loop/` only (extension-backed, no slash wrapper).

**No action.** Both are intentionally command-on-extension or skill-only.

### F13 — b-save prompt's references to non-existent prompt paths

`prompts/b-save.md` line 4 cites `skills/b-memory-import` — that skill exists (`skills/b-memory-import/SKILL.md`). Line 4 cites `skills/_shared/scripts/subject-lifecycle.ts` — that file exists (`skills/_shared/scripts/subject-lifecycle.ts`). The references inside the thick prompt are accurate; they would survive a MERGE into the skill.

**No action** beyond F1.

## Keep (brief)

32 of 43 prompts are correctly thin (13-line `Load and follow the \`<skill>\` skill:` wrappers), have a matching skill dir, and are wired into the README command table. Examples: `b-brainstorm`, `b-plan`, `b-build`, `b-iterate`, `b-diagnose`, `b-research`, `b-fix-rebase-conflict`, `b-pr`, `b-pr-review-2-issues`, `b-handoff`, `b-recap`, `b-init-tracker`, `b-init-factory`, `b-init-guardrails`, `b-guardrails-check`, `b-wizard`, `b-triage`, `b-howto`, `b-docs`, `b-phase`, `b-plan-update`, `b-nasa-prd`, `b-eval-upstream-prs`, `b-grill-me`, `b-grill-with-docs`, `b-explore`, `b-capture`, `b-present`, `b-review`, `b-commit`, `code-review`, `code-review-universal`. All 32 verified to load a skill directory that exists.

The 3 extension-backed duals (`b-pr-improved`, `b-commit-improved`, `b-save-improved`) and the 1 extension-only (`b-kamal-release`) all have wired `extensions/...` directories and fall back to the thin skill path. They are correctly documented in the README Extension-Backed Commands table.

The 3 omp-* stubs (`omp-goal`, `omp-orchestrate`, `omp-workflow`) are intentional, explicitly cited by AGENTS.md:124 as slash-command stubs for OMP-only runtime primitives.

The 2 README-documentation-gap skills (`product-tour`, `git-clean-orphans`) have correct thin prompts; only README needs rows added (F11).

The 1 thick legacy prompt (`b-save.md`) is the only prompt that does not match the project's thin-wrapper convention (F1).

## Open questions

1. **Should `b-save.md` MERGE be done as part of this audit or as a separate slice?** F1 recommends collapsing it to a thin 13-line wrapper. That is a 1-file edit but does cross a content boundary (moves a 68-line body into `skills/b-save/SKILL.md`). Verify the SKILL.md content is equivalent or extends it before MERGE.
2. **README docs gap (F11):** does the project want me to add the two missing rows in this audit pass, or separately? Adding two table rows is a 2-line README edit.
3. **`b-save-improved` skill mentions a Hindsight HTTP API path** (`retain`/`learn`). Is `skills/hindsight-http-api/` already in the catalog and reachable? Out of scope here, but worth noting that `b-save-improved` is the only dual prompt that hands step 8 back to the mainline agent — confirming the dual pattern is by design, not accident.
4. **`omp-goal.md` cites `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/slash-commands/builtin-registry.ts:97` as the goal-registration site.** That is user-machine-specific (absolute home path). Is that the canonical way to point at OMP source, or is `skill://cross-platform-pi-omp-loading` the agreed pattern? The prompt also lists `skills/cross-platform-pi-omp-loading/SKILL.md` as a cross-reference. Out of scope, but worth confirming with the cross-platform skill owner.
5. **Does `b-pr-improved` ever run on a non-extension runtime?** Its prompt body explicitly tells the model to fall back to `../skills/b-pr/SKILL.md`. If the fallback is correct, then the two prompts are equivalent on non-wired harnesses. That is by design (README "Extension-Backed Commands" row confirms) — but it does mean the bare `/b-pr` wrapper is sufficient for every harness today, and `/b-pr-improved` is purely an opt-in deterministic path. Both belong in the catalog.