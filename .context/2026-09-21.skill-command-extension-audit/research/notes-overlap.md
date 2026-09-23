# Overlap clusters — 2026-09-21 skill/command/extension audit

Branch: `master` @ `7dc2aaf`. Read-only audit. Each cluster: classification, evidence, single recommended action.

Cross-cutting evidence anchors used throughout:

- README skill table `README.md:269-341` lists every skill (skill-only or prompt+skill) and the prompt/command table `README.md:216-240`.
- `docs/buck-workflow.md` "Primitives" table `docs/buck-workflow.md:40-83` and "Quick reference" `docs/buck-workflow.md:404-454` are the canonical cross-references.
- `extensions/index.ts:11-13, 330-334` is the only extension composition entry; `wireCodeReviewIteration` is wired; `b-grill-auto/` and `grill-me-dialog.ts` are not imported (confirmed by `docs/buck-workflow.md:83`).
- 2026-09-11 prompts↔commands divergence is fixed (43/43 symlinks); not a current finding.

---

## Findings (priority ordered)

### Cluster 1 — Review

**Members:** `skills/code-review`, `skills/code-review-universal`, `skills/node5-code-review`, `skills/b-review`, `skills/b-pr-review-2-issues`, `skills/fix-pr`, `extensions/code-review-iteration/`.

**Evidence:**

- `code-review/SKILL.md` (release-PR review, brutally-honest tone, writes per-PR review files at `/mnt/c/Code/plans/review-PR-<N>-<slug>.md`).
- `code-review-universal/SKILL.md` already documents the relationship explicitly: `b-review` = workflow gate; `code-review-universal` = language-depth reviewer; `code-review` = brutally-honest variant; `b-pr-review-2-issues` = inverse (ingest comments into a plan).
- `node5-code-review/SKILL.md` ends with: "This skill is a **complement** to `code-review` (brutally honest, PR-aware)…". Domain-specific checklist (migrations, integrations, seeding, RBAC) for a single project, plus plan-contract verification.
- `b-review/SKILL.md:107-126` defines a two-axis review (spec-contract + standards fan-out seeded with `code-review-universal` guides + diff-scoped `code-smells` subset). Standards axis is the role `code-review-universal` plays.
- `b-pr-review-2-issues/SKILL.md` is the comment-ingest direction (no review posting, no code mutation). Stops at a plan artifact.
- `fix-pr/SKILL.md` "Not the same as" table makes it explicit it does **not** post reviews; it acts on them.
- `extensions/code-review-iteration/index.ts` is the wired local Reviewer→Fixer→Reviewer loop for `/code-review` (per `docs/buck-workflow.md:73, 331-332, 448`).

**Classification / recommendation:**

- **MERGE** `node5-code-review` → delete; its domain checklist (migrations/integrations/seeds/RBAC) is project-specific and the cross-reference paragraph already admits it is a complement, not a stand-alone. The `mattpocock` adoption plan even tags project-specific skills as out-of-scope for the portable package (`.context/2026-09-10.mattpocock-skills-overlap/research-mattpocock-skills-overlap.md`).
- **KEEP-DISTINCT** the four remaining roles: `b-review` (gate), `code-review-universal` (language-depth reviewer + posts GitHub), `code-review` + `code-review-iteration/` (local Reviewer/Fixer loop, wired), `b-pr-review-2-issues` (comment-ingest → plan), `fix-pr` (comment-ingest → act). The skill descriptions already articulate this layering. No duplication; each has a non-overlapping role in the spine.

**Action:** DELETE `node5-code-review`. Keep the other six. The five non-project-specific review skills are intentional layering (workflow gate / language reviewer / local iteration / plan extraction / code-action); the cross-references in each `SKILL.md` already prove the boundaries are explicit.

---

### Cluster 2 — Dual "improved"

**Members:** `skills/b-save` + `skills/b-save-improved`; `skills/git-commit` + `skills/git-commit-improved`; `skills/b-pr` + `prompts/b-pr-improved.md` + `extensions/b-pr-improved/`.

**Evidence:**

