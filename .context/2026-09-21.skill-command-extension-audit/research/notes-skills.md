# Skills audit — 2026-09-21

Branch `master` @ `7dc2aaf`. Working tree clean at ingest. Read-only audit of all 64 skill directories plus `skills/_shared/`. Slash-command existence is taken from `local://inventory.md` (verified, not re-derived). Inbound-reference sample is `grep` over `skills/`, `prompts/`, `extensions/`, `README.md`, `AGENTS.md`, `docs/*.md`, `THIRD-PARTY-NOTICES.md`.

Classification legend:
- **KEEP** — skill is load-bearing, has callers, no current redundancy.
- **DELETE** — duplicate / stale / unwired / no callers / no extra contract over a sibling.
- **MERGE** — duplicate contract with another skill, fold one into the other.
- **PROJECT-SPECIFIC** — single-project or single-machine skill with no portable value; should be moved out of the published npm package.
- **CATALOG-GAP** — surface the gap (an unwired extension, a missing script, or a missing prompt wrapper), do not delete.

Every entry has: frontmatter-derived one-line purpose, slash prompt (per inventory), helper scripts present, broken path / missing script check, DEPRECATED/tombstone language check, inbound-reference sample.

---

## Findings (priority ordered)

### DELETE — `b-grill`

- **Purpose**: "Relentlessly stress-test a plan or design through structured interviewing. Mode 'user' interviews the user directly; mode 'auto' sends questions to a different AI model via RPC."
- **Prompt**: None (skill-only).
- **Helpers**: `skills/b-grill/grill.py` (RPC helper).
- **Broken paths**: None — `grill.py` exists, referenced SKILL.md lines 177–187.
- **Deprecated banners**: None in this file.
- **Inbound refs**: None. `prompts/`, `extensions/`, `README.md`, `AGENTS.md`, `docs/*.md` do not mention `b-grill` by that name. The `docs/buck-workflow.md:65` line says `b-grill (skill-only) … unified grill skill with user/auto modes`, but the SKILL.md itself documents two separate skills (`/skill:b-grill-me`, `/skill:b-grill-auto`, `/skill:b-grill-with-docs`) and the inventory already counts `b-grill`, `b-grill-me`, `b-grill-auto`, `b-grill-with-docs` as four separate skill dirs.
- **Evidence**: `skills/b-grill/SKILL.md:1–27` describe b-grill as a unified shell over b-grill-me (user) + b-grill-auto (auto), but no caller — agent or prompt — invokes `/skill:b-grill`. Both b-grill-me and b-grill-auto are independently loadable by name. The shell mode adds no contract that the children don't already carry (frontmatter shape, decision-tree questions, threshold semantics are duplicated verbatim).
- **Recommended action**: DELETE `skills/b-grill/` (and its `grill.py`). Leave `b-grill-me`, `b-grill-auto`, `b-grill-with-docs` as the canonical trio. Update `docs/buck-workflow.md:65` line to remove the `b-grill (skill-only)` entry.

### MERGE / DELETE — `b-grill-auto` SKILL.md vs `extensions/b-grill-auto/`

- **Purpose**: "Interview a different AI model relentlessly about a plan or design, tracking decision-tree complexity as metadata."
- **Prompt**: None (skill-only).
- **Helpers**: `skills/b-grill-auto/grill.py` exists; `extensions/b-grill-auto/` (4 .ts files + tests) is unwired.
- **Broken paths**: None.
- **Deprecated banners**: `SKILL.md:8` says "**Note**: This is a skill-only workflow. Invoke `/skill:b-grill-auto` (or `/skill:b-grill auto`); the historical extension directory is not wired into the runtime."
- **Inbound refs**: `b-grill/SKILL.md` references `b-grill-auto` as the auto-mode name. `extensions/b-grill-auto/` is **not wired** into `extensions/index.ts` (per `extensions/index.ts` wires `wireTpsTracker, wireBprImproved, wireBCommitImproved, wireKamalRelease, wirePlanArtifact, wireBSaveImproved, wireCodeReviewIteration, wireBuckLoop` plus inlined model auto-switch — see inventory and `docs/extension-loading.md:131`).
- **Evidence**: Two implementations, one of them unwired. The skill's procedure is self-contained via `grill.py`; the extension is the dead twin.
- **Recommended action**: MERGE — keep `skills/b-grill-auto/SKILL.md` (it is the working contract used via `/skill:b-grill-auto`), DELETE `extensions/b-grill-auto/` (already unwired). If the extension directory survives, fold `grill.py` into it and convert the SKILL.md into a thin pointer.

