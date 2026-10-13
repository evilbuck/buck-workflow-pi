---
status: active
date: 2026-10-10
subject: 2026-10-10.durable-storage-adapters
topics: [persistence-inventory, storage-adapters, cutover]
related: [plan-durable-storage-adapters.md, phase-1-contract-config-identity.md]
priority: high
---

# Buck-owned persistence inventory (Phase 1 census)

Current-code family census, including instruction-defined writers. Rows distinguish canonical retained bodies/evidence from rebuildable exports and excluded configuration/host stores. “Cutover verification” names the behavior Phase 3–8 must prove; inventory completion does not claim those migrations are implemented.

| Path / group | Artifact kind | Scope | Consumer | Cutover verification |
|---|---|---|---|---|
| `.context/<subject>/{plan,research,spec,phase,review,iterate,index}.md` | knowledge artifacts, lifecycle metadata | project + branch; published integration view | skills, lifecycle helper, plan bridge, plans site | current branch overlay and published baseline; IDs/links/content preserved |
| `.context/memory/*.md`, `.context/backlog/**` | memory, corrections, backlog | project + branch; published integration view | recall, b-memory-import, subject picker | private branch excluded before ranking/LIMIT; scoped corrections; legacy ambiguous rows quarantined |
| `.context/workflow/**` | run state, receipts, commit drafts, checkpoint evidence | project + branch + worktree + run | buck-loop, b-save, resume/commit | exact run identity and receipt binding; failed persistence blocks completion |
| `.context/**/sql-memory-receipts/**` | save receipts | run-private plus referenced artifact | b-save/buck-loop save stage | same-attempt identity, complete metadata duties, no false save success |
| `extensions/sql-memory/`, `migrations/` | memories, ranks, corrections, migration provenance | project + branch/revision after cutover | native SQL tool, migration/admin | stable IDs/ranks/history; no generic ordinary SQL recall bypass |
| `extensions/buck-loop/{scan,persist,project-memory,sql-save,loop,run-state}.ts` | resume projections, checkpoints, activity, save receipts, memory recall | project + branch + worktree + run; knowledge view for memories | extension runtime and restricted child sessions | authoritative artifacts beat projections; visibility before model context; stale attempts refused |
| `extensions/b-save-improved/`, `skills/b-save-improved/scripts/{save-preflight,save-apply}.ts` | save batches, lifecycle updates, receipts | project + branch + worktree + run | both save entry points | same-adapter atomic batch/readback; lifecycle evidence/refusals preserved |
| `skills/_shared/scripts/{subject-lifecycle,context-helpers,plan-acceptance}.ts` | lifecycle/index/acceptance artifacts | project + branch | shared skills/scripts | conditional transitions and acceptance evidence unchanged through adapter |
| `extensions/plan-artifact.ts` | plan/spec/phase writes and subject activation | project + branch | plan-mode bridge | logical artifact writes and verified lifecycle transition |
| `hooks/post/turn-memory.ts`, `extensions/turn-memory/` | turn-memory capture/dedupe | branch + worktree + run | post-turn hook | idempotency is branch/run scoped; host session state untouched |
| `extensions/token-attribution/` | Buck-owned token attribution rows | machine/project + run | attribution extension | Buck-owned rows export/import; host stats/session rows remain untouched |
| `extensions/code-review-iteration/{run-state,report,loop}.ts` | immutable pass reports, state and command evidence | run-private; selected reusable report may be knowledge | review iteration extension | immutable pass evidence and run isolation retained; execution policy unchanged |
| `skills/b-memory-import/scripts/import-context-memory.ts` | import manifests, imported memories | project + source scope | memory importer | selected adapter source, stable IDs/hashes/links; no branch leak to harness LTM |
| `docs/plans/src/lib/plans/{index,sql}.ts` | plan-site read projection | configured project + visible branch | plans site | real adapter-backed source on actual site; no SQL stub as source-of-truth |
| `extensions/index.ts`, package/install discovery | adapter config/runtime registration | machine config + project identity | OMP/Pi runtime and CLI | same config resolved in extension, hooks, child sessions and CLI |
| `extensions/b-commit-improved/index.ts` | draft commit artifact | project + branch | `/b-commit` fallback writer | draft references logical artifact identity; repo-files projection retains current path |
| `extensions/buck-loop/{activity-log,ambiguity,choice,phase-completion,ranking}.ts` | transition audits, phase lifecycle updates, review rankings, retained activity log and `.git/info/exclude` hygiene | run-private or project + branch according to artifact kind | buck-loop supervisor and review/rank flow | exact scope and immutable audit evidence survive resume; Git-local exclude stays local configuration |
| `extensions/buck-loop/sql-save.ts` | SQL save attempt/receipt projection | project + branch + run | save verifier and loop resume | attempt/receipt identity readback on the authoritative adapter; projection never overrides artifacts |
| `skills/fix-pr/scripts/fetch-feedback.ts` | PR feedback inventory / transient review input | private run scope | fix-pr skill | run data is isolated and retained only where recovery requires it |
| `extensions/code-review-iteration/` under Git common-dir | pass directories, mutable run state and JSONL commands | private review run | review loop and disposable reviewer/fixer | immutable pass snapshots, atomic state updates and run recovery preserved |
| `extensions/plan-artifact.ts` | subject index and generated plan artifacts | project + branch | plan-artifact bridge | logical writes plus lifecycle/index consistency verified through the shared adapter |
| `skills/b-memory-import/scripts/import-context-memory.ts` | import manifests and imported memory records | project + source scope | memory importer | stable source identity/hash and scoped adapter writes; host LTM remains external |
| `extensions/omp-models.ts` | user-selected model-profile configuration | machine or project settings file | OMP model-profile commands | intentionally remains configuration, not knowledge/run state; config precedence and atomic edit behavior unchanged |
| `extensions/turn-memory/` | host session journal entries | host session store | post-turn memory capture | intentionally excluded from adapter ownership; Buck indexes/exports only its own records |
| `extensions/token-attribution/` | Buck token attribution database and cursors | machine/project + run | attribution extension | adapter boundary retains Buck-owned rows and cursor semantics; host session records untouched |
| `skills/_shared/scripts/context-helpers.ts` | generated `.context/index/*.json` indexes | project + visible branch | subject/context discovery | rebuildable projections regenerated from authoritative artifacts; never treated as source-of-truth |
| `skills/b-auto-fix/` | run, issue-stage, PR-body and soft-fail evidence | project + branch + run | automated issue-fix workflow | run identity/resume behavior retained; transient prompts distinguished from durable evidence |
| `skills/b-pr/scripts/pr-preflight.ts` | selected base-ref cache | project-local configuration | PR preflight | local cache semantics unchanged; not shared artifact data |
| OMP model settings / hook installation files | user preferences and installed executable configuration | machine or project configuration | installer and model-profile commands | intentionally remain config/install state, not migrated knowledge or run state |
| `skills/_shared/scripts/render-design-tokens.ts` | generated design-token/mermaid blocks spliced into consumer files | repo docs (generated projection) | docs generation script | rebuildable projection regenerated from the brief; never treated as source-of-truth |
| `extensions/fix-pr-feedback/index.ts` | transient seen-ids temp file in `mkdtemp` directory | private run scope, process-lifetime | fix-pr feedback extension | intentionally excluded from adapter ownership; no durable artifact is written |
| `presentations/<slug>/*.html` and package `assets/**` (CSS/JS/images/binary payloads) | retained presentation package / attachment | project + owning subject + branch | writers: `skills/b-present/SKILL.md:41-64`, `skills/b-blueprint/SKILL.md:51-56`; readers: browser and `scripts/serve-presentations.ts:145-149` | retain exact package bytes/hashes, media types and relative links in chosen adapter; serve a scoped optional export without exposing another branch's package |
| `presentations/<slug>/sources/**` (copied Markdown and rendered source views) | attachment / source snapshot | same subject/branch as retained package | writer: b-present Step 5 (`SKILL.md:123`); readers: package source views and `assets/render-md.js`, static server | preserve source snapshots matching synthesis provenance, not latest mutable source; round-trip source bytes and linked source HTML |
| `presentations/<slug>/manifest.json` | retained package manifest / provenance | project + subject + branch | writer/reader: b-present Step 6 (`SKILL.md:125-139`) on generation/regeneration; preview server reads as bytes | retain page/source inventory and source-artifact links with package revision; regenerate optional export and remove stale export files only, never canonical attachment revisions |
| `.context/<subject>/{brainstorm-*,brainstorm-state-*,grill-*,grill-qa-*,design-brief-*,comment-*,items/*,notes/**,research/**}` | intake/research/capture/review knowledge plus interview state and attachments | project + branch; process-progress sidecars private to run where applicable | b-brainstorm, b-capture, b-grill variants, b-research, b-explore, design-brief, b-pr-review-2-issues, b-issue-create; downstream plan/phase/review/recall | exact frontmatter, captures (including binary source payloads), citations and relative links preserved; mutable interview progress separated from reusable knowledge |
| `.context/<subject>/{draft-commit*,transition-audits/**,ranking-*,eval-*,guardrails-*,build-*}` and legacy `.context/{plans,specs}/**` | draft/evidence/audit and legacy knowledge | owning branch; evidence/run scratch additionally worktree + run | b-build/iterate/review/save/commit, buck-loop, guardrails and legacy subject resolution | old/new layout imported with scope/provenance; run evidence not promoted with knowledge; drafts reference exact logical artifact revisions |
| `docs/{adr,howto,agents}/**`, `CONTEXT.md`, generated UX/styleguide HTML/JSON/Markdown and user-selected equivalent paths | living project documentation / generated deliverables | repository/project code documentation | b-docs, b-howto, b-init-tracker, b-create-ux-guide, b-create-styleguide; agents/developers/site | remain repo source when living code docs; retained session-linked exports/attachments enter adapter only when explicitly owned by a subject; preserve links, no automatic migration of application templates/routes |
| `CODE-REVIEW.md`, `.worktrees/pr-<N>/{pr-context.json,pr.diff}`, user-selected thought-dump output/checkpoint script | review knowledge, private pinned review inputs, user source | branch knowledge / run-private worktree / user source respectively | code-review, code-review-universal PR-context scripts, thought-dump-writer | retain Buck-owned review/input evidence with pinned SHA and run scope; leave user's application source/checkpoint executable under Git, no host-worktree takeover |
| Vault `40_Archives/Raw-Sources/**`, raw/wiki notes; external issue bodies/comments/labels | external vault/tracker-owned knowledge | externally selected vault/project | llm-wiki-vault, b-arch-qa vault/custom destination, b-issue-create, b-triage, fix-pr | excluded external authority; retain only Buck-owned local references/captures, never silently mirror private drafts into unscoped vault/tracker |
| `.context/grill-model.txt`, `guardrails.json`, `.env`, hook/installer targets, tracker/styleguide agent wiring | local configuration, secrets, executable installation | machine/repo configuration | b-grill, b-init-guardrails, b-wizard, installer, b-init-factory/tracker/styleguide | excluded from knowledge adapter; credentials remain environment/config-secret management, not artifact payloads |







