---
date: 2026-09-11
domains: [agent-skills, workflow, audit]
topics: [overlap-audit, jz-skills, buck-workflow, methodology-comparison, superpowers-lineage]
related: []
priority: high
status: active
subject: 2026-09-11.resumator-docker-orchestration-overlap
informs: []
---

# Overlap findings — buck-workflow-pi vs resumator/docker-orchestration `.claude`

## Pins

- LOCAL: `buck-workflow-pi` @ `f797174f8246aa20747be11e2de751fb099a8aac` (2026-09-09) — 53 skills under `skills/`, 33 prompts, 37 commands
- UPSTREAM: `resumator/docker-orchestration` @ `1fea15efc8a578aaf4e86f63c3b648a333307409` (2026-09-09, INTERNAL visibility) — 24 skills under `.claude/skills/`, 105 files under `.claude/`
- Both read-only. NOTHING in either repo was modified and nothing may be.

## Verdict

- Both suites are the same *genre* (markdown skills + thin slash wrappers + an install story) but solve different halves of the lifecycle — buck-workflow-pi is broad and artifact-centric (53 skills, heavy `.context/` durable-record discipline, presentation/docs surfaces), docker-orchestration `.claude` is narrow and gate-centric (24 skills, an end-to-end autonomous conductor with human gates, PR/CI convergence loops, and a company-ops tail).
- Buck's spine is stations: intake → requirements → plan → phase → build → review → docs → save → commit (`README.md:301`, `docs/buck-workflow.md:138` per `research/local-harness-layer.md`).
- Upstream's spine is convergence: ticket → spec → plan → execute in worktree → adversarial review on another model family → CI-green / bot-comment loops → deploy, with human gates before prod and before financial mutation (`research-overlap-notes.md:71-85`, `research/upstream-domain.md`).
- Upstream's 12 numbered conventions are the portable yield; its 6–8 JazzHR-bound domain skills are not (see `## Non-goals / do not port`).
- Buck's genuine depth — git-portable `.context/` record + memory index + backlog, `guardrails.json` contract with ratchet, doc taxonomy (ADR/how-to/domain language), presentation artifacts — has no upstream analogue and is the return path (see `## What docker-orchestration could adopt`).
- Shared ancestry is real and load-bearing: 7 upstream skills are declared MIT-derivative ports of `obra/superpowers` v6.1.0, and buck has the same attribution defect open since 2026-09-10 — see `## Shared ancestry`.
- Net: do not merge the spines. Port upstream's gate/ID/lint/session mechanics into buck as `fold-in`s, and offer buck's durable-record/doc/contract mechanics back upstream.

## Shared ancestry

Upstream ships `.claude/skills/ATTRIBUTION.md`: 7 of its 24 skills are declared MIT-derivative ports of `obra/superpowers` v6.1.0 (`f268f7c`), with the full MIT text inline and this port table (`research-overlap-notes.md:20-31`):

| jz skill | upstream superpowers skill |
|---|---|
| jz-spec-writer | brainstorming |
| jz-plan-writer | writing-plans |
| jz-plan-executor | subagent-driven-development (modified: on-disk ledger) |
| jz-worktree | using-git-worktrees |
| jz-debug | systematic-debugging |
| jz-test-driven-development | test-driven-development |
| jz-skill-writer | writing-skills |

Corroboration inside the skill bodies: `jz-worktree` attributes to superpowers v6.1.0 at `/tmp/docker-orchestration/.claude/skills/jz-worktree/SKILL.md:245` (per `research/upstream-domain.md`); the port of `subagent-driven-development` is explicitly modified with an on-disk ledger.

buck-workflow-pi has an OPEN defect (2026-09-10 audit) for exactly this class: near-verbatim mattpocock/skills copies in `skills/b-grill-with-docs/CONTEXT-FORMAT.md` and `skills/b-grill-with-docs/ADR-FORMAT.md` with no attribution, while `package.json` `files:` publishes `skills/` to npm (`research-overlap-notes.md:33-37`; supporting files `skills/b-grill-with-docs/CONTEXT-FORMAT.md`, `skills/b-grill-with-docs/ADR-FORMAT.md` per `research/local-interview-ux.md`).

Upstream's `ATTRIBUTION.md` — named table + pinned upstream version + commit SHA + full MIT text inline — is a working template for the remediation already locked in `.context/2026-09-10.mattpocock-adoption/`. Do NOT re-open or re-litigate that decision; this section records the lineage only.

## Lifecycle stage map