### MERGE — `b-save-improved` / `b-save`

- **Purpose (b-save-improved)**: "Deterministic session-record checkpoint — code-driven counterpart to the b-save skill. Runs preflight, two model roles (scribe + auditor), and apply."
- **Purpose (b-save)**: "Record session history — checkpoint memory, backlog, cross-references, and optional OMP retain."
- **Prompts**: Both — `prompts/b-save.md`, `prompts/b-save-improved.md`.
- **Helpers**: `b-save-improved/scripts/save-preflight.ts`, `save-apply.ts` (+ tests). `b-save` has no scripts (pure prompt).
- **Broken paths**: None.
- **Deprecated banners**: `b-save-improved/SKILL.md:13` explicitly says "`/b-save` remains the portable fallback for harnesses without this extension; this skill does not replace it."
- **Inbound refs**: Both in `AGENTS.md:99` and `docs/buck-workflow.md:69`. Both wired (b-save as pure prompt; b-save-improved via extension).
- **Evidence**: `docs/extension-loading.md:107` lists "Diverged twins … `b-save-improved.md`: the thin skill-loader stub body won and now lives in `prompts/` — the full duplicate prompt bodies had gone stale against their `SKILL.md` counterparts, and the `*-improved` stubs document the extension-vs-skill fallback path that matters on both runtimes." This is the design intent: `b-save` = portable fallback, `b-save-improved` = the deterministic extension's contract.
- **Recommended action**: KEEP both, but flag this as the **canonical "improved twin" pattern** — they're not duplicates to merge, they're a layered contract.

### MERGE — `git-commit-improved` / `git-commit`

- **Purpose (git-commit-improved)**: "Deterministic Conventional Commits — code-driven counterpart to the git-commit skill."
- **Purpose (git-commit)**: "Create a Conventional Commits message from staged changes and commit immediately."
- **Prompts**: `prompts/b-commit.md` (loads git-commit), `prompts/b-commit-improved.md`.
- **Helpers**: `git-commit-improved/scripts/commit-preflight.ts`. None in `git-commit/`.
- **Broken paths**: None.
- **Deprecated banners**: `git-commit-improved/SKILL.md:36` says "For cross-platform usage without the extension, follow the procedure in `skills/git-commit/SKILL.md` exactly."
- **Inbound refs**: Both wired.
- **Evidence**: Same pattern as b-save/b-save-improved. Documented twin pattern in `docs/extension-loading.md:107`.
- **Recommended action**: KEEP both, same rationale as b-save.

### PROJECT-SPECIFIC — `node5-code-review`

- **Purpose**: "Review code changes for correctness, security, data integrity, and edge cases in the node5 project."
- **Prompt**: None (skill-only).
- **Helpers**: None.
- **Broken paths**: None.
- **Inbound refs**: `README.md:336` lists it. `THIRD-PARTY-NOTICES.md` does not attribute it. No skills, prompts, or extensions reference it. Structurally near-identical to `code-review-universal` (same six review areas: migrations, integrations, new features, provisioning, frontend, seeds/permissions) with project-specific copy.
- **Evidence**: `SKILL.md:2` literally says "in the node5 project" — the project is hard-coded. The six review areas are not node5-specific; they exist already in `code-review-universal/reference/`. The only unique contribution is "completes the matrix for a plan/spec contract," which `code-review-universal` also does.
- **Recommended action**: PROJECT-SPECIFIC — move to the node5 repo, or DELETE and rely on `code-review-universal` + `code-review` (release PR variant).

