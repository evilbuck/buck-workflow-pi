---
status: active
date: 2026-10-10
subject: 2026-10-10.durable-storage-adapters
topics: [storage-adapters, configuration, branch-isolation, sqlite, postgresql]
research: [research-durable-storage-adapters.md]
iterations: []
memory: []
---

# Plan: Configurable durable workflow storage

## User Goal
Buck Workflow users can choose where their durable workflow state lives, resume it reliably across sessions and worktrees, and keep unmerged work out of unrelated branches' ordinary retrieval.

Confirmed by the user in this planning session.

## Goal
Provide one configurable storage service for every Buck-owned durable record, with four complete backends: repository `.context/` files, external per-project files, machine-local SQLite, and PostgreSQL. Preserve lifecycle/save/checkpoint semantics while replacing filesystem-specific access and immediate project-wide SQL recall. Storage selection and visibility are separate responsibilities; every normal read follows the same visibility contract.

## Context used / assumptions
- User requires all four backends, all Buck-owned durable state, and current-branch-plus-merged visibility including memories.
- User prefers a CENTRAL manifest in machine storage or database, not a tracked repository manifest. Automatic promotion is permitted for ancestry-proven sealed checkpoints; rewritten-history mappings remain explicit.
- Research: `research-durable-storage-adapters.md`; rolling notes and authoritative source URLs in `research/`.
- Existing PostgreSQL memory policy shares records immediately across branches (`docs/sql-memory.md:28`, `extensions/buck-loop/project-memory.ts:77-84`). This plan intentionally replaces that policy; it does not claim the existing code already isolates branches.
- Existing subject lifecycle authority, receipt verification, immutable memory content, and commit proof remain authoritative. Physical Markdown paths and raw SQL are not domain identity.
- Existing dependencies: pg/yaml; existing machine SQLite precedent in `extensions/token-attribution/db.ts`; numbered checksummed migrations in `extensions/sql-memory/migrations.ts`.
- Runtime validation later completed in Phase 1: transactional probes passed under actual OMP Node v26.3.0, standalone Node 22.23.3 (the CI major), and Bun 1.4.0; Node 18.20.8 exercised the explicit unsupported-runtime refusal. CI's Node 22 job runs the same `npm test` runtime probe.
- Capability probe: full; source: injected active-session available-skills catalog; b-build/b-review/b-save all present. b-phase and b-research also catalogued. No execution primitive has been enabled or configured.

## Light Grill
- Q1: Confirm the user-facing goal? → resolved: user confirmed the User Goal above.
- Q2: What should ordinary fetch/recall see? → resolved: current branch plus merged state for ALL knowledge artifacts, including memories (recommended).
- Q3: Which candidate backends are required? → resolved: repository files, external project files, SQLite, PostgreSQL; none deferred out of implementation scope.
- Q4: May a tracked repository manifest attest external revisions? → resolved: user prefers a central manifest in `~/.config/buck-workflow/` or the database; repository-manifest recommendation rejected.
- Q5: How do centralized checkpoints publish? → resolved: automatic only when ancestry proves the associated checkpoint commit merged; squash/rebase require explicit verified mapping (recommended).
- Q6: Does all durable state include execution/evidence records? → resolved: all Buck-owned durable state, including runtime checkpoints, receipts, audit/review evidence, and retained attachments/presentations. Run-specific state remains private (recommended).

## Decision Closure
**Selected course:** a shared typed artifact service, backend-neutral tools/CLI, and a common visibility resolver. Four required adapters; central immutable revision/checkpoint manifest; exact checkpoint promotion on proven ancestry; explicit mapping for rewritten history. Use pg plus confined node:sqlite rather than adopting an ORM. Machine text configuration selects one authoritative backend per project. No dual-write fallback or tracked repository manifest.

**Evidence:** user decisions above; current cross-branch recall and project-scoped idempotency; filesystem-bound lifecycle/save/scan consumers; existing SQLite and migration patterns; research on SQL drivers and Git ancestry limits. The broad adapter is needed because multiple physical media are explicitly required; the extra ORM abstraction is not.