| Stage | buck-workflow-pi skills | docker-orchestration skills | Overlap class | One-line difference |
|---|---|---|---|---|
| Frame | b-brainstorm, b-research, b-explore, b-capture, b-arch-qa (`research/local-planning.md`, `research/local-research-memory.md`) | jz-spec-writer (superpowers `brainstorming` port), ticket intake (`research-overlap-notes.md:24-31`) | strong | Buck frames into `.context/` subject folders with write-gates; jz frames into ticket-to-spec IDs with `(source:)` tags. |
| Design | design-brief, b-create-ux-guide, b-create-styleguide, product-tour, rails-app (`research/local-interview-ux.md`) | — (no design-surface skills; release notes via jz-text-humanizer) | none | Buck owns UI/design authoring; upstream has no design stage. |
| Plan | b-plan, b-plan-update, b-phase, b-nasa-prd, b-loop (advisory stamp) (`research/local-planning.md`) | jz-plan-writer (superpowers `writing-plans` port), jz-ticket-writer / stable `PR-NNN/AC-NNN` to `FR-NNN/SC-NNN` IDs (`research-overlap-notes.md:57-60`) | strong | Buck plans are tactical `plan-*.md` vs strategic `spec-*.md` with HARD/SOFT/NONE phase graph; jz plans are ID-traceable specs greppable by `source:` tag. |
| Challenge | b-grill, b-grill-me, b-grill-auto (Pi RPC, different model), b-grill-with-docs (`research/local-interview-ux.md`) | jz-adversarial-review (router + per-mode `references/<mode>/engine.md`), jz-senior-engineer restraint lens (`research-overlap-notes.md:52-54,73-78`) | partial | Buck grills the plan with the human or another model pre-build; jz reviews the implementation on another model family post-build. |
| Build | b-build (red-green-refactor), b-iterate, b-auto-fix pipeline (`research/local-build-review.md`) | jz-plan-executor (subagent-driven-development + on-disk ledger), jz-test-driven-development, jz-debug, jz-dev-commands (`research-overlap-notes.md:24-31`, `research/upstream-domain.md`) | partial | Buck enforces TDD as agent prose with guardrails closeout; jz executes via ledger-driven subagents with container-sync and systematic-debug protocols. |
| Verify | b-review (workflow gate), b-guardrails-check, code-review-universal, node5-code-review, code-smells (`research/local-build-review.md`) | jz-adversarial-review (4 lenses x 4 providers), skill-lint / skills-contract bats (`research-overlap-notes.md:61-64,73-75`) | partial | Buck gates on `guardrails.json` + completion matrix with `iterate-*.md` loop; jz gates on cross-model adversarial lenses + lint contract. |
| Ship | b-pr (two-section body, `.git/b-pr-base`), git-commit, b-issue-create (real `gh issue create`), fix-pr, b-pr-review-2-issues (`research/local-git-pr-ops.md`) | jz-deploy (GHA release-build-deploy-verify-e2e, human gate before prod), two-phase Plan PR + stacked Implementation PR (`research-overlap-notes.md:71-72`, `research/upstream-domain.md`) | adjacent | Buck ships the PR + tracker handoff; jz ships through CI-green/bot-comment convergence to staging/prod. |
| Remember | b-save / b-save-improved (`.context/memory/*.md` + `index.md`), b-docs, b-howto, b-memory-import, b-backlog (`research/local-research-memory.md`) | jz-agent-session-state (hook-injected `~/.jz-agent-session-state/<id>.state.md`, headless haiku updater) (`research-overlap-notes.md:65-70`) | adjacent | Buck remembers git-portable session meaning (event vs meaning vs sequence split); jz persists ephemeral per-session state with zero tokens via hooks. |
| Autonomy/orchestration | b-loop (stamps `omp_execution` recommendation only, never drives), b-phase `depends_on`, b-auto-fix CLI (`research/local-planning.md`) | end-to-end autonomous conductor (jz-plan-executor ledger + autonomous-development kickoff), dispatch-responsiveness mandate, 30s wait cap (`research-overlap-notes.md:82-83`) | adjacent | Buck recommends autonomy per phase and stops; jz dispatches background + polls as the default execution shape. |
| Meta+house-specific | cross-platform-pi-omp-loading, b-init-factory, b-init-guardrails, _shared/subject-resolution (`research/local-harness-layer.md`, `research/local-interview-ux.md`) | jz-skill-writer + skill-lint + RETIRED tombstones; house skills jz-zuora-invoice-writeoff, jz-kafka-connect-api, jz-kibana-search, jz-cert, jz-dev-commands (`research-overlap-notes.md:55-64`, `research/upstream-domain.md`) | none | Meta layers are each internally coherent and non-portable as a block; only individual mechanics transfer (see adoption sections). |

## Capability matrix