- `b-save-improved/SKILL.md` "Safety Rules" item 1: "`/b-save` stays as the portable fallback; this skill does not replace it. If the extension cannot run, follow `prompts/b-save.md` step-by-step instead." Extension flow is wired (`extensions/index.ts:11, 330`); command is registered (`prompts/b-save-improved.md` + `commands/b-save-improved.md` symlink, per `docs/buck-workflow.md:69`).
- `git-commit-improved/SKILL.md` "Procedure" → extension `extensions/b-commit-improved/`. `git-commit` is the fallback per `git-commit-improved/SKILL.md` "Procedure" last paragraph; `docs/buck-workflow.md:68` confirms `/b-commit-improved` falls back to `skills/git-commit-improved/` and that to `skills/git-commit/`.
- `prompts/b-pr-improved.md` is two lines and explicitly delegates: "the whole flow… runs as deterministic code in `extensions/b-pr-improved/`, reusing `skills/b-pr/scripts/pr-preflight.ts` and invoking the model inline". `docs/buck-workflow.md:56, 479-480` confirms `/b-pr-improved` falls back to `skills/b-pr/`.

**Classification / recommendation:** **KEEP-DISTINCT** (intentional layering). All three are explicit "deterministic extension flow + portable fallback skill/prompt" pairs. The improved variants document themselves as not replacing the originals. Both fall back to the original on harnesses without the extension.

**Action:** None. This is intentional, documented, and wired. Skip from the deletion list.

---

### Cluster 3 — Grill

**Members:** `skills/b-grill`, `skills/b-grill-me`, `skills/b-grill-auto`, `skills/b-grill-with-docs`, `extensions/grill-me-dialog.ts`, `extensions/b-grill-auto/`.

**Evidence:**

- `b-grill/SKILL.md` is the unified entry; `b-grill-me` = user mode, `b-grill-auto` = auto (RPC) mode. `b-grill-with-docs` is user-mode + domain-docs awareness; the SKILL.md "Siblings" section explicitly states: "`b-grill-with-docs` is `b-grill-me` plus doc awareness… the mapping table, auto-derive algorithm, and opt-in note below are identical; only the doc-awareness path is unique".
- `b-grill-me/SKILL.md` has a "Doc Mode" section that calls a `grill-me_dialog` tool. `extensions/grill-me-dialog.ts` registers that tool. README at `README.md:350` and `docs/buck-workflow.md:83, 515` both state the extension is **unwired** ("`grill-me-dialog.ts` kept as unused code"). Doc-mode therefore cannot function in the runtime today, but the skill is fully usable without it (the skill provides a `Non-interactive Mode` fallback at the end of "Document Mode").
- `extensions/b-grill-auto/` is a Python-RPC prototype plus helper that is **not imported** by `extensions/index.ts` (`docs/buck-workflow.md:83, 514`); the backlog still carries "Test b-grill-auto extension in live Pi session". The `b-grill-auto` **skill** remains a valid skill-only flow (`docs/buck-workflow.md:737-743`).
- `b-grill-with-docs/SKILL.md` `## Non-interactive Mode` is empty (truncated). It is otherwise a strict superset of `b-grill-me` plus a CONTEXT.md/ADR-aware path that `b-grill-me` lacks.

**Classification / recommendation:** **MERGE** (one cleanup-worthy duplication). Specifically:

- `b-grill-me` is the user-mode branch inside `b-grill` and `b-grill-with-docs`; `b-grill-with-docs` already states the body of `b-grill-me` is duplicated verbatim ("the mapping table, auto-derive algorithm, and opt-in note below are identical"). Delete `b-grill-me`; update `b-grill/SKILL.md` user-mode pointer to refer to `b-grill-with-docs` (or vice-versa — pick one as canonical).
- `extensions/grill-me-dialog.ts` is unwired and doc-mode has a non-interactive fallback. **DELETE** the extension file; update `b-grill-me/SKILL.md` Doc Mode (and its replacement) to drop the `grill-me_dialog` tool call instruction (or keep it dormant and documented as future work). Same call applies to the empty `b-grill-with-docs/SKILL.md` Non-interactive Mode stub.
- `b-grill-auto` skill stays; `extensions/b-grill-auto/` Python prototype is unwired and the backlog item to test it is open. **KEEP the extension directory** only as a tracked-but-unwired prototype (the README already enumerates it as historical/unwired), or **DELETE** if the team is done with the prototype path — call this out as a separate user choice. The skill alone is enough.
- `b-grill` as the unified entry stays.