**Trade-off:** centralized manifests attest the chosen external revision set. Git proves the bound commit is integrated; Git does NOT contain or prove review of external artifact bytes. External state does not automatically travel with a clone. This follows the user's central-manifest preference, not an equivalence claim to Git-tracked artifacts.

**Excluded scope:** host OMP/session/LTM database replacement, new access-control system, vector-search feature, automatic destructive cleanup, arbitrary branch merging, new review execution policy, living source/docs relocation, unrelated defect cleanup.

**Next action:** phase this plan, beginning with the shared configuration/identity/artifact contract and conformance fixtures. Do not deploy a subset of adapters as the completed feature.

## Assumptions Ledger
| id | statement | status | blocking | evidence | validation_path |
|---|---|---|---|---|---|
| A-1 | All four backends are required, including all knowledge and run-private Buck state. | validated | false | Explicit backend and scope selections in this session. | — |
| A-2 | Ordinary memory retrieval must stop being immediately project-wide. | validated | false | User selected current branch + merged for all artifacts; existing policy confirmed in code/docs. | — |
| A-3 | Central checkpoint attestation, rather than tracked artifact bodies/manifest, is the chosen publication policy. | validated | false | User custom manifest preference and subsequent promotion selection. | — |
| A-4 | node:sqlite can support the deployed OMP and supported CLI/CI runtimes without an additional ORM or native addon. | validated | false | Transactional write/commit/read and rollback smokes passed under OMP 18.8.9's actual runtime (Node v26.3.0), standalone Node v22.23.3 matching CI's Node 22 major, supported Bun 1.4.0, and local Node v26.8.1. A CI-invoked `npm run test:sqlite-runtime` now covers Node and Bun. The adapter's explicit refusal ran on Node v18.20.8, where `node:sqlite` is unavailable. | CI executes the Node+Bun smoke from `npm test`; keep SQLite lazy-loaded and rerun the OMP-session probe when the supported OMP runtime changes. |
| A-5 | Existing records may lack exact branch/revision/checkpoint evidence. | validated | false | Existing memory provenance/idempotency schema and cross-branch policy lack sealed artifact checkpoint mappings. Import preserves but quarantines ambiguous records. | — |

No unresolved assumption blocks finalizing the design. Deferred runtime verification is an explicit implementation gate, not permission to ship an unverified backend.

## Material Risks
1. **failure_mode:** new drafts are bound to inherited integration HEAD and automatically published. **impact:** unrelated branches retrieve unmerged state. **mitigation:** immutable exact checkpoint revision sets, explicit binding, eligibility checks against integration tip at sealing; creation HEAD is never proof. **rollback_or_fallback:** revoke the affected publication pointer and retain private revisions/checkpoint evidence. **validation_path:** Git fixture seals v1, edits v2 after seal, merges anchor, and proves only v1 becomes shared; inherited-main-anchor fixture refuses automatic publication.
2. **failure_mode:** branch deletion/rename/reuse, force-push, detached HEAD, or stale refs misclassify state. **impact:** leakage or loss of resumable work. **mitigation:** stable branch incarnation IDs, worktree/run IDs, exact commit/ref evidence, fail closed on Git errors; no deletion-based promotion or cleanup. **rollback_or_fallback:** explicit recovery lookup and branch rebinding; retain checkpoint revisions. **validation_path:** Step 6 branch/ref matrix including missing integration ref, rewritten/deleted anchor, and recycled branch name.
3. **failure_mode:** central service read paths or raw SQL bypass visibility. **impact:** private bodies enter model context before filtering. **mitigation:** apply visibility before body loading/ranking/LIMIT/pagination; one native read surface; no ordinary unrestricted knowledge SQL tool. **rollback_or_fallback:** disable the leaking caller/operation until fixed, retaining stored records; never substitute project-wide recall. **validation_path:** inject high-scoring private candidates and paginate; inspect child prompt/tool responses across every adapter. Query isolation is NOT DB-user authorization; DB/file operators can still inspect underlying storage.
4. **failure_mode:** migration/switch crashes or loses corrections, links, receipts, attachments, or closed-subject provenance. **impact:** lost knowledge or unsafe completion/resume. **mitigation:** read-only source, scoped export with IDs/hashes/lineage, destination verification, explicit atomic cutover, no source deletion. **rollback_or_fallback:** switch to the verified pre-cutover source snapshot; recover post-cutover revisions via the same export/import route before rollback when new writes exist. **validation_path:** interrupt import and config cutover; compare bodies, IDs, scoped lineage and attachment hashes; perform round-trip export/import with post-cutover writes.
5. **failure_mode:** partial/concurrent writes or global memory supersession. **impact:** false save completion or another branch's knowledge invalidated. **mitigation:** expected-revision concurrency control, scoped idempotency, transactional commit boundary, branch-local correction overlays, same-scope readback and complete receipts. **rollback_or_fallback:** reject stale writes, resume the recorded attempt, keep previous committed snapshot; no backend fallback. **validation_path:** two writers and crash-before/after-commit fixtures; corrections on branch A leave branch B's published predecessor valid.
6. **failure_mode:** credentials, mutable DB files, or private manifests get committed through dotfiles. **impact:** secret/private-state disclosure. **mitigation:** text config contains credential ENV references only; clearly separate config from generated state, restrictive permissions, docs for chezmoi/stow exclusions. **rollback_or_fallback:** restore non-secret config, move private state out of tracked dotfile inputs, rotate exposed credentials when exposure occurs. **validation_path:** config/doctor/export redaction checks and a sample dotfile-managed config showing DB/manifests excluded; no automated credential rotation.