| Capability | buck | jz | notes |
|---|---|---|---|
| TDD enforcement | Partial — red-green-refactor mandated as agent prose (`skills/b-build/SKILL.md:28-35`, `skills/b-build/SKILL.md:70-82`); closeout proof is `/b-guardrails-check`, no hard block on editing source before failing test (`research/local-build-review.md` Q1) | Yes — `jz-test-driven-development` (superpowers TDD port) + `jz-plan-executor` ledger-driven execution (`research-overlap-notes.md:24-31`) | Buck's gap is the missing automated red-phase gate; jz pairs the discipline with the executor. |
| Systematic debugging | No — `b-iterate` covers "lightweight diagnostics" only (`skills/b-iterate/SKILL.md:79`); no reproduce-to-regression protocol (`research/local-build-review.md` Q6) | Yes — `jz-debug` (superpowers `systematic-debugging` port) (`research-overlap-notes.md:24-31`) | Cleanest `fold-in` candidate for buck (see adoption section). |
| Multi-lens adversarial review | Partial — `code-review` / `node5-code-review` / `code-smells` fan out parallel risk-area subagents (`skills/code-review/SKILL.md:50-67`, `skills/node5-code-review/SKILL.md:54-74`, `skills/code-smells/SKILL.md:70-88`); `b-review` itself is single-pass (`research/local-build-review.md` Q2) | Yes — `jz-adversarial-review` router + inlined per-mode `references/<mode>/engine.md`, 4 lenses (`research-overlap-notes.md:52-54`) | Upstream's explicit "dispatcher over thin leaves is worse" is the architectural delta. |
| Review on a different model family | Partial — `b-grill-auto` interviews a different model via Pi RPC/`grill.py` (`skills/b-grill-auto/SKILL.md:14-19`, `skills/b-grill/grill.py` 412 lines); review skills do not (`research/local-interview-ux.md`, `research/local-build-review.md` Q3) | Yes — adversarial lenses run off-harness (Copilot CLI / opencode) across claude-opus-5, gpt-5.3-codex, gpt-5.6-terra, gemini-3-pro at medium effort (`research-overlap-notes.md:73-75`) | Buck has the RPC transport; jz has the review wiring. |
| Worktree-per-unit-of-work | Partial — conditional `git worktree add ../.worktrees/<head>` in `b-pr-review-2-issues` (`skills/b-pr-review-2-issues/SKILL.md:47-51`); cleanup in `git-clean-orphans` (`skills/git-clean-orphans/SKILL.md:17-18`); no provisioner (`research/local-git-pr-ops.md` Q1) | Yes — `jz-worktree` (superpowers port): consent gate, native-tool-first, `git worktree add -b`, gitignore verify, setup + baseline tests (`/tmp/docker-orchestration/.claude/skills/jz-worktree/SKILL.md:36-200` per `research/upstream-domain.md` Q3) | `jz-worktree` ties to branch name (`[A-Za-z0-9._-]+`, no `/`), never ticket ID. |
| CI-green loop | No — no skill polls `gh pr checks` or loops to green; `fix-pr` ignores "CI still running" noise (`skills/fix-pr/SKILL.md:300` per `research/local-git-pr-ops.md` Q2) | Yes — conductor + deploy chain watch GHA runs (`gh run watch`) through build-deploy-verify-e2e (`research/upstream-domain.md` jz-deploy) | Buck gap is a full convergence loop, not just polling. |
| Bot-review-comment loop | Partial — `fix-pr` ingests human + bot bodies as valid (`skills/fix-pr/SKILL.md:152,300`); `b-pr-review-2-issues` fetches `gh pr view --comments` without human/bot distinction (`research/local-git-pr-ops.md` Q3) | Yes — untrusted-data posture names CI logs / Copilot comment bodies as data-not-instructions with human-channel-only overrides (`research-overlap-notes.md:79-81`) | Buck ingests; jz ingests with a trust policy. |
| Real GitHub issue creation | Yes — `b-issue-create` (`gh issue create --body-file`, `skills/b-issue-create/SKILL.md:174-192`) and `fix-pr` issues path (`skills/fix-pr/SKILL.md:243-247`); `b-pr-review-2-issues` explicitly creates none (`research/local-git-pr-ops.md` Q4) | Partial — two-phase PR topology + ticket-ID traceability imply tracker linkage, but no standalone issue-authoring skill surfaced in the 12 conventions | Buck is deeper on AFK-ready handoff artifacts (branch + presentation + acceptance criteria). |
| Deploy/release | Partial — `b-kamal-release` extension-only command (`commands/b-kamal-release.md:20`); no deploy skill in the scouted clusters (`research/local-git-pr-ops.md` Q5) | Yes — `jz-deploy`: semver release to `docker-image.yml` to `argo_deploy.yml` to kubectl verify to `jz-e2e.yml`, human gate before prod (`research/upstream-domain.md`) | `jz-deploy` is PROJECT-BOUND (resumator repos, `smbprod/smbstaging`); pattern portable, addresses not. |
| Machine-checkable coverage/complexity gates | Yes — six gates in `guardrails.json` (unit/functional/lint/patch/global_ratchet/complexity); patch >=90%, McCabe 10/15; `b-guardrails-check` measures, never edits (`skills/b-guardrails-check/SKILL.md:97-163`, live `guardrails.json:1-241` per `research/local-build-review.md` Q4) | Partial — per-repo discovered quality/verification gates, no recorded-thresholds file (`research-overlap-notes.md:92-93`) | Buck's ratchet (baseline + burn-down) is the return gift. |
| Stable requirement IDs with source tags | Partial — `b-nasa-prd` shall-statements + rule-ID checklist (`skills/b-nasa-prd/SKILL.md:21-27`, `skills/b-nasa-prd/SKILL.md:100-108`); plan/spec frontmatter (`spec:`, `research:`) but no cross-artifact ID chain (`research/local-planning.md`) | Yes — ticket `PR-NNN`/`AC-NNN` to spec `FR-NNN`/`SC-NNN` to cycle-doc `VP-NNN`, each with `(source:)`; untagged = CUT (`research-overlap-notes.md:57-60`) | Machine-checkable by grep; buck's closest is NASA rule IDs. |
| Dependency modelling between work units | Yes — `b-phase` HARD/SOFT/NONE graph + `depends_on` frontmatter + Dependency Matrix + Parallel Opportunities (`skills/b-phase/SKILL.md:88-124`, `skills/b-phase/SKILL.md:277-307` per `research/local-planning.md` Q1) | Partial — plan-executor ledger + phased deploy chain imply ordering; no HARD/SOFT/NONE taxonomy surfaced | Buck is deeper here; no automated graph validation in either suite. |
| Git-portable session record | Yes — `.context/YYYY-MM-DD.<subject>/` + `.context/memory/<topic>-YYYY-MM-DD.md` + `index.md` ledger + backlog cross-refs via `b-save` / `b-save-improved` (`prompts/b-save.md:7-48`, `skills/b-save-improved/scripts/save-apply.ts:467-477` per `research/local-research-memory.md` Q1) | No — upstream pushes rationale to PR/ticket; repo files carry current state, not history (`research-overlap-notes.md:90-91`) | Core asymmetry: buck remembers in-repo, jz remembers in-tracker. |
| Hook-driven session persistence | No — `/b-save` is "pure prompt, no extension backing" (`skills/b-save/SKILL.md:21-23`); only unwired `b-flow` had `session_before_compact` (`extensions/b-flow/index.ts:292` per `research/local-harness-layer.md`) | Yes — `jz-agent-session-state`: SessionStart injects `~/.jz-agent-session-state/<session-id>.state.md`, Stop launches headless `claude -p --safe-mode --tools "Read,Edit" --model haiku` updater, zero tokens/turns (`research-overlap-notes.md:65-70`) | Explicitly replaced main-agent-authored records. |
| Skill-authoring meta-skill | No — no `SKILL.md`-authoring skill in `skills/`; closest are `b-init-factory` (factory `AGENTS.md`) and `cross-platform-pi-omp-loading` (package layout) (`research/local-interview-ux.md` Q2) | Yes — `jz-skill-writer` (superpowers `writing-skills` port) (`research-overlap-notes.md:24-31`) | Buck gap confirmed by directory listing (~56 skills, none authoring). |
| Skill linting in CI | No — contract validation is runtime (`save-preflight.ts`, `pr-preflight.ts`, `context:validate` on `.context/index/*.json` per `research/local-harness-layer.md`) | Yes — `jz skill-lint check` (name==dirname, description <=1024 chars, paths resolve, sub-skill/command targets exist, hooks executable) + `bats test/skill-lint.bats` + `test/skills-contract.bats` (`research-overlap-notes.md:61-64`) | Directly portable; buck's closest is frontmatter/schema checks. |
| Retired-skill tombstones | No — no `RETIRED` mechanism surfaced in scout reports | Yes — rename/delete requires appending old name to `skills/RETIRED`, never delete a line, or installer cannot uninstall (`research-overlap-notes.md:55-56`) | Installer-correctness mechanic, not documentation. |
| AI-prose de-tell pass | No — no general writing-quality skill in `skills/`; `b-writer` absent; only NASA checklist + review tone guidance (`research/local-interview-ux.md` Q4) | Yes — `jz-text-humanizer`: 24 Wikipedia-derived patterns, `{status: humanized, text}` contract, deploy calls it for release notes (`/tmp/docker-orchestration/.claude/skills/jz-text-humanizer/SKILL.md:95-393` per `research/upstream-domain.md` Q4) | Portable (no company hosts in procedure); tone rules split formal vs casual. |
| Presentation/briefing artifacts | Yes — `b-present` (multi-page package + `manifest.json`, `skills/b-present/SKILL.md:49-139`) and `b-blueprint` (single HTML poster, `skills/b-blueprint/SKILL.md:52-53,197-214`) (`research/local-planning.md`) | No — no presentation surface in the 24 skills / 105 `.claude/` files | Buck-only; disposable `presentations/<slug>/` not indexed in subject `index.md` by default. |
| Doc taxonomy (ADR/how-to/domain language) | Yes — `b-docs` (CONTEXT.md, `docs/adr/NNNN-slug.md`, managed AGENTS block; never writes `.context/`, `skills/b-docs/SKILL.md:96-97`) + `b-howto` (Diataxis one-action-per-file, last step Eat) + `b-grill-with-docs` lazy ADR gate (`research/local-research-memory.md`) | No — explicit counter-policy: files carry state, rationale lives in PR/ticket (`research-overlap-notes.md:90-91`) | Philosophical fork, not a gap to "fix" on either side. |
| Backlog | Yes — `b-backlog` (Backlog Curator subagent to `.context/backlog/items/<slug>.md` + `todo.md` line, `skills/b-backlog/SKILL.md:109-147`); `b-save` backlog stitching (`prompts/b-save.md:25`) (`research/local-planning.md`) | No — deferred work surfaces as tickets/plan-stack, not a repo-local backlog | Buck-only durable queue. |
| Autonomous end-to-end conductor | Partial — `b-auto-fix` CLI (`b-research` to `b-plan` to `b-build` to `b-review` per issue, `review_blocked` hard-fail, `skills/b-auto-fix/SKILL.md:20-46`); `b-loop` advisory-only (`research/local-planning.md` Q3, `research/local-build-review.md`) | Yes — plan-executor + worktree + adversarial review + CI/bot loops + deploy chain under one conductor with human gates (`research-overlap-notes.md:39-45`) | Buck orchestrates per-issue; jz orchestrates per-arc to prod. |