**Action:** DELETE `b-grill-me` (verbatim dup of `b-grill` user-mode + the explicit `b-grill-with-docs` "Siblings" admission). DELETE `extensions/grill-me-dialog.ts` (unwired, doc-mode fallback covers the gap). Update `README.md:322, 410-411, 689, 739` to point user-mode at `b-grill-with-docs`. Confirm with user whether `extensions/b-grill-auto/` is to be kept as historical or deleted (the backlog still references it).

---

### Cluster 4 — Capture

**Members:** `skills/b-capture`, `skills/thought-dump-writer`.

**Evidence:**

- `b-capture/SKILL.md` is the multi-file capture tree (`notes/raw-capture-log.md` + one file per dump under `notes/entries/`). It explicitly says: "This is not `/b-research`… and not `/b-explore`…" and "**Polish is deferred.** No tidy-up… until the user explicitly says so".
- `thought-dump-writer/SKILL.md` is a single-file, per-turn, lightly-cleaned living note with a `checkpoint.sh` that commits one file. It states: "**b-capture:** user wants a multi-file raw-entry-per-dump tree (one file per dump under a subject folder, no editing/grouping). This skill is one file, one section per topic, corrected for readability." That is a direct sibling carve-out.
- Both are listed separately in `README.md:228, 287` and `docs/buck-workflow.md:407-408`. The skill descriptions and the user-reported previous merge (overlapping capture skills → `b-capture --raw`) make the distinction clear: `b-capture` = raw multi-file, `thought-dump-writer` = single-file with light cleanup + git checkpoint.

**Classification / recommendation:** **KEEP-DISTINCT** (intentional). The two skills have explicit, non-overlapping contracts — `thought-dump-writer` exists because some users want a single living doc + per-turn git checkpoint, not the entry-per-dump tree. The README documents both.

**Action:** None. Both stay; they are not duplicates.

---

### Cluster 5 — Design / UX

**Members:** `skills/design-brief`, `skills/b-create-ux-guide`, `skills/b-create-styleguide`, `skills/codebase-design`.

**Evidence:**

- `design-brief/SKILL.md` = "turn design context, screenshots, files, plain-language descriptions, and subject-folder artifacts into an implementation-ready UI design brief" (one brief per surface, JSONC output).
- `b-create-ux-guide/SKILL.md` = full site/section → inventory → three deliverables: markdown style guide + HTML research guide + `design-brief.json`. It explicitly says in closeout: "If ux-guide deliverables are detected (`docs/ux-style-guide.md`, `docs/ux-research.html`, or `docs/ux-design-brief.json` from a previous `b-create-ux-guide` run): **offer**, do not auto-act… (a) Consume as seed inventory (use the JSON)… (b) Reverse-engineer fresh…". So `design-brief` (single brief) and `b-create-ux-guide` (full inventory with three artifacts) are different scopes that interop.
- `b-create-styleguide/SKILL.md` = guided styleguide **creation + idempotent maintenance**; explicitly distinguishes from `b-create-ux-guide`: "The user wants a quick component inventory of existing code only (use `b-create-ux-guide`)" and "It is also a living keeper: re-running it idempotently reconciles the styleguide with the codebase". The two share a `design-brief.json` schema (per `b-create-styleguide/SKILL.md` §"Always: machine-readable JSON spec") — that's interop, not duplication.
- `codebase-design/SKILL.md` = deep-module vocabulary (module / interface / seam / depth / adapter / leverage / locality). It is a **vocabulary reference**, not a UX skill; the only overlap with the other three is the term "seam". `b-diagnose/SKILL.md:31` already cites it for that purpose. `docs/buck-workflow.md:1426` explicitly tags it model-invoked only, no wrapper.

**Classification / recommendation:** **KEEP-DISTINCT**. Four different scopes: brief, inventory, styleguide-maintainer, design vocabulary. The first three interop via a shared JSON schema (deliberate), and `codebase-design` is orthogonal vocabulary.

**Action:** None.

---

### Cluster 6 — Explore / research

**Members:** `skills/b-explore`, `skills/b-research`, `skills/b-arch-qa`, `skills/skill-explainer`, `skills/crawl4ai`.

**Evidence:**