## Scope
- One resolved machine/project configuration and project/branch/worktree/run identity contract.
- Four authoritative persistence adapters, including text and binary payloads.
- Knowledge: brainstorms, captures/grills, research, specs, plans, phases, review/iterate documents, memories/corrections, backlog, subject metadata/links, retained presentation packages and attachments.
- Control/evidence: lifecycle provenance, save attempts/receipts, run/resume checkpoints, commit drafts/checkpoint evidence, retained activity/transition/pass audits, importer manifests, Buck-owned attribution records and dedupe records.
- Current branch + published integration state retrieval; explicit cross-branch/recovery inspection.
- Central checkpoint manifests, merged-publication reconciliation, safe orphan handling.
- Existing storage migration, scoped export/import, verified switching and recovery.
- All affected OMP writers/readers and portable skill/CLI contracts; packaging/docs.

## Out of scope
- Replacing OMP's own session storage, stats schema, or harness-managed LTM. Move only Buck-owned attribution rows; never move/delete host-owned rows/database.
- Relocating living repository source/docs. Generated presentation exports may remain user-selected deliverables; their retained canonical package is adapter-backed.
- Vector/embedding search, exact numerical rank parity between PostgreSQL/SQLite/files, general-purpose ORM or plugin marketplace for third-party adapters.
- Automatic fetch/merge/rebase, branch deletion, garbage collection, indefinite background syncing, automatic SQL-to-file fallback, dual-write operation, credential installation or dotfile-manager modification.
- Reworking existing review allowlists/state-machine routing or unrelated stale artifacts.

## Design contract

### 1. Configuration
Canonical text file: `${XDG_CONFIG_HOME:-~/.config}/buck-workflow/config.yaml`. Optional `BUCK_WORKFLOW_CONFIG` points to an alternate file. Versioned, strict known-key parsing; machine defaults plus per-project overrides, with built-in repository-files default. No branch-specific backend overrides; branches of one project must resolve the same authoritative store. Mid-run configuration changes cannot redirect writes: persisted runs pin backend/store identity and refuse mismatch until verified migration/rebind.

Illustrative keys (implement and document this schema, not a second environment-driven mode switch):

```yaml
version: 1
storage:
  adapter: repo-files
projects:
  buck-workflow:
    origins:
      - git@github.com:evilbuck/buck-workflow-pi.git
    integration_ref: refs/remotes/origin/master
    storage:
      adapter: postgres
      connection_env: BUCK_WORKFLOW_DATABASE_URL
```

Adapters: `repo-files`, `external-files`, `sqlite`, `postgres`. External-file root defaults to `~/.config/buck-workflow/{project}/.context/`; SQLite path defaults to `~/.config/buck-workflow/state.sqlite`. Both are configurable. Stable escaped/hash project identifiers—not raw remote URLs or traversal-capable slugs—substitute `{project}`. Central file manifests live under the same machine Buck directory. SQL manifests live in the selected database. Do not persist secrets; `SQL_MEMORY_URL` may be referenced explicitly as a connection ENV during migration but no longer silently chooses the backend. Doctor must identify legacy SQL configuration without silently changing policy/backend.