## What buck-workflow-pi could adopt

Ranked by value / effort (highest first). Convention numbers refer to the 12 numbered upstream conventions in `research-overlap-notes.md:48-85`.

1. **Stable requirement IDs with `(source:)` tags (convention 4).**
   What: ticket `PR-NNN`/`AC-NNN` to spec `FR-NNN`/`SC-NNN` to cycle-doc `VP-NNN`, every requirement carrying `(source: ...)`; untagged = CUT, uncited ticket id = dropped requirement; greppable traceability.
   Evidence: `research-overlap-notes.md:57-60` (ID chain convention).
   Integration class: `fold-in` — patch `b-plan` + `b-nasa-prd` (extend the NASA rule-ID checklist at `skills/b-nasa-prd/SKILL.md:100-108`) and `b-review` completion matrix (`skills/b-review/SKILL.md:52-71`) to enforce tag presence.

2. **Systematic-debug protocol (port-table row: `jz-debug`).**
   What: reproduce → root-cause → fix → regression-test procedure buck lacks (`research/local-build-review.md` Q6 verdict: absent).
   Evidence: `.claude/skills/jz-debug/SKILL.md` via port table `research-overlap-notes.md:29`; absence at `skills/b-iterate/SKILL.md:79` ("lightweight diagnostics" only).
   Integration class: `fold-in` — extend `b-iterate` with the reproduce/root-cause/regression section, or add a `b-debug` station between `b-review` findings and `b-iterate` if the patch grows past ~100 lines.