### PROJECT-SPECIFIC — `rails-app`

- **Purpose**: "Reference for Rails app conventions and gotchas — subpath deployment, Tailwind build coupling, test/assertion patterns, BEM theming."
- **Prompt**: None (skill-only). No prompt loads it.
- **Helpers**: None.
- **Inbound refs**: `README.md:327` lists it. No other skill, prompt, or extension references it. `THIRD-PARTY-NOTICES.md` does not attribute it.
- **Evidence**: Nine sections of project-specific Rails gotchas (subpath deployment, Tailwind build, `assert_select` patterns, BEM, theme system, etc.) referencing one app's tokens (`pp-*`, `snapselect` theme, `magic_links`, `app/assets/tailwind/application.css`). Useless outside that one Rails app.
- **Recommended action**: PROJECT-SPECIFIC — move to the Rails project that owns those tokens (likely `partypix` per `git-clean-orphans` SKILL.md example references).

### PROJECT-SPECIFIC — `llm-wiki-vault`

- **Purpose**: "Vault-native LLM Wiki for Obsidian PARA vaults."
- **Prompt**: None (skill-only).
- **Helpers**: None.
- **Inbound refs**: `AGENTS.md:96` lists it (only docs hit). `README.md:334` lists it.
- **Evidence**: SKILL.md frontmatter `version: 1.0.0`, `author: wooderson` — personal authorship. Vault path is a single user ("Buckley's vault"). The `obsidian-cli` skill in the global registry already covers Obsidian vault interaction.
- **Recommended action**: PROJECT-SPECIFIC — fork to the user's personal package or generalize. Cheapest fix: rebrand as one user's specialization, not the package's general-purpose LLM Wiki skill.

### PROJECT-SPECIFIC — `manage-herdr-panes`

- **Purpose**: "Split, start, prompt, and read Herdr panes — especially omp in a sibling pane."
- **Prompt**: None (skill-only).
- **Helpers**: None.
- **Break**: `SKILL.md:11` has a hard `test "${HERDR_ENV:-}" = 1` gate — refuses to run unless Herdr is set up.
- **Inbound refs**: `README.md:335` lists it. No skill, prompt, or extension references it. `docs/buck-workflow.md` does not mention Herdr.
- **Evidence**: Single external tool integration, gated on `HERDR_ENV=1`. The companion skill `herdr` (in the global skill registry, not this repo) is the authoritative reference.
- **Recommended action**: PROJECT-SPECIFIC — keep only if the publisher intends `buck-workflow-pi` to be the home for all Herdr users. Otherwise move to a separate package.

### CATALOG-GAP — `b-arch-qa` is skill-only with no prompt wrapper and no self-declared intent

- **Purpose**: "Run a live Q&A exploration session about architecture, codebase structure, or technology choices."
- **Prompt**: None (skill-only).
- **Helpers**: None.
- **Inbound refs**: `README.md:281`, `docs/buck-workflow.md:63` and `:438` list it. No prompt wrapper. No extension.
- **Evidence**: Skill-only is intentional for several skills (`b-issue-create`, `b-auto-fix`, `fix-pr`, `codebase-design`, `writing-for-agents`) — those explicitly state it in the SKILL.md. `b-arch-qa` does not declare this intent in the SKILL.md frontmatter.
- **Recommended action**: KEEP, but add the explicit "skill-only, no prompt wrapper" annotation to the SKILL.md to mirror the pattern in `fix-pr`, `codebase-design`, `writing-for-agents`. This is a missing self-declaration, not a DELETE.

### DELETE — `thought-dump-writer`