Only config text is intended for dotfile versioning. SQLite files/WAL/SHM, manifests, private file bodies, exports, and receipts are generated private state; document exclusions and permissions. Do not auto-edit chezmoi/stow.

### 2. Identity and logical artifacts
- `project_id`: configured stable key or normalized credential-redacted origin identity; preserve explicit old-origin aliases during import. Without origin use resolved Git common-dir machine identity. Independent clones need a shared configured/origin key; worktrees share project identity. Missing/ambiguous identity is an error, not global state.
- `branch_id`: durable incarnation ID associated with project + named ref + observed lineage. Rename/rebind is explicit when continuity is uncertain; reused names do not inherit abandoned drafts. Detached/unborn/no-Git contexts get private workspace identities, not NULL-global semantics.
- `worktree_id` and `run_id`: distinguish concurrent checkouts/runs, even on the same branch. Run resume uses exact identity; cross-worktree resumption is an explicit validated operation, not an inferred match.
- Artifact key: project, subject ID, kind, logical relative name; revision is immutable, has exact bytes/hash, author/source provenance, typed links and branch ownership. Run-scoped records add worktree/run identity. Physical file path is a projection.
- Preserve Markdown/frontmatter as content, binary payloads as bytes, existing acceptance semantics and relative links through a backend-neutral reference resolver. No Markdown-only assumption for attachments.
- Copy-on-write branch views: current-branch revision overlays the published baseline for the same artifact; another branch's drafts never overwrite that baseline. Corrections/tombstones affect only that branch view until explicitly published.

### 3. Store API and adapters
One service exposes artifact read/list/search/write-batch, scoped correction, lifecycle transition, run-state/receipt operations, checkpoint seal/bind/reconcile, and export/import. Bind context in trusted runtime/CLI; normal callers cannot supply arbitrary project or visibility scope. Explicit inspect/recover operations name cross-branch scope and retain evidence.

File and DB implementations share conformance cases, not filesystem materialization as authority. File adapters use native editable bodies plus immutable sealed revisions/manifest pointers; reconcile direct file edits into a new private revision before retrieval/sealing. Commit generation via staged immutable records and one atomic visibility pointer under scoped locking; recover interrupted generations and reject stale writes. Repository-file mode keeps the existing `.context` body layout and Git portability; external-file mode namespaces branch and run views so worktrees cannot overwrite each other. A central manifest is metadata authority for publication, not a second body store fallback.

PostgreSQL: reuse pg pool/transaction discipline; additive schema and checksummed migrations for artifact revisions, scoped pointers, branches, checkpoints/publications, runs/receipts, attachments and import provenance. Preserve existing memory IDs/categories/ranks/correction history by explicit import/mapping. Avoid changing prior migration checksums or relying on MAX(seq)+1 concurrency.

SQLite: confined node:sqlite driver, parameterized dialect SQL, transactions, foreign keys, busy/concurrency policy and consistent backup/export snapshot. Verify actual OMP/Node/Bun support first. Unsupported SQLite runtime errors clearly; other adapters do not import the SQLite driver eagerly. Use normal indexed source/revision columns rather than emulating jsonb containment. No fake PostgreSQL full-text scores. Search must produce useful deterministic results on each backend; visibility is invariant even when ranking implementations differ.

### 4. Fetching and publication
Normal knowledge lookup = exact project's current branch overlay plus published integration baseline. Apply scope BEFORE content reaches tools/models, ranking, shortlist LIMIT, pagination, or Jev. Subject selection and backlog discovery use this same view; completed subjects remain excluded according to lifecycle authority. Raw unpublished SQL rows are never a generic recall shortcut.

Central checkpoint records freeze the exact immutable revision set and its hashes. Sealing is explicit in save/checkpoint flow; branch drafts or post-seal edits are never automatically added. Bind the snapshot to a successful commit checkpoint, or to an explicitly named eligible unmerged source tip with recorded integration tip. Never auto-bind arbitrary new content to an inherited/already-integrated commit. Failure to bind does not fabricate a code commit or mark commit complete; the sealed snapshot stays private and recoverable.