3. **Skill lint in CI (convention 5).**
   What: `jz skill-lint check` — name==dirname, description present and <=1024 chars with no unquoted `:`, every cited path resolves, every named sub-skill/command target exists, hook scripts executable; `bats test/skill-lint.bats` + `test/skills-contract.bats`.
   Evidence: `research-overlap-notes.md:61-64`.
   Integration class: `repo init` — one-shot `skills-contract.bats`-equivalent over `skills/*/SKILL.md` + `prompts/*.md` + `commands/*.md` symlink mirror (catches the known 4-file `commands/`-without-`prompts/` drift in `research/local-harness-layer.md` gaps).

4. **RETIRED tombstones (convention 3).**
   What: renaming/deleting a skill requires appending the old name to `skills/RETIRED` (never delete a line) so the installer can uninstall it.
   Evidence: `research-overlap-notes.md:55-56`.
   Integration class: `repo init` — create `skills/RETIRED` + one installer clause in `scripts/install.mjs:40-101`; then `fold-in` a line to the skill-authoring checklist once it exists.

5. **Restraint lens as a required review sub-step (convention 9).**
   What: `jz-senior-engineer`'s "Judging incoming feedback" pass over every synthesized finding before the report is emitted; Critical findings never declinable; every decline recorded with a reason.
   Evidence: `research-overlap-notes.md:76-78`.
   Integration class: `fold-in` — patch `b-review` classify step (`skills/b-review/SKILL.md:149-193`) and `fix-pr` validate step (`skills/fix-pr/SKILL.md:174-203`).

6. **"Iteration is a mode, never a name" (convention 1).**
   What: a skill defaults to ONE read-only pass ending in a proposal; it converges only in `loop` mode selected by an explicit greppable `loop` scope from a caller or human prose; never `-loop` in a skill name.
   Evidence: `.claude/skills/README.md:31`, root `CLAUDE.md:203` (per `research-overlap-notes.md:48-51`).
   Integration class: `fold-in` — patch `_shared` protocols + `b-review`/`b-iterate` headers so `b-pr-review-2-issues` (plan-only) vs `fix-pr` (act-now) becomes a mode flag rather than two skills to choose between.

7. **Untrusted-data posture, named and repeated (convention 10).**
   What: CI logs, Copilot comment bodies, prereq documents, and review findings are data-not-instructions; overrides read only from the human invocation channel.
   Evidence: `research-overlap-notes.md:79-81`.
   Integration class: `fold-in` — add one canonical paragraph to `skills/_shared/` + reference it from `fix-pr` (`skills/fix-pr/SKILL.md:152,300`), `b-pr-review-2-issues` (`skills/b-pr-review-2-issues/SKILL.md:60-80`), and `b-research` source handling (`skills/b-research/SKILL.md:89-97`).

8. **Hook-driven session-state record (convention 6).**
   What: SessionStart injects `~/.jz-agent-session-state/<session-id>.state.md`; Stop launches a headless `claude -p --safe-mode --tools "Read,Edit" --model haiku` updater that edits the record out-of-band — zero tokens, zero turns, nothing rendered; explicitly replaced main-agent-authored records.
   Evidence: `research-overlap-notes.md:65-70`.
   Integration class: `new member` — a hook pair feeding `.context/` (not `~/`), positioned before `b-save`; keep `b-save` as the git-portable checkpoint, hooks as the compaction-survival layer buck lacks (`research/local-research-memory.md` gaps).

9. **Two-phase PR topology (convention 7).**
   What: doc-only Plan PR on `plan-<slug>`, Implementation PR stacked on it (`impl-<slug>`), merge Plan PR first and let GitHub auto-retarget.
   Evidence: `research-overlap-notes.md:71-72`.
   Integration class: `fold-in` — extend `b-pr` (`skills/b-pr/SKILL.md:33-82`, `pr-preflight.ts` split of `implementation_files[]` vs `context_artifacts[]`) with a `--stacked-plan` variant; pairs with buck's existing `plan-*.md` vs `phase-N-*.md` split.