## Discovery boundary

Census extended 2026-10-10 beyond filesystem-call discovery: instruction-defined write boundaries/output paths searched across all `skills/*/SKILL.md` (58 matching files, all three result pages examined), including b-present, b-blueprint, capture/research/grill, UX/styleguide, review, vault and tracker destinations. Presentation ownership verified against `skills/b-present/SKILL.md:41-64,123-151` and the actual byte reader `scripts/serve-presentations.ts:145-149`; parent plan §2 and affected files require retained binary/package data, not merely disposable previews.

Canonical retention: session artifacts, retained presentation packages, copied source snapshots/manifests, Buck-owned run/evidence/import/attribution rows. Optional exports: preview/editor/site files materialized from an explicitly selected retained revision; generated indexes/design-token blocks are rebuildable projections. Excluded authority: living application/code docs, installation/preferences/secrets, external tracker/vault state and host sessions. A skill's “disposable generated output” describes its editable preview, not permission to discard a package retained under this plan.

## Phase 5 reconciliation (2026-10-13)

Every census row is reconciled below: migrated onto the storage contract this phase, or explicitly excluded/projection by design. "Store-backed" means bytes land on the configured adapter through `commitConsumerBatch`/`scheduleConfiguredRetain` in `skills/_shared/storage/consumers.ts` with a receipt-bearing run; "projection" means the file/write stays the repo-files projection the loop's readers use while the store holds the sealed copy.