- `b-explore/SKILL.md` "When NOT to Use: tracing code flow within the project" → b-explore IS that. Internal codebase investigation; canonical summary `research-<topic>.md` in a subject folder.
- `b-research/SKILL.md` "External investigation command — for internal codebase exploration, use `b-explore`". Same canonical artifact (`research-<topic>.md`) but different source domain.
- `b-arch-qa/SKILL.md` is live back-and-forth Q&A that builds a `.context/discussions/{subject}.md`; read-only; explicitly says "The question is purely about external technology with no codebase relevance — use `b-research` instead" and "User wants code changes **implemented**, not just discussed — use `b-build` or `b-iterate` instead". Different artifact, different mode.
- `crawl4ai/SKILL.md` is a **helper skill** invoked by `b-research` ("helper skill invoked by `b-research` when lightweight web search isn't sufficient"). Different layer entirely.
- `skill-explainer/SKILL.md` reads a skill folder and writes an HTML report. Orthogonal — it analyses *this repo's skills*, not the codebase. README `README.md:339`.

**Classification / recommendation:** **KEEP-DISTINCT**. Five different surfaces: internal explore, external research, live Q&A into a discussion doc, web-crawl helper, skill-folder explainer. The SKILL.md cross-references make the boundaries explicit.

**Action:** None.

---

### Cluster 7 — Recap / handoff / save

**Members:** `skills/b-recap`, `skills/b-handoff`, `skills/b-save`.

**Evidence:**