10. **Non-blocking mandate + secret-scan carve-out (conventions 11 + 12).**
    What: hard-cap inline waits at 30s with background-dispatch + poll as default; local pre-push secret scan never routed through MCP and never conditional on it.
    Evidence: `research-overlap-notes.md:82-85` (RULES.md wait cap, conductor dispatch-responsiveness mandate).
    Integration class: `fold-in` — patch `b-pr` preflight + `fix-pr` fetch paths (`skills/fix-pr/scripts/fetch-feedback.sh`) with the wait-cap rule, and add the secret-scan clause to `git-commit` / `b-pr` guards (`skills/git-commit/SKILL.md:47-50`).

## What docker-orchestration could adopt

Each draws from buck's genuine depth (`research-overlap-notes.md:87-94`). Integration classes use the same four-way vocabulary, read from upstream's side.

1. **Git-portable durable session record + memory index + backlog.**
   What: `.context/YYYY-MM-DD.<subject>/` subject folders with `index.md` `status:` (`draft|active|completed`), `.context/memory/<topic>-YYYY-MM-DD.md` session records, prepended `.context/memory/index.md` ledger, `.context/backlog/items/` queue — surviving compaction, new sessions, and repo clones.
   Evidence: `prompts/b-save.md:7-48`; `skills/b-save-improved/scripts/save-apply.ts:467-477`; `skills/_shared/subject-resolution.md:25-58` (per `research/local-research-memory.md` Q1/Q4).
   Integration class: `new member` — a `jz-session-save` station at conductor arc end, positioned after adversarial review and before deploy; replaces "rationale lives only in PR/ticket" for long arcs.

2. **`guardrails.json` contract with brownfield ratchet.**
   What: recorded thresholds (`coverage_min`, `coverage_target`, `cyclomatic_max`, `cyclomatic_hard_ceiling`, `patch_coverage_min: 90`) + baselines + burn-down plan; read-only measurer (`b-guardrails-check`, never edits) separate from one-shot initializer (`b-init-guardrails`).
   Evidence: `guardrails.json:1-241`; `skills/b-init-guardrails/docs/ratchet-protocol.md:82-175`; `skills/b-guardrails-check/SKILL.md:97-163` (per `research/local-build-review.md` Q4).
   Integration class: `repo init` — one `guardrails.json` per repo plus the discover-instead-of-hardcode gate pattern upstream already uses; then `fold-in` to the plan-executor closeout.

3. **Doc taxonomy: domain language vs decisions vs sequences.**
   What: the event/meaning/sequence split — `b-save` records the event (`.context/`), `b-docs` records the meaning (CONTEXT.md, `docs/adr/NNNN-slug.md`, conventions), `b-howto` records the sequence (`docs/howto/`, Diataxis, last step Eat); lazy ADR gate (hard-to-reverse + surprising + real trade-off).
   Evidence: `skills/b-docs/SKILL.md:13-15,93-111,176-188`; `skills/b-howto/HOWTO-FORMAT.md:6-8` (per `research/local-research-memory.md` Q3).
   Integration class: `standalone` — reference for the conductor's PR-body/ticket rationale; no chain position until upstream relaxes "files carry state, not history."

4. **Presentation/briefing artifacts for human gates.**
   What: `b-present` multi-page async briefing packages (`index.html` + detail pages + `sources/` + `manifest.json`) and `b-blueprint` single-page architecture posters (Mermaid + file-change map) generated from plan/phase/spec artifacts.
   Evidence: `skills/b-present/SKILL.md:49-139`; `skills/b-blueprint/SKILL.md:52-53,197-214` (per `research/local-planning.md`).
   Integration class: `new member` — generate the briefing package at the existing human gate before prod (alongside `jz-text-humanizer` release-notes polish), giving approvers something to read besides the diff.

5. **Dependency-typed phasing (HARD/SOFT/NONE).**
   What: `b-phase` maps dependency edges (not just order), stamps `depends_on`/`dependency_type` frontmatter, emits a Dependency Matrix + Parallel Opportunities section, and queues Phase 1 only.
   Evidence: `skills/b-phase/SKILL.md:88-124,152-175,277-307,373-380` (per `research/local-planning.md` Q1).
   Integration class: `fold-in` — patch `jz-plan-writer` / plan-executor ledger with the three edge types; upstream's stacked-PR topology already wants this signal.

## Non-goals / do not port

- **Never port the spine.** Both suites are deeper station-for-station in their own half — buck in frame/plan/challenge/remember breadth, jz in execute/review/converge/deploy depth. Lifting `b-brainstorm→b-plan→b-phase` into `.claude/` or the autonomous conductor into `skills/` would strand each suite's supporting mechanics (subject folders vs ledgers, guardrails vs adversarial lenses). Adopt mechanics, not spines.
- **JazzHR-bound domain skills stay home.** `jz-zuora-invoice-writeoff`, `jz-kafka-connect-api`, `jz-kibana-search`, `jz-deploy`, `jz-dev-commands`, `jz-cert` are PROJECT-BOUND on `*.priv.jazzhr.com` hosts, `resumator/*` repos, `smbprod/smbstaging` contexts, and `$JAZZHR_SRC_ROOT` bind mounts (`research/upstream-domain.md` Q2). Their patterns (human gate before money/prod, operation-scope classifiers, graceful degradation) transfer; their bodies do not.
- **Anything requiring the `jz` shell dispatcher.** `jz kibana|cert|composer|docker ...` flows execute `helper/scripts/*.sh` and `bin/appctl` under the docker-orchestration checkout (`research/upstream-domain.md` verdict). Without that checkout the skill text is a dead checklist — do not import the wrapper, import at most the safety-gate wording.
- **Upstream's "history lives in PR/ticket, not repo files" policy.** This directly contradicts buck's `.context/` durable-record contract (`skills/b-docs/SKILL.md:93-95` vs `research-overlap-notes.md:90-91`). Do not port the policy; treat the fork as intentional and keep buck's event/meaning/sequence split.
- **Buck's harness-specific wiring.** `prompts/`-to-`commands/` symlink mirror, `package.json` `pi`/`omp` keys, `extensions/index.ts` model-switch/TPS hooks, and `grill-me_dialog` doc-mode tooling (`research/local-harness-layer.md`, `research/local-interview-ux.md` gaps) solve Pi/OMP loading, not agent methodology. Upstream's 6-surface layout (commands + RULES.md + hooks + statusline + output-style + MCP docs) should not be "fixed" toward buck's 3-layer model or vice versa.