Automatic promotion requires source checkpoint eligibility and `git merge-base --is-ancestor <anchor> <integration-tip>` success. Distinguish exit 1 (not merged) from command errors (cannot prove); no automatic network fetch. Missing/untrusted refs or unprovable history leave state private. Record resolved tips/proof and publish only the sealed revision set. For squash/rebase, require an explicit source-checkpoint→merged-commit attestation; validate project, exact snapshot hashes, target reachability and mapping evidence. Patch-id alone is not artifact proof. Direct integration-branch edits require an explicit sealed publication checkpoint, not creation-HEAD inference.

Publication is a versioned integration view, not an irreversible `merged=true` tag. Reconcile against configured integration tip: history rewrites or revoked evidence cannot leave now-unproven revisions exposed. A revert of integrated code does not automatically reverse external knowledge; artifact tombstones/corrections are explicit revisions. Conflicting independently published revisions of the same artifact cannot silently overwrite each other: preserve both candidates and require explicit resolution before updating that artifact's published pointer; retain the last unambiguous baseline.

Branch deletion/orphaning never promotes or destroys state. Explicit recovery lists private orphan scopes, checkpoints and provenance; rebind/export only after scope selection. New branch incarnations don't acquire old private artifacts by name. Run projections, receipts, import cursors, pass audits, attribution and dedupe remain run/workspace-private even after the branch merges; intentionally reusable review summaries remain knowledge artifacts.

### 5. Tools, CLI and portable skills
Add one native `workflow_state` surface for typed logical operations and the matching shared CLI. Artifact tokens/references replace mandatory physical paths in skill inputs. OMP tools and restricted children get stage-appropriate read/write permissions and the same context binding; portable skills use the CLI when native tools are unavailable. No chat-model SQL construction, no hidden local-file canonical mirror, no unscoped raw SQL knowledge read.

Cut over normal model-facing `sql_memory` recall/remember/correct callers to the new surface; remove their old generic raw-SQL path and environment-switch registration when obsolete. Keep migration/administration capabilities explicit in the CLI, outside normal recall. Preserve ranking metadata and existing receipt/readback semantics without retaining a second active memory store.

Subject lifecycle remains one authority: storage-neutral inspection/transition semantics with adapter reads/conditional writes. It still verifies evidence before close and refuses malformed provenance. Save writes become same-adapter batches/attempt receipts: attempted run/project/branch/revision identities match, no-fact remains meaningful, receipt is complete only after required metadata duties succeed. Authoritative artifacts beat projections during resume; outage or uncertain persistence blocks save/commit.

Update direct file consumers rather than loosening postconditions. File exports/editor materializations are optional scoped views with expected revisions; external edits must be imported/committed through the service. Import/mirror tools do not send unmerged knowledge into harness LTM that lacks branch isolation; mirror only published knowledge or explicitly scoped backends. Do not modify host session data ownership to accomplish this.

## Affected files
Prospective new canonical module root: `skills/_shared/storage/` (contract/config/identity/visibility/adapters/migration, exact module split kept small), plus `skills/_shared/scripts/workflow-state.ts` and `extensions/workflow-state/` tool binding.