- **Purpose**: "Dictate/dump raw thoughts turn-by-turn into a single living markdown document with light editorial cleanup and a git checkpoint after every change."
- **Prompt**: None (skill-only).
- **Helpers**: SKILL.md ships a 60-line `checkpoint.sh` template inline (must be copied out by the user per session). No skill-side script.
- **Inbound refs**: `README.md:340` lists it. `AGENTS.md` and `docs/*.md` do not mention it. `docs/buck-workflow.md:74` lists it as skill-only. No other skill or prompt invokes it.
- **Evidence**: `b-capture/SKILL.md` already covers the same surface: "Live note-taking mode — the user dumps thoughts (often dictated, messy) and a subagent writes durable rough notes the same turn. Do not tidy or synthesize until the user says so." Three differences: (1) `b-capture` writes to a subject folder with multiple entry files; `thought-dump-writer` writes to a single user-named file. (2) `b-capture` does not git-checkpoint per turn; `thought-dump-writer` does. (3) `b-capture` uses a subagent; `thought-dump-writer` writes inline. The git-checkpoint behavior is the only unique contract.
- **Recommended action**: MERGE into `b-capture` — add a "single-file mode" option to `b-capture` that takes a target file path and a git checkpoint. Delete `thought-dump-writer`.

### DELETE — `crawl4ai`