## Open questions

Renumbered globally (`Qn`, original scout prefix in parentheses for traceability). Dropped one duplicate: scout `Q-R3` (which harnesses ship the `b-save-improved` extension) is already answered by the harness-layer report (wired for Pi + OMP via `package.json:44,55`, portable `/b-save` fallback elsewhere).

- Q1 (Q-P1): Does `b-plan`'s standalone mini-workflow ever write `spec-*.md`, or only `plan-*.md`? Global artifact list names both (`skills/b-plan/SKILL.md:279-280`) but the standalone section mandates only `plan-*.md` (`skills/b-plan/SKILL.md:144-147`).
- Q2 (Q-P2): Is `brainstorm-state-*.json` consumed by any skill other than b-brainstorm resume logic, or is it resume-only?
- Q3 (Q-P3): When both b-present and b-blueprint run on the same subject, is `<slug>` derivation consistent between skills (no shared slug algorithm documented in either SKILL body)?
- Q4 (Q-P4): b-phase Step 1 still shows legacy `ls .context/plans/` discovery bash (`skills/b-phase/SKILL.md:33-37`) while other skills use the subject-folder convention — is `.context/plans/` still supported in practice?
- Q5 (Q-P5): For Obsidian-mode b-arch-qa, is the discussion doc ever linked from subject `index.md`, or does it remain outside the Buck subject-folder artifact graph (`skills/b-arch-qa/SKILL.md:166` mentions `research:` in plans but not vault paths)?
- Q6 (Q-B1): Is the `code-review` skill's `/mnt/c/Code/plans/` output path intentional for buck-workflow-pi, or stale copy from another project (`skills/code-review/SKILL.md:134`)?
- Q7 (Q-B2): Does `code-review-universal`'s "Brutally-honest" `code-review` variant refer to the same `skills/code-review/SKILL.md` release prompt, or a missing/alternate skill body that writes `CODE-REVIEW.md` at repo root (`skills/code-review-universal/SKILL.md:51`)?
- Q8 (Q-B3): Should `b-build` hard-mode "manual verification" (`skills/b-build/SKILL.md:55`) ever bypass `/b-guardrails-check`, or is that always subordinate to the deterministic contract (`skills/b-build/SKILL.md:331`)?
- Q9 (Q-R1): Should `current-session.json` be removed from b-save/subject-resolution read paths, or should b-save-improved start writing it again (unwritten since 2026-06-05 per `skills/b-save-improved/SKILL.md:38-40`)?
- Q10 (Q-R2): Is there a planned merge of llm-wiki-vault synthesis back into Buck `.context/` subject folders for b-plan consumption, or are these intentionally separate corpora?
- Q11 (Q-G1): Does `b-pr-review-2-issues`'s `gh pr view --comments` capture inline review threads, or only conversation comments? One fetch call (`skills/b-pr-review-2-issues/SKILL.md:60`) vs `fix-pr`'s three API surfaces (`skills/fix-pr/SKILL.md:122-124`) suggests possible under-ingestion.
- Q12 (Q-G2): Is `extensions/b-commit-improved/index.ts` always present in consumer repos, or only in buck-workflow-pi itself (`skills/git-commit-improved/SKILL.md:37-40`)?
- Q13 (Q-G3): Should `b-issue-create` and `fix-pr` share label conventions (`ready-for-agent`, `needs-triage`) via a single canonical doc, or are `docs/agents/triage-labels.md` paths guaranteed in every consumer repo?
- Q14 (Q-U1): Is `grill.py` duplicated intentionally in both `b-grill/` and `b-grill-auto/`, and which path is canonical for maintenance?
- Q15 (Q-U2): Does the harness always provide `grill-me_dialog`, or is doc mode degraded in some runtimes (OMP vs Pi)?
- Q16 (Q-U3): Should `design-brief`'s Tailwind breakpoint assumption be generalized for non-Tailwind stacks (`skills/design-brief/SKILL.md:27`)?
- Q17 (Q-U4): Is `rails-app` intended to remain project-specific (PartyPic patterns) or evolve into a generic Rails reference?
- Q18 (Q-U5): Will ux-guide/styleguide JSON schema reconciliation (`skills/b-create-ux-guide/BACKLOG.md:3-7`) land as optional fields in ux-guide, unblocking silent handoff?
- Q19 (Q-H1): Should `README.md` / `docs/extension-loading.md` be updated to list all submodules wired from `extensions/index.ts`, or should some improved commands be split behind separate opt-in manifest entries?
- Q20 (Q-H2): Should `product-tour` and `git-clean-orphans` gain `prompts/` twins for Pi parity, or remain OMP-only discoveries intentional?
- Q21 (Q-H3): Is `tmux-window-status.ts` slated for re-wiring behind a flag, or permanent archival alongside `b-flow`?
- Q22 (Q-D1): Is `jz-worktree` intended to integrate with a ticket prefix convention elsewhere (e.g. `jz-autonomous-development` or `jz-ticket-writer`) even though the skill omits ticket IDs?
- Q23 (Q-D2): Does `zuora_writeoff.py`'s `_check_env_safety` hard block on `--env prod` at runtime contradict the skill body's documented prod override flags (`--env prod --ticket --params-file`), or is prod access always expected to require editing the script's `_SAFE_ENVS` frozenset?
- Q24 (Q-D3): Are Postman workspace/collection UUIDs in `postman-mcp.md` stable enough for automation, or does the skill's "rediscover on failure" path get exercised frequently?
- Q25 (Q-D4): Is there a planned skill for local `jz logs` + correlation ID workflow, or is remote kibana search considered sufficient for all agent debugging?