Existing groups to migrate:
- `skills/_shared/scripts/{subject-lifecycle,context-helpers,plan-acceptance}.ts`, context/subject resolution and recall protocols; `scripts/context-artifacts.ts` and their behavioral tests.
- `extensions/buck-loop/` scan, persist, project-memory, save/checkpoint/loop/children/subject picker and evidence writers; retain machine rules.
- `extensions/b-save-improved/`, `skills/b-save-improved/scripts/{save-preflight,save-apply}.ts`; both save entry points use one storage contract.
- `extensions/sql-memory/`, `migrations/` and new dialect schema files; remove obsolete normal model-facing paths after import/cutover, preserve explicit administration.
- `hooks/post/turn-memory.ts`, `extensions/turn-memory/`, `extensions/plan-artifact.ts`, Buck-owned `extensions/token-attribution/` persistence; preserve host-owned stats/session rows.
- `extensions/code-review-iteration/` retained pass/state/report persistence, plus other Buck artifact/evidence writers identified by the migration inventory. Execution policy unchanged.
- `skills/b-memory-import/`, bulk import manifests, export/presentation retention and storage-specific readers such as `docs/plans/src/lib/plans/` (use existing reader seam, remove fake SQL stub when replaced; no UI redesign).
- Canonical artifact-writing/reading skills: brainstorm/research/explore/plan/phase/build/review/iterate/save/recap/present/capture/commit and shared write-boundary/reference instructions. Update every discovered hardcoded durable path, not only these named examples.
- `extensions/index.ts`, package/runtime declarations as necessary, installer shipping rules, canonical command wrappers and physical `plugins/buck-workflow/skills/` bundle.
- `GLOBAL_OR_PROJECT-AGENTS.md`, repository managed conventions via appropriate docs workflow, `docs/sql-memory.md`, `docs/buck-loop.md`, `docs/buck-workflow.md`, storage configuration/recovery how-tos and `CHANGELOG.md`.

Before implementation, use LSP references for changed exports and inventory every retained Buck write/read path. Record each path's artifact kind, scope, consumer, and cutover verification. Unexpected out-of-scope defects are separate work; missed in-scope persistence consumers are not.

## Implementation steps
1. **Contract/config/identity:** finalize typed operations and config parser using this design; create the persistence inventory and conformance fixtures; prove SQLite runtime capability in actual OMP/CI/Bun. No backend compatibility claim without running it.
2. **Four adapters:** implement repo files/external files with generation atomicity, SQLite and PostgreSQL with transactional/checksummed migrations, immutable revisions and binary payloads. Prove identical storage/visibility behavior on real file roots and real databases; no adapter stubs.
3. **Domain semantics:** port lifecycle inspection/transitions, links/backlog/index discovery, memory correction/idempotency, save batches/attempts/readback/complete receipts to the contract. Preserve refusal and authority rules; scoped corrections must not invalidate another branch.
4. **Native/portable access:** bind workflow_state and CLI, stage permissions, artifact references and skill write boundaries. Cut over OMP plan bridge, subject picker and all skill artifact writers/readers; synchronize release bundle.
5. **All remaining durable consumers:** migrate both save pipelines, loop resume/scan/checkpoint/activity, review pass artifacts, hooks, Buck attribution, import manifests and retained presentation/attachment outputs. Connect plan-site reader to real adapter-backed source; ensure host state stays untouched.
6. **Merge/recovery:** implement sealed checkpoint binding, integration reconciliation, ancestry proof, explicit rewritten-history mapping, conflict resolution and orphan recovery. Never infer external content publication from creation HEAD or branch absence.
7. **Existing-data cutover:** implement scoped read-only export/import with retained IDs/links/history/bytes, legacy quarantine, dry-run verification and atomic backend switch. Prove interrupted cutover and post-cutover rollback recovery. Remove obsolete normal storage branches/protocols only after callers migrate.
8. **End-to-end proof/docs/package:** exercise complete workflows on all four adapters, run existing deterministic guardrails, fresh install/bundle tests and plan-site surface smoke where changed; document configuration, publication, migration, backup/recovery and dotfile exclusions; update changelog. Each prior step carries its own behavioral checks; this step is final integration, not delayed testing.

Dependency order: 1 → 2 → 3 → 4; 5 depends on the same contract/tool surface; 6 needs exact revisions/checkpoint integration; 7 needs all selected adapter and visibility semantics; final proof requires all steps. This is a multi-slice plan and should be phased before implementation. These numbered steps are not generated phase files.