- `b-handoff/SKILL.md` carries an explicit "Routing" table: `b-recap` = chat-only, no artifact; `b-save` = historical record in `.context/`; `b-handoff` = portable seed doc in OS temp dir for a different agent. Three different destinations (chat / `.context/` / `$TMPDIR`), three different audiences (the user / this repo's future sessions / a different harness).
- All three are listed independently in `docs/buck-workflow.md:44, 436, 426` and `README.md:228`.

**Classification / recommendation:** **KEEP-DISTINCT**. Explicit routing table in `b-handoff` makes the boundaries authoritative.

**Action:** None.

---

### Cluster 8 — Memory import

**Members:** `skills/b-memory-import`, `skills/b-hindsight-import-projects`.

**Evidence:**

- `b-memory-import/SKILL.md` "Related: `b-hindsight-import-projects` — bulk wrapper that drives this script across many projects in one pass". Single-project; Bun script; deterministic.
- `b-hindsight-import-projects/SKILL.md` "Driver `b-memory-import` over many projects… Discover projects under one or more roots, run the per-project import per root, aggregates results, and survives individual project failures". Strict wrapper.

**Classification / recommendation:** **KEEP-DISTINCT**. Single-project vs. multi-project wrapper. Wrapper has no body of its own — it just forwards flags and aggregates JSON.

**Action:** None.

---

### Cluster 9 — Docs

**Members:** `skills/b-docs`, `skills/b-howto`, `skills/writing-for-agents`.

**Evidence:**

- `b-docs/SKILL.md` "Sibling: `b-howto`" — owns *why* (CONTEXT.md / ADR / AGENTS.md managed block); `b-howto` owns *how* (`docs/howto/` Diátaxis). They **load each other** in the same session when the other kind of work shows up (explicit cross-call, once-each guard).
- `writing-for-agents/SKILL.md` is a model-invoked **reference** for writing skills / AGENTS.md / CLAUDE.md. Tagged "skill-only (no slash wrapper)" at `docs/buck-workflow.md:50, 427, 1438`; `b-docs/SKILL.md` cites `writing-for-agents/SKILL.md` as the format source ("Preserve human authorship" / "Managed-Block Convention"). Distinct role from `b-docs` and `b-howto`.

**Classification / recommendation:** **KEEP-DISTINCT**. Three distinct scopes: why (living docs), how (Diátaxis), how-to-write-it (vocabulary). The cross-calls are explicit and one-shot-guarded.

**Action:** None.

---

### Cluster 10 — Diagnose vs. code-smells

**Members:** `skills/b-diagnose`, `skills/code-smells`.

**Evidence:**

- `b-diagnose/SKILL.md` Exits section: "`code-smells` — Phase 5's 'no correct seam exists' *is itself the finding*: the architecture prevents locking this bug down. Hand off to a smells/architecture pass rather than forcing a fix through a wrong seam." So `b-diagnose` → `code-smells` is the documented handoff.
- `code-smells/SKILL.md` is an audit (reference or scan) producing a `.context/YYYY-MM-DD.code-smells-scan/report.md`. Different artifact (a smells report ranked by severity·impact·effort) and different entry point (a catalog scan, not a bug repro).

**Classification / recommendation:** **KEEP-DISTINCT**. `b-diagnose` runs on a single red bug; `code-smells` scans a codebase for 23 smells in 5 categories. The handoff is documented and explicit.

**Action:** None.

---

### Cluster 11 — Blueprint vs. present

**Members:** `skills/b-blueprint`, `skills/b-present`.

**Evidence:**

- `b-blueprint/SKILL.md` "Relationship to b-present" table (top of file): `b-present` = multi-page briefing package; `b-blueprint` = single-page architecture poster. Both can coexist; different audiences (stakeholders/reviewers vs engineers/implementers).
- Both produce HTML into `presentations/<slug>/` (`docs/buck-workflow.md:1035`).

**Classification / recommendation:** **KEEP-DISTINCT**. Single-page vs. multi-page; both documented, both wired into the same output tree, non-overlapping audiences.

**Action:** None.

---

### Cluster 12 — Tracker pipeline

**Members:** `skills/b-auto-fix`, `skills/b-triage`, `skills/b-issue-create`, `skills/b-backlog`, `skills/b-init-tracker`.

**Evidence:**

- `b-init-tracker/SKILL.md` = one-shot scaffolding of `docs/agents/issue-tracker.md` + `triage-labels.md`; idempotent managed AGENTS.md block. "Run once before first use of `b-issue-create`, `fix-pr`, or `b-triage`".
- `b-triage/SKILL.md` "**Inbound** stage… the only missing inbound stage in this repo's skill set" (outbound are `b-issue-create`, `b-pr`, `fix-pr`, `b-pr-review-2-issues`). Output: `ready-for-agent`.
- `b-issue-create/SKILL.md` = outbound: plan → GitHub issue handoff.
- `b-auto-fix/SKILL.md` = consumer of `ready-for-agent`; pipeline `b-research → b-plan → b-build → b-review` per issue. `docs/buck-workflow.md:1388` explicitly: "`ready-for-agent` is the exact input state `b-auto-fix` consumes".
- `b-backlog/SKILL.md` = durable in-repo tracking (`.context/backlog/items/<slug>.md` + `todo.md` checkbox). Used when work is deferred, not issue-tracker-specific.

**Classification / recommendation:** **KEEP-DISTINCT**. Five-stage pipeline with non-overlapping roles: scaffold (`b-init-tracker`), inbound (`b-triage`), outbound (`b-issue-create`), consumer (`b-auto-fix`), durable backlog (`b-backlog`). `b-auto-fix`'s "Pipeline" section explicitly states it orchestrates the four `b-*` skills sequentially — it is a driver, not a duplicate.

**Action:** None.

---

### Cluster 13 — Project-specific skills in a portable package

**Members:** `skills/rails-app`, `skills/node5-code-review`, `skills/llm-wiki-vault`, `skills/manage-herdr-panes`.

**Evidence:**

- `rails-app/SKILL.md` is project-specific (subpath default, Tailwind rebuild, `assert_select` with `?`, integration `sign_in_as` bootstrap, BEM theming, three-layer theme system, dev server lifecycle). Bound to "Rails projects"; described as "Whenever working in a Rails project…".
- `node5-code-review/SKILL.md` is **explicitly** project-specific to the `node5` project ("Review code changes… in the node5 project"). Cross-references itself with `code-review` and acknowledges the boundary.
- `llm-wiki-vault/SKILL.md` is bound to a **specific user's** Obsidian vault: "Buckley's vault: `/home/buckleyrobinson/Documents/second brain`" — frontmatter `author: wooderson`, `license: MIT`. The skill is single-vault-coupled.
- `manage-herdr-panes/SKILL.md` requires `HERDR_ENV=1` (a local runtime contract): "Requires `HERDR_ENV=1`". It is the operational cookbook for Herdr; the README also has `pi-rpc`, `run-in-idle-pane`, and `tmux-window-status` in the same family.
- `node5-code-review` and `llm-wiki-vault` have **zero inbound references** from skills / prompts / extensions / README / docs (grep across `skills/`, `prompts/`, `extensions/`, `README.md`, `docs/` shows only the README line that **lists** them, not consumes them — `README.md:327, 336, 339, 340, 335`). `rails-app` has the same property. `manage-herdr-panes` is referenced from a project-local `index.md` (`.context/2026-09-11.fix-pr-open-prs/index.md:13` — `Skill used to launch`), one live session, not from the package itself.
- The `mattpocock` adoption plan (`research-mattpocock-skills-overlap.md`) treats project-specific skills as out-of-scope for portable shipping.
- `README.md:2128` lumps these four (plus `cross-platform-pi-omp-loading`, `run-in-idle-pane`, `pi-rpc`) under "Reference skills (no slash wrapper)".

**Classification / recommendation:** **PROJECT-SPECIFIC** cleanup — these do not belong in a portable workflow package. Recommend:

- **DELETE** `node5-code-review` (already redundant with `code-review` per its own description; project-specific checklist that no portable consumer can use).
- **MOVE OUT** of `skills/` and into a separate location (or a sub-package): `rails-app`, `llm-wiki-vault`, `manage-herdr-panes`. They are real, but not portable — `llm-wiki-vault` is single-vault-coupled; `manage-herdr-panes` requires a runtime env var; `rails-app` is one team's Rails reference notes.

**Action:** Confirm with the user before deleting `node5-code-review`. For the other three, recommend a separate "user-local skills" or sibling repo rather than co-locating with portable workflow skills. The package's `README.md:2128` and `docs/buck-workflow.md:2128` "Reference skills" sentence is the de-facto documentation that these are tolerated in the package; an explicit split would clean that up.

---

## Keep (brief)

These skills are intentional, documented, and non-overlapping; do not touch:

- All wired extensions (`b-pr-improved`, `b-commit-improved`, `b-save-improved`, `b-kamal-release`, `plan-artifact`, `buck-loop`, `code-review-iteration`) per `docs/buck-workflow.md:73, 81, 332-334`.
- All dual-improved pairs (`b-save`+`b-save-improved`, `git-commit`+`git-commit-improved`, `b-pr`+`b-pr-improved`) — they are documented fallback / extension flows, not duplicates.
- Grill pipeline minus `b-grill-me` (see Cluster 3 deletion).
- Capture pair `b-capture` + `thought-dump-writer` (different contracts; explicit sibling carve-out).
- Design pipeline (`design-brief`, `b-create-ux-guide`, `b-create-styleguide`, `codebase-design`) — schema-interop, not duplication.
- Explore/research (`b-explore`, `b-research`, `b-arch-qa`, `crawl4ai`, `skill-explainer`).
- Recap/handoff/save (three destinations, explicit routing table).
- Memory import (`b-memory-import` vs `b-hindsight-import-projects` — single vs. multi).
- Docs trio (`b-docs`, `b-howto`, `writing-for-agents` — why / how / vocabulary).
- Diagnose vs. code-smells (single-bug repro vs. catalog scan; documented handoff).
- Blueprint vs. present (single-page vs. multi-page).
- Tracker pipeline (scaffold / inbound / outbound / consumer / backlog — five distinct stages).

---

## Open questions

1. **Cluster 3 — `extensions/b-grill-auto/` Python prototype**: keep as tracked-but-unwired (current state, enumerated in README at `README.md:350` and `docs/buck-workflow.md:83, 514`), or delete? Backlog still carries "Test b-grill-auto extension in live Pi session". User call.
2. **Cluster 13 — split target for `rails-app` / `llm-wiki-vault` / `manage-herdr-panes`**: separate package, sibling repo, or `skills/_local/` directory inside the package? Affects whether these move or just get flagged as "intentionally non-portable" in the README. User call.
3. **Cluster 1 — `node5-code-review` deletion vs. externalise**: same question as Cluster 13 (it's project-specific; deletion vs. move). Recommend deletion since the cross-reference paragraph in its own `SKILL.md` already admits it's a complement to `code-review`.
4. **Cluster 3 — which of `b-grill-me` and `b-grill-with-docs` is canonical**: the two skills' bodies overlap verbatim per `b-grill-with-docs/SKILL.md` "Siblings" section. Recommend keeping `b-grill-with-docs` (it has the domain-aware path, which is a real differentiator) and deleting `b-grill-me`. Confirm with user.