- **Purpose**: "Deep website crawling and content extraction with Crawl4AI."
- **Prompt**: None (skill-only).
- **Helpers**: None (the skill is pure guidance — bootstrap checks + sample Python code).
- **Inbound refs**: `b-research/SKILL.md:111` says "For deep website crawling or bulk extraction, invoke the `crawl4ai` skill." `docs/buck-workflow.md:571` lists it.
- **Evidence**: The skill is a thin wrapper around the [Crawl4AI](https://github.com/unclecode/crawl4ai) CLI. All the contract is "install crawl4ai, run `crawl4ai crawl …`, parse output." There is no Buck-specific contract — no `.context/` lifecycle, no subject resolution, no cross-reference stitching. It's documentation for a third-party CLI.
- **Recommended action**: DELETE the skill — the bootstrap guidance already lives in `b-research/SKILL.md` as a paragraph. Folding the bootstrap section into `b-research` and deleting the standalone skill is the same outcome.

### DELETE — `skill-explainer`

- **Purpose**: "Explain what a skill or slash-command actually does and produce a visual HTML report of it."
- **Prompt**: None (skill-only).
- **Helpers**: `scripts/render.py` (real), `assets/template.html` (template), `references/schema.md`.
- **Inbound refs**: `docs/buck-workflow.md:51` lists it as "skill-only." No prompt wrapper. No extension. No callers discovered in the audit.
- **Evidence**: Documentation/visualization utility, not a workflow skill. Reads another skill and emits HTML. There is no `.context` lifecycle, no subject, no cross-reference. It's a one-off generator that makes sense as a `scripts/` utility but not as a loadable skill.
- **Recommended action**: DELETE the skill — keep `scripts/render.py` and `assets/template.html` as a one-off tool under `tools/skill-explainer/` (or as part of `b-docs`' reference). Drop the skill description to free a description-match context slot.

### DELETE — `pi-rpc`

- **Purpose**: "Drive a pi-coding-agent subprocess via its JSON RPC protocol over stdin/stdout."
- **Prompt**: None (skill-only).
- **Helpers**: `scripts/pi-prompt.py` (real), `reference.md` (real).
- **Inbound refs**: `docs/buck-workflow.md` does not mention it. `README.md:337` lists it. `extensions/index.ts` does not import it. No skill or prompt uses it.
- **Evidence**: Documentation of the `pi --mode rpc` JSON RPC protocol. Duplicates the official Pi docs (`docs/rpc.md` upstream; the skill's `reference.md` is a near-copy). `scripts/pi-prompt.py` is a 60-line wrapper around `subprocess` for one-shot prompts — useful, but tiny.
- **Recommended action**: DELETE the skill — link to upstream Pi docs in a single line of `b-grill-auto` (which actually uses the same protocol). The `pi-prompt.py` helper, if useful, can live under `extensions/b-grill-auto/scripts/`.

### DELETE — `cross-platform-pi-omp-loading`

- **Purpose**: "Author a package that loads cleanly under both Pi and OMP from a single source-of-truth checkout."
- **Prompt**: None (skill-only).
- **Helpers**: None.
- **Inbound refs**: `docs/buck-workflow.md:99, 184, 187`, `prompts/omp-goal.md`, `prompts/omp-orchestrate.md`, `prompts/omp-workflow.md` reference this skill by path.
- **Evidence**: Meta-documentation for the package itself (package author facing, not user facing). Only relevant to maintainers of `buck-workflow-pi` or another cross-platform package. Will never fire from a description-match agent query because the trigger conditions are about publishing, not task-time use.
- **Recommended action**: MOVE — keep the content but relocate to `docs/cross-platform-package-loading.md` (or merge into `docs/extension-loading.md`). Drop the skill folder.

### CATALOG-GAP — `_shared` is registered as a skill but is an internal library

- **Purpose**: "Shared resources and cross-skill protocols. Internal skill that re-exports content from skills/_shared/* so other skills can reference it via skill://_shared/<file>."
- **Prompt**: None (intentional; library).
- **Helpers**: `scripts/render-design-tokens.ts`, `scripts/subject-lifecycle.ts`, `scripts/context-helpers.ts` (+ tests), `scripts/design-language.test.ts`. `design-brief.jsonc` (canonical design brief), `subject-resolution.md` (protocol).
- **Inbound refs**: ~20 skills and many prompts load from `skill://_shared/<file>`. Documented in `docs/buck-workflow.md:18` as "the only supported writer for subject lifecycle fields."
- **Evidence**: `_shared/SKILL.md:1` says "Internal skill that re-exports content from skills/_shared/*." Loading `_shared/SKILL.md` as a description-frontmatter-bearing skill does nothing useful — there is no description to match. Other skills load specific files from `_shared/` directly, not the SKILL.md body.
- **Recommended action**: KEEP, but explicitly mark as "library, not a skill" in catalog listings. `inventory.md` already separates "Skills without prompt (29)" but does not flag library dirs. Add a `library: true` field or a separate inventory bucket.

### CATALOG-GAP — `b-grill-auto` and `b-grill` Python helper duplicated in skills tree

- **Helpers**: `skills/b-grill-auto/grill.py` (Python, 411 lines); `skills/b-grill/grill.py` (same script, separate copy).
- **Evidence**: A Python helper inside a "skills" tree is inconsistent with the rest of the package (TypeScript + Bun scripts everywhere else). Two copies.
- **Recommended action**: After the b-grill/b-grill-auto merge above, move `grill.py` to a canonical location. Python files do not belong in `skills/`.

### MERGE — `b-grill-with-docs` overlaps with `b-grill-me`

- **Purpose (b-grill-with-docs)**: "Interview the user relentlessly about a plan while challenging it against existing domain documentation (CONTEXT.md, ADRs)."
- **Purpose (b-grill-me)**: "Interview the user relentlessly about a plan or design, tracking decision-tree complexity as metadata."
- **Helpers**: b-grill-with-docs ships `ADR-FORMAT.md` and `CONTEXT-FORMAT.md`; b-grill-me has no helpers.
- **Inbound refs**: Both in `docs/buck-workflow.md:410–411`.
- **Evidence**: `b-grill-with-docs/SKILL.md` is literally `b-grill-me` with a CONTEXT.md/ADRs awareness preamble and a documented `auto-derive` workflow-kernel cell algorithm. Session file shape, threshold tracking, decision-tree questions, and frontmatter are identical. The only contract beyond `b-grill-me` is "challenge the user against `CONTEXT.md` and `docs/adr/`" — which the agent should do when those files exist regardless of which skill is loaded.
- **Recommended action**: MERGE — fold `b-grill-with-docs` into `b-grill-me`. Move `ADR-FORMAT.md` and `CONTEXT-FORMAT.md` to `docs/adr-format.md` and `docs/context-format.md`. Skill-only invocation means no API breakage.

### CATALOG-GAP — `codebase-design` and `writing-for-agents` are reference docs masquerading as skills

- **Purpose (codebase-design)**: "Shared vocabulary for designing deep modules … Model-invoked reference."
- **Purpose (writing-for-agents)**: "Writing documents agents consume."
- **Prompt**: None (skill-only, intentionally).
- **Helpers**: `codebase-design/DESIGN-IT-TWICE.md`, `DEEPENING.md`; `writing-for-agents/SKILL-MECHANICS.md`.
- **Inbound refs**: `b-diagnose/SKILL.md:18` references `codebase-design`. Both listed in `docs/buck-workflow.md`. No prompt wrapper.
- **Evidence**: Both declare themselves "model-invoked reference" and the writers chose not to register a slash-command wrapper on purpose (per their SKILL.md frontmatter). They're effectively docs that the agent loads via skill:// when needed.
- **Recommended action**: KEEP — but flag them as a separate "Reference skills (no slash wrapper, loaded by skill://)" bucket in `inventory.md` for future audits. They have no caller by design.

### MERGE — `design-brief` overlaps `b-create-ux-guide` and `b-create-styleguide`

- **Purpose (design-brief)**: "Turn design context, screenshots, files, plain-language descriptions, and subject-folder artifacts into an implementation-ready UI design brief."
- **Helpers**: None.
- **Inbound refs**: Listed only in `README.md:326`.
- **Evidence**: Output shape (JSONC brief), procedure (orient via subject folder, extract visible+inferred facts, infer responsive breakpoints, hand off with developer prompt) overlaps both `b-create-ux-guide` (engineering-side design brief into design-brief.json) and `b-create-styleguide` (visual styleguide + design-brief.json). `design-brief` is a thin wrapper that produces one of three artifacts the other two skills produce.
- **Recommended action**: MERGE — fold `design-brief` into `b-create-ux-guide` as a "design brief only" mode (`b-create-ux-guide --brief-only`).

### KEEP (with confirmation) — `b-blueprint` vs `b-present`

- **Evidence**: `b-blueprint` is "one HTML file, technical poster." `b-present` is "multi-page static site, briefing package." Both consume plans/phases/brainstorms. The disambiguation table in `b-blueprint/SKILL.md:62–69` is honest: "both can coexist." No redundancy. KEEP.

### KEEP — `codebase-design` and `writing-for-agents` (reference skills)

See CATALOG-GAP entry above. Real callers (`b-diagnose` for `codebase-design`; skill-writing workflow for `writing-for-agents`). KEEP, mark as reference skills in inventory.

### KEEP — `b-backlog`, `b-auto-fix`, `b-init-factory`, `b-init-guardrails`, `b-init-tracker`

- All four listed in `README.md:283–303` and `docs/buck-workflow.md` as skill-only or prompt+skill with no obvious redundancy.
- `b-backlog` and `b-auto-fix` have clear contracts: subagent-dispatched backlog item authoring; per-issue b-research→b-plan→b-build→b-review in a worktree. Both have real CLI scripts (`auto-fix/scripts/auto-fix.ts`, no script in `b-backlog`).
- `b-init-factory`, `b-init-guardrails`, `b-init-tracker` are one-shot inits with clear idempotency contracts (see `b-init-guardrails/SKILL.md:11–13` "**Idempotent**: safe to re-run"). Real callers: `b-init-guardrails` is in `AGENTS.md:141–155` as a managed block; `b-init-tracker` is in `docs/agents/issue-tracker.md` as the configuring skill.
- No duplicates. KEEP all.

### KEEP — `b-brainstorm`, `b-build`, `b-capture`, `b-diagnose`, `b-docs`, `b-eval-upstream-prs`, `b-explore`, `b-fix-rebase-conflict`, `b-grill-me`, `b-handoff`, `b-hindsight-import-projects`, `b-howto`, `b-iterate`, `b-memory-import`, `b-nasa-prd`, `b-phase`, `b-plan`, `b-plan-update`, `b-pr`, `b-pr-review-2-issues`, `b-recap`, `b-research`, `b-review`, `b-triage`, `b-wizard`, `code-review`, `code-review-universal`, `code-smells`, `fix-pr`, `git-clean-orphans`, `product-tour`, `run-in-idle-pane`, `b-issue-create`

- All have inbound refs from prompts, extensions, README, AGENTS, or docs. Real script files where applicable.
- `code-review-universal` and `code-review` both wired (portable + extension). Distinct contracts.
- `b-hindsight-import-projects` is a documented multi-project wrapper over `b-memory-import`; both KEEP.
- `fix-pr` is skill-only by design (per its own SKILL.md:27).
- `b-issue-create` is skill-only with a real AFK-ready contract.
- `product-tour` has wired prompt + real bridge contract.
- `run-in-idle-pane` has real `scripts/find_idle_pane.sh`.

---

## Keep (summary table)

| Skill | Status | Notes |
|---|---|---|
| _shared | KEEP + library flag | Internal library, mark as library in inventory |
| b-arch-qa | KEEP + self-declare | Skill-only, add explicit self-declaration |
| b-auto-fix | KEEP | Real CLI script |
| b-backlog | KEEP | Subagent-dispatched, real contract |
| b-blueprint | KEEP | Distinct from b-present by design |
| b-brainstorm | KEEP | Wired prompt |
| b-build | KEEP | Wired prompt + hard/standard variants |
| b-capture | KEEP | Note-taking mode, MERGE thought-dump-writer into it |
| b-create-styleguide | KEEP | Real managed-block contract |
| b-create-ux-guide | KEEP | Real three-deliverable contract, MERGE design-brief into it |
| b-diagnose | KEEP | Real discipline |
| b-docs | KEEP | Real living-docs contract |
| b-eval-upstream-prs | KEEP | Wired prompt, real procedure |
| b-explore | KEEP | Wired prompt |
| b-fix-rebase-conflict | KEEP | Wired prompt + real analyze script |
| b-grill | DELETE | No callers; b-grill-me + b-grill-auto are the canonical pair |
| b-grill-auto | MERGE / DELETE | Keep SKILL.md, delete unwired `extensions/b-grill-auto/` |
| b-grill-me | KEEP | MERGE b-grill-with-docs into it |
| b-grill-with-docs | MERGE into b-grill-me | |
| b-guardrails-check | KEEP | Real deterministic runner |
| b-handoff | KEEP | Real portable handoff doc |
| b-hindsight-import-projects | KEEP | Wrapper over b-memory-import |
| b-howto | KEEP | Real Diátaxis format |
| b-init-factory | KEEP | Idempotent |
| b-init-guardrails | KEEP | Idempotent, managed block |
| b-init-tracker | KEEP | Idempotent, managed block |
| b-issue-create | KEEP | Real AFK-ready contract |
| b-iterate | KEEP | Real follow-up contract |
| b-memory-import | KEEP | Deterministic Bun script |
| b-nasa-prd | KEEP | Real PRD authoring discipline |
| b-phase | KEEP | Real phase decomposition |
| b-plan | KEEP | Real bounded-planning contract |
| b-plan-update | KEEP | Real in-place revision |
| b-pr | KEEP | Real PR creation |
| b-pr-review-2-issues | KEEP | Real PR comment ingestion |
| b-present | KEEP | Distinct from b-blueprint by design |
| b-recap | KEEP | Read-only orientation |
| b-research | KEEP | Wired prompt |
| b-review | KEEP | Real two-axis review contract |
| b-save | KEEP | Portable fallback (twin with b-save-improved) |
| b-save-improved | KEEP | Deterministic extension (twin with b-save) |
| b-triage | KEEP | Real triage state machine |
| b-wizard | KEEP | Real wizard generator |
| code-review | KEEP | Release PR variant + extension iteration |
| code-review-universal | KEEP | Language-agnostic PR review |
| code-smells | KEEP | Real 23-smell catalog + audit |
| codebase-design | KEEP | Mark as reference skill in inventory |
| crawl4ai | DELETE | Thin wrapper around third-party CLI; fold into b-research |
| cross-platform-pi-omp-loading | DELETE / MOVE | Relocate to docs/ |
| design-brief | MERGE into b-create-ux-guide | |
| fix-pr | KEEP | Skill-only by design |
| git-clean-orphans | KEEP | Real procedure |
| git-commit | KEEP | Portable fallback (twin with git-commit-improved) |
| git-commit-improved | KEEP | Deterministic extension (twin with git-commit) |
| llm-wiki-vault | PROJECT-SPECIFIC | Move to personal package or generalize |
| manage-herdr-panes | PROJECT-SPECIFIC | Single-tool integration |
| node5-code-review | PROJECT-SPECIFIC | Move to node5 repo or DELETE |
| pi-rpc | DELETE | Duplicates upstream Pi docs |
| product-tour | KEEP | Wired prompt + real bridge contract |
| rails-app | PROJECT-SPECIFIC | Move to Rails project that owns the tokens |
| run-in-idle-pane | KEEP | Real script, note overlap with global tmux-dev-server |
| skill-explainer | DELETE | Visualization utility masquerading as skill |
| thought-dump-writer | MERGE into b-capture | |
| writing-for-agents | KEEP | Mark as reference skill in inventory |

---

## Open questions

1. **b-grill vs b-grill-me vs b-grill-auto**: The SKILL.md of `b-grill` claims to be a unified shell with two modes; `b-grill-me` and `b-grill-auto` are listed as standalone skills in inventory. `b-grill/SKILL.md` itself is the only place that treats them as modes of one skill. Should we (a) DELETE `b-grill` and keep the separated children, or (b) MERGE the children into `b-grill` and treat `b-grill-me`/`b-grill-auto` as deprecated aliases?

2. **b-grill-auto extension unwired state**: `extensions/b-grill-auto/` is not wired into `extensions/index.ts`. The skill SKILL.md at line 8 says "the historical extension directory is not wired into the runtime." Is the extension directory aspirational (intentional dead code for parity with `b-save-improved`/`b-commit-improved`) or should it be deleted?

3. **`b-grill/grill.py` Python helper**: Two copies (`skills/b-grill/grill.py`, `skills/b-grill-auto/grill.py`). Same script. Move to one canonical location. Where? `tools/grill.py`? `extensions/b-grill-auto/scripts/grill.py`?

4. **`_shared` as a skill**: `_shared/SKILL.md` exists, but it's a registration shim for `skill://_shared/<file>` URLs. Other skills load specific files from `_shared/` directly, not the SKILL.md. Should the SKILL.md be deleted and `_shared/` reclassified as a library dir? Or kept as the registration shim it claims to be?

5. **Python helper in skills tree**: `b-grill/grill.py` and `b-grill-auto/grill.py` are Python files in a TypeScript/Bun-dominant skills tree. After merge, where does the Python go?

6. **`thought-dump-writer` vs `b-capture`**: Both serve "user dumps thoughts, agent files." Different output modes (single file vs subject tree) and different subagent usage (none vs one). Worth a flag (`b-capture --mode single-file`) or two skills?

7. **DESIGN-IT-TWICE / DEEPENING.md** are filed under `codebase-design/`. They look like references for the `design-an-interface` skill (which lives in the global skill registry, not this repo). Should they move to a sibling `references/` or stay bundled with `codebase-design`?

8. **`b-pr-improved` lives only as a prompt + extension; no `skills/b-pr-improved/`** — see notes-prompts.md for the prompt/command audit. The skill `b-pr` is the fallback; the prompt is a thin wrapper. Same pattern as `b-commit-improved` / `b-save-improved`. Confirms the dual-mode pattern is intentional, not an oversight.

9. **`b-build-hard` lives as `prompts/b-build-hard.md` only**, no skill dir. The skill `b-build` documents both modes (standard and hard) in its own SKILL.md. So `b-build-hard` is a prompt-only alias for "use b-build in hard mode." This is fine — confirm it's intentional (looks like a UX nicety, not duplication).

10. **`manage-herdr-panes` gate `HERDR_ENV=1`**: The skill refuses to do anything unless the host machine has Herdr running. If a user installs `buck-workflow-pi` without Herdr, the skill sits in context costing description-match loads. Should the description be tightened to make the trigger condition ("only on a machine with Herdr") more explicit, or move the skill to a separate package?