| Census row | Disposition | Evidence |
|---|---|---|
| `.context/<subject>/{plan,research,spec,phase,review,iterate,index}.md` | store-backed (save-apply seal classifies each artifact kind; loop review/phase/ranking writers retain per write) | `save-apply.ts` sealAppliedBytes; `loop.ts` persistReviewArtifact; `phase-completion.ts` retains; `ranking.ts` default writer retains |
| `.context/memory/*.md`, `.context/backlog/**` | store-backed (seal) + recall through `workflow_state` visibility (Phase 4) | save-apply seal; `recall-project-memories.md` |
| `.context/workflow/**` (run state, receipts, drafts, checkpoints) | sqlite fast-path mirror kept for synchronous resume reads; non-sqlite adapters retain via `scheduleConfiguredRetain`; save drafts/receipts went through `saveSqlFacts`/`write-receipt` in Phases 3–4 | `persist.ts` mirrorResume; `sql-save.ts` |
| `.context/**/sql-memory-receipts/**` | store-backed (attempt receipts on the same adapter; Phase 3 rules) | `commitConsumerBatch`; `workflow_state write-receipt` |
| `extensions/sql-memory/`, `migrations/` | admin/migration surface stays CLI-only (Phase 4 decision); model-facing raw SQL removed from the loop | Phase 4 file, criterion 4 |
| `extensions/buck-loop/{scan,persist,loop,...}` resume/checkpoint/activity | store-backed: resume bookmark (above), activity log retained on close, transition/repair audits retained per write | `persist.ts`; `activity-log.ts` close; `choice.ts` writeAudit; `ambiguity.ts` askRepairLift |
| `extensions/b-save-improved/`, `save-preflight/save-apply` | both save pipelines on one contract: `saveSqlFacts` (SQL mode, Phase 3–4) and file-mode seal (this phase) | `save-apply.ts` sealAppliedBytes |
| `skills/_shared/scripts/{subject-lifecycle,context-helpers,plan-acceptance}` | store-backed through Phase 3 domain ports; lifecycle authority unchanged | Phase 3 file |
| `extensions/plan-artifact.ts` | store-backed via `workflow_state write` (Phase 4 bridge) | Phase 4 file |
| `hooks/post/turn-memory.ts`, `extensions/turn-memory/` | store-backed (configured store; host session journal untouched) | first-pass note; `turn-memory.ts` |
| `extensions/token-attribution/` | store-backed rows + receipts; host `messages`/stats rows untouched | `db.ts` insert retain; db.test.ts |
| `extensions/code-review-iteration/{run-state,report,loop}.ts` | store-backed: `state.json` run-state retain; review/fixer markdown+json, commands.jsonl audit retains; final report review-kind retain; immutable-refusal and execution policy unchanged | `run-state.ts`; `report.ts`; run-state.test.ts |
| `b-memory-import` manifests | store-backed audit retain beside the file | `import-context-memory.ts` saveManifest |
| `docs/plans/src/lib/plans/` | migrated (SqlPlanSource reads visible plan artifacts through the store; fake SQL stub removed) — first pass | phase notes |
| `extensions/index.ts`, package/install discovery | config/identity registration unchanged (Phases 1–4); installer ships `consumers.ts` (added to SHIPPED_STORAGE_FILES) | `scripts/install.mjs` |
| `extensions/b-commit-improved/index.ts` draft commit | projection: repo-files path retained for the file-mode fallback writer; logical identity via subject tokens (Phase 4) | Phase 4 |
| `activity-log,ambiguity,choice,phase-completion,ranking` transition audits/rankings | store-backed per write (see buck-loop row) | this phase |
| `buck-loop/sql-save.ts` receipt projection | projection + authoritative adapter receipts (Phase 3–4) | `sql-save.ts` |
| `skills/fix-pr/scripts/fetch-feedback.ts` | excluded: transient run input, process-lifetime | census row unchanged |
| code-review runtime under Git common-dir | projection: run/fixer runtime stays on disk (resume reads it); store holds the retained copies above; immutable pass semantics preserved | run-state.ts |
| OMP model settings / hooks install / omp-models | excluded: configuration and install state | census rows unchanged |
| `context-helpers` generated indexes | projection: rebuildable, regenerated from authoritative artifacts | census note |
| b-auto-fix, b-pr preflight cache | excluded: run-private transient / local cache | census rows unchanged |
| render-design-tokens generated blocks | projection: rebuildable docs generation | census row unchanged |
| fix-pr-feedback temp dir | excluded: process-lifetime temp | census row unchanged |
| presentations packages + sources + manifest | store-backed: `retainPresentationPackage` retains exact bytes (binary intact, symlink refusal) via `b-present` Step 6b; on-disk package remains the served export | consumers.ts; b-present SKILL Step 6b; consumer-persist tests |
| `.context` intake/research/capture/grill/design-brief sidecars | store-backed when saved through save-apply seal (classified kinds) or workflow_state writes (Phase 4 skill sweep); interview progress sidecars remain run-private until saved | classifyContextPath |
| draft-commit/transition-audits/ranking/eval/guardrails/build evidence | store-backed for transition/ranking/review evidence (this phase); remaining run-scratch evidence retains on next save | this phase |
| living docs (`docs/`, ADRs, CONTEXT.md), generated UX/styleguide | excluded: repository code documentation | census row unchanged |
| CODE-REVIEW.md, pinned PR inputs, thought-dump user source | excluded/pinned user-owned inputs | census rows unchanged |
| external vault/tracker-owned knowledge | excluded external authority | census row unchanged |
| `.context/grill-model.txt`, `guardrails.json`, `.env`, installer targets | excluded: config/secrets/install state | census rows unchanged |

Known follow-ups owned by later phases: cross-worktree async resume reads under postgres/external-files (Phase 6 recovery tooling), legacy-data import of historical audits (Phase 7 cutover), end-to-end per-adapter exercise (Phase 8).

The table closes the currently identified persistence families using the parent affected-file list, earlier code-wide filesystem census and this instruction census. It is not a claim that arbitrary user-selected destinations or future code are discoverable from a regex. Re-run both code-call and instruction-boundary discovery at each consumer cutover; check each family's concrete behavior above before declaring migration complete. No consumer was migrated in Phase 1.