## Adoption plan (companion report, 2026-09-11)

Deliverable: `presentations/2026-09-11.buck-vs-docker-orchestration-overlap/adoption-plan.html`, linked from §09 and the TOC of the main report (`index.html`). Analysis only — no skill, prompt, extension or config file was modified.

**Direction verdict: build on buck, import jz's closing mechanics.** The merge direction follows cost. buck's two structural advantages (git-portable durable record written through `skills/_shared/subject-resolution.md`; recorded numeric contract with baseline history in `guardrails.json`) only work because every station writes through them — jz would re-architect 24 skills to gain either. jz's advantages are rules and leaf skills that fold into existing buck stations (~10 patches). Stated cost of the choice: buck's terminal state is a PR URL — no CI-green loop, no deploy station, `b-loop` stamps a recommendation and stops. The single most valuable jz idea is not a skill: *iteration is a mode with a named exit condition, never a skill name*.

Three forks (from `## Lifecycle stage map` + `## Capability matrix`): (1) **where truth lives** — repo vs tracker; intentional policy fork, do not cross. (2) **what enforces quality** — recorded numbers vs adversarial process; complements, cross both ways. (3) **who closes the loop** — human-typed stations vs conductor; cross the *contract*, not the conductor.

Inbound waves (renumbering of `## What buck-workflow-pi could adopt`, now with placement + acceptance): **wave 1 furniture** — skill-contract lint wired into `package.json` `scripts.test` (already `prepublishOnly`, already the only thing `.github/workflows/test.yml:22-23` runs); `skills/RETIRED` + purge clause in `scripts/install.mjs`; 30s inline-wait cap in `GLOBAL_OR_PROJECT-AGENTS.md`; `skills/_shared/untrusted-data.md`. **Wave 2 holes** — `b-debug`; restraint lens into `b-review` §Issue Classification (`SKILL.md:149`) and `fix-pr` validate (`SKILL.md:174-203`); requirement IDs across `b-nasa-prd`/`b-plan`/`b-phase`/`b-review`. **Wave 3 closing** — `skills/_shared/convergence.md` (collapses `b-pr-review-2-issues` + `fix-pr` into one mode-flagged skill); `b-converge` CI-green/bot loop after `b-pr`; confined different-model dispatch folded into `code-review-universal` reusing `skills/b-grill-auto/grill.py`; `b-skill-writer`. Sequencing constraints: wave 3 blocked on the wait cap; IDs and convergence never share a cycle.

Three explicit declines (new, not in the ranked list above): **prose de-tell pass** collides with the always-on Response Style block in the bootstrap — scope to release notes/PR bodies or skip; **two-phase PR topology** is already solved inside one PR by `b-pr`'s `implementation_files[]` vs `context_artifacts[]` split — adopt only on the `b-issue-create` AFK path; **hook-driven session state** — take the requirement (compaction survival), reject the mechanism (Stop-hook headless model), because the cheap equivalent is extending the existing write-gate from `b-research`/`b-explore`/`b-capture` to `b-build`/`b-review`.

### Two defects verified in the working tree while sizing the plan

- **`docs/agents/` does not exist.** `skills/b-issue-create/SKILL.md:38-39` cites `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`. Confirms (does not extend) open defect 2 from the 2026-09-10 mattpocock audit, now verified against `f797174`+.
- **The prompts↔commands mirror is broken for four commands.** `README.md:241` and `docs/extension-loading.md:79-103` document `commands/*.md` as symlinks to `../prompts/*.md` (single source of truth). Actual: 8 of 37 are regular files, and 4 shadow a *diverging* twin — `b-pr` (13 lines vs 62), `b-pr-review-2-issues` (13 vs 50), `b-commit-improved` (19 vs 13), `b-save-improved` (20 vs 13). `commands/b-pr.md` is a thin skill loader; `prompts/b-pr.md` is a full inline procedure predating the skill, so Pi and OMP users typing `/b-pr` follow different instructions. Supersedes the narrower gap recorded in `research/local-harness-layer.md` ("four `commands/` files lack `prompts/` twins") and answers Q20 in part. This is the acceptance fixture for inbound item 1.