## Acceptance criteria
- [ ] Each required adapter supports every in-scope durable kind, text/binary payload, exact revisions, save/lifecycle semantics and scoped resume; no PostgreSQL-only fallback pipeline remains.
- [ ] One machine text config with project overrides selects storage consistently for extension, hook, child sessions and CLI; secrets/private generated state are not dotfile payloads.
- [ ] No-config repository-file behavior remains usable; legacy SQL environment is diagnosed and migrated explicitly, not silently used as a second backend.
- [ ] Independent projects never collide; aliases/import mappings preserve existing identities; worktrees and concurrent runs never share mutable resume pointers accidentally.
- [ ] Ordinary reads return only current branch overlay and proven published baseline—including memories, subject discovery and backlog. Private candidates cannot affect visible shortlist/pagination.
- [ ] Same-named subjects/artifacts on two unmerged branches stay independent; branched corrections/tombstones do not invalidate another branch's published baseline.
- [ ] Exact sealed v1 publishes after valid checkpoint merge; later v2 stays private. Old creation HEAD, inherited integration commits, branch deletion, patch equivalence and Git errors never count as proof.
- [ ] Preserved-history merges auto-publish only eligible snapshots; squash/rebase remain private until exact verified mapping; rewritten integration history revokes now-unproven visibility. Conflicts preserve the last unambiguous baseline.
- [ ] Detached/unborn/orphaned/reused branches remain private and explicitly recoverable; no automatic deletion.
- [ ] Lifecycle close, receipt completion, attempt/run/project binding, no-fact verification and commit proof remain enforced on every backend. Outages or stale writers cannot yield false success.
- [ ] Native/CLI/reference-based workflows run without canonical `.context` materialization under external/SQL selection; no unscoped normal raw SQL recall or LTM mirroring leak remains.
- [ ] Legacy records without exact merge evidence are retained in an explicit recovery/import scope; no guessing or deletion. Export/import preserves IDs, content hashes, binary files, links, scoped corrections, ranks and lifecycle provenance.
- [ ] Switching/migration/recovery works with interrupted imports and post-cutover writes, without dual writes or silent backend fallback.
- [ ] All discovered Buck-owned durable writers/readers are migrated; host-owned session/LTM/stats data and unrelated source/living docs are unchanged.
- [ ] Actual OMP runtime, CLI/CI supported runtimes, installed package, canonical command/skill mirrors, existing suite and required guardrails pass; changed plan-site read path is exercised on its actual surface.

## Verification
**During implementation, required:**
- Run one backend conformance suite against temp repo/external file roots, SQLite on disk, and disposable PostgreSQL. Use real transactions/concurrency and exact visibility/correction/lifecycle outcomes—not source-text/wiring assertions.
- Exercise a real OMP workflow per backend: brainstorm/research/plan → phase → build/review/iterate → save/checkpoint → restart/resume; include all state kinds through focused scenarios (presentation attachment, retained pass audit, hook memory, attribution/import cursor). Read back exact artifact IDs/revisions and attempt completion.
- Git fixtures: preserved merge/FF; squash/rebase explicit mapping; old creation ancestor + unmerged body; edit after seal; inherited integration anchor; rename/delete/recreate; detached/unborn; stale/missing refs; force-push integration; overlapping artifact conflict; code revert without implicit knowledge deletion.
- Two-project/two-worktree fixture with same subject/logical names; inspect default tools and model input for negative visibility; paginate private high-rank records to prove filtering precedes LIMIT and judgment.
- Failure/recovery: concurrent stale edits; process loss before/after batch pointer; SQLite locks; PostgreSQL outage; receipt/attempt mismatch; lifecycle refusal; interrupted migration/config cutover; backup restore and post-cutover rollback export.
- Preserve existing functional tests where contracts remain valid; update tests for intentionally changed raw-SQL/project-wide recall. New permanent tests cover consumer-visible privacy, revision, recovery and authority invariants, not incidental filenames/default prose.
- `npm run guardrails:check` is the authoritative existing deterministic runner during code implementation; do not lower enforcement/thresholds. Run existing install, bundle parity and changed site checks as applicable.

**Phase 1 execution:** contract/config/identity/visibility sources and conformance fixtures were implemented; local strict typecheck, storage tests, Node/Bun/OMP runtime probes, and durable guardrails passed. See `phase-1-contract-config-identity.md` for commands and outcomes. The inventory is still a discovery baseline; remaining census follow-up is explicit there.

## Recommended next step
Run `/skill:b-phase` against this plan to create sequential execution units with the dependencies, A-4 runtime-validation assignment, per-backend conformance requirements and resume-safe scope. Then use `/b-build-hard` for the storage/visibility/cutover units. b-phase and b-build are in the active catalog; verify b-build-hard availability in the execution session. Do not auto-set OMP execution mode; decide that from the actual phase graph after phasing.
