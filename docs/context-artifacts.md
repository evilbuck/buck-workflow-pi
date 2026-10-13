# Context Artifacts: Markdown Source, JSON Query Views

Buck workflow uses a hybrid `.context/` model.

## Canonical sources

Markdown remains the source of truth for narrative artifacts:

- subject `index.md`
- `research-*.md`
- `plan-*.md`
- memory files in `.context/memory/`
- backlog item files in `.context/backlog/items/`

JSON remains the source of truth for machine-owned state:

- `.context/workflow/current-session.json`
- other operational/session caches

**Harness LTM is not a `.context/` source.** OMP `retain`/`recall`/`reflect` (Hindsight/mnemopi) mirror durable facts for agent recall. They do not replace markdown memory files or the generated JSON indexes. Bulk seed: `skills/b-memory-import`.

## Shared durable-storage contract

`skills/_shared/storage/` provides the backend-neutral contract, four adapters,
and domain policies. Adapters are `repo-files`, `external-files`, `sqlite`, and
`postgres`. Native `workflow_state` and the shared CLI are the model-facing
access surface. The plan-artifact bridge, interactive subject picker, and
supervisor recall/save address artifacts by token. Remaining Buck consumers
are not all redirected; that sweep is separate work. `sql_memory` is not
registered. `external-files`, `sqlite`, and `postgres` do not materialize a
canonical `.context` mirror.

### Native and portable access

`extensions/workflow-state/` registers `workflow_state`. Portable callers use
`bun skills/_shared/scripts/workflow-state-cli.ts`. Operations are `read`,
`list`, `search`, `write`, `correct`, `discover`, `inspect-lifecycle`,
`transition`, `read-receipt`, and `write-receipt`. `inspect` and `recover`
name a branch and retain evidence; restricted stages cannot call them.
`migrate` is CLI-only.

The trusted runtime binds project and visibility from the checkout and machine
config. Callers cannot pass `projectId`, `branchId`, `publishedRevisionIds`,
`worktreeId`, or `runId`. Address an artifact by
`{ subjectId, kind, logicalName, revision? }` or a `workflow-artifact:` token.
A repo-files `.context/<subject>/<logicalName>` path is an optional editable
projection, not an input.

Roles are `read`, `write`, `save`, and `admin`. Restricted children receive a
baked role and `workflow_state`, never `sql_memory`. In `/buck-loop`,
`SQL_MEMORY_URL` only gates whether save requires a verified store receipt.
The supervisor does not open that variable as a pool.

Repo-files immutable manifests and revision blobs live under the machine
identity registry,
`${XDG_CONFIG_HOME:-~/.config}/buck-workflow/projects/<project-id>/repo-manifest`,
beside `branch-identity.json`. Only editable bodies belong in `.context/`.

`workflow_exec` is the Linux command boundary: Bubblewrap, fail closed, no
host-shell fallback. Git metadata is read-only inside that command boundary
except the commit checkpoint stage. Host file tools do not yet enforce that
rule. See [ADR 0004](adr/0004-workflow-state-trusted-access.md).

### Operations and module boundaries

`contract.ts` defines `StorageStore`: artifact read/list/search, write batches,
scoped corrections, lifecycle transitions, run receipts, checkpoint
seal/bind/reconcile, and streaming export/import. Revisions carry exact bytes,
a hash, author/source provenance, timestamps, typed links, and optional
expected-revision concurrency preconditions. Content is not limited to
Markdown; attachments can carry binary bytes.

`conformance.ts` is a Vitest-only helper, not a production runtime dependency.
`defineStorageConformance()` accepts a backend factory with a disposable store
implementing artifact lookup, conditional writes, corrections, lifecycle, and
receipts. Shared cases run against both file adapters, on-disk and in-memory
SQLite, and disposable PostgreSQL. They cover exact bytes, stale-batch rollback,
visibility before ranking/page/body loading, retained published revisions,
inherited branch corrections/tombstones, lifecycle refusal and discovery, and
same-scope receipt readback. Checkpoint publication proof remains separate.

`domain.ts` uses the text authority in `subject-lifecycle.ts` for both filesystem
and stored lifecycle operations. `transition()` accepts initialize, activate,
close-verified, or reopen (with a nonblank reason), bound to the visible index
revision and expected state. A transition writes a versioned subject-index
artifact, not an independent state row; published close evidence and private
reopen overlays therefore use the same view as plans and discovery. Legacy
effective-state and malformed-provenance rules are preserved. PostgreSQL
artifact writers and lifecycle transitions acquire sorted subject locks before
reading evidence and hold them through commit.

Corrections authorize the predecessor through the supplied published revision
set plus the branch overlay, then conditionally write only that branch's
pointer. Replays preserve idempotency/history. Receipt completion loads the
attempt's exact revisions, checks body hashes and project/branch/worktree/run
scope, and requires successful metadata duties; branch knowledge is reusable
across runs, but another run's private revision cannot complete the save.
`RunReceipt.metadataDuties` on an `attempted` receipt declares the required
metadata work. On a `complete` receipt it attests operations the caller has
successfully performed. Completion must cover every persisted attempt duty,
including no-fact saves; attempted updates cannot shrink or replace that set.
PostgreSQL receipt writers hold a transaction advisory lock keyed by project
and run before reading the attempt, including when no receipt row exists yet.
Concurrent initialization therefore cannot replace the winning requirement
set; updates validate the committed predecessor and cannot downgrade completion.
The adapter checks the attestation, not the external metadata operations.
Readback/probe alone is not proof of backlog, phase-status, or draft-commit work.

Discovery resolves lifecycle from the full branch-overlay/published visibility
view before applying subject, kind, or logical-name result filters. Completed
subjects and links targeting them remain excluded even when a filter omits
their index or legacy completion evidence.

### Configuration resolution

`config.ts` parses YAML schema version `1`. The only top-level keys are
`version`, `storage`, and `projects`; unknown and duplicate keys are rejected.
Each storage selection requires `adapter` and permits only its corresponding
optional field: `root` for external files, `database` for SQLite, or
`connection_env` for PostgreSQL. The latter names an environment variable,
not an embedded connection string.

Projects are keyed by safe identifiers and require a non-empty `origins` list.
Optional project keys are `integration_ref` (a full `refs/...` ref) and
`storage`. Origin matching uses the canonical form shared with `identity.ts`;
duplicate normalized aliases fail as ambiguous. Configured URL origins reject
userinfo, query, and fragment data rather than retaining credentials.

`loadStorageConfig()` resolves the file in this order: explicit `configPath`,
`BUCK_WORKFLOW_CONFIG`, then
`${XDG_CONFIG_HOME:-~/.config}/buck-workflow/config.yaml`. Only an absent
default file falls back to `repo-files`; an unreadable or missing explicitly
selected file is an error. A matching project's storage selection replaces
the machine selection, rather than merging its fields. There is no
branch-level override or environment-driven adapter switch.

Resolution supplies omitted external-file and SQLite locations as
`~/.config/buck-workflow/{project}/.context` and
`~/.config/buck-workflow/state.sqlite`, respectively. These state defaults use
the home directory even when `XDG_CONFIG_HOME` changes the config-file lookup.
The external-file `{project}` token remains a template in this layer; a
consumer must substitute the resolved safe project identity.

### Identity and visibility invariants

`identity.ts` resolves project identity from a configured safe key first,
otherwise from a SHA-256 digest of a normalized, credential-redacted origin,
otherwise from a digest of an absolute normalized Git common directory.
Missing or ambiguous identity fails closed; raw remote URLs are not project
keys. Origin aliases belong to config matching, not an automatic Git-remote
rename detector.

Create and persist a branch identity once per observed incarnation of a
canonical `refs/heads/...` ref and its initial commit tip. Do not regenerate it
on each read/run or use a recycled branch name as identity. Worktree and run
IDs are separate UUID-based identifiers. Detached, unborn, and no-Git callers
must use an explicitly constructed private workspace identity with a
workspace nonce, not a missing branch interpreted as global scope. Git
discovery, incarnation persistence, and recovery/rebinding are consumer
responsibilities, not implemented by these helpers.

Artifact keys use safe opaque project/subject/kind/scope IDs and a normalized
relative logical name; absolute paths, empty or traversal components,
backslashes, and NULs are refused. Run-scoped keys require both valid worktree
and run IDs.

`visibility.ts` first requires an exact project match. Ordinary lookup unions
current-branch pointers with exact immutable published revisions, then overlays
by logical identity before ranking, LIMIT, pagination, or body loading. Selected
bodies are loaded by immutable revision, never a mutable current pointer.
Advancing a private draft does not remove its predecessor from the published
view. File projections reconcile only within the querying branch's private
scope, so another branch cannot retrieve direct edits through a published ID.

`domain.ts` exposes `lookupKnowledge()` as the ordinary store-backed knowledge
read surface: `list()` without text, `search()` with text. Both apply the
visibility rules above. Do not add unrestricted knowledge SQL to this surface.
Supervisor recall uses this surface. The removed `sql_memory` tool does not.

Worktree-private revisions require that worktree; run-private revisions require
exact branch, worktree, and run even if supplied as published. Callers must
establish the trusted published-revision set using publication proof (separate
from lookup). This is a retrieval invariant, not file/DB-operator access control.
Publication pointer loading is still empty; callers cannot supply
`publishedRevisionIds`. Remaining durable consumers are not all on this surface.

### SQLite runtime boundary

`sqlite-capability.ts` loads `node:sqlite` lazily and requires a `DatabaseSync`
export. Unsupported runtimes throw `SQLite adapter unavailable in this
runtime: node:sqlite could not be loaded` with the underlying reason; there is
no fallback backend. Other storage selections must not eagerly load this
driver. `sqlite-runtime-smoke.ts` exercises real commit/read/rollback behavior;
`npm run test:sqlite-runtime` runs the Node and Bun probes. Capability depends
on the actual host runtime, not merely its version label or an accepted
`sqlite` config selection.

## Generated indexes

Run:

```bash
npm run context:index
```

This regenerates:

- `.context/index/subjects.json`
- `.context/index/memory.json`
- `.context/index/backlog.json`
- `.context/index/artifacts.json`

These files are rebuildable query surfaces. Do not hand-edit them.

## Validation

Run:

```bash
npm run context:validate
```

Validator behavior:

- invalid enum/value fields are errors
- missing required fields are currently warnings for legacy drift
- exit code is non-zero only when hard errors are present

This keeps the validator useful on the existing repo while still surfacing older artifacts that need backfill.

## Current frontmatter contracts

### Memory

Required:

- `date`
- `domains`
- `topics`
- `related`
- `priority`
- `status`

Enums:

- `priority`: `high | medium | low`
- `status`: `active | completed | superseded`

### Subject index

Required lifecycle fields:

- `status`
- `lifecycle_schema`
- `lifecycle_revision`
- `lifecycle_last_transition`

Enums:

- `status`: `draft | active | completed`

The lifecycle CLI is authoritative and writes these fields. Older indexes may
also carry `date` and `subject`; they are metadata, not lifecycle requirements.
The legacy context-artifact validator may still warn when they are absent.

### Research

Required:

- `status`
- `date`
- `subject`
- `topics`
- `informs`

Enums:

- `status`: `active | completed | superseded | draft`

### Plan

Required:

- `status`
- `date`
- `subject`
- `topics`
- `research`
- `memory`

Enums:

- `status`: `active | completed | superseded | draft`

### Backlog item

Required:

- `title`
- `status`
- `priority`
- `created`
- `updated`
- `completed`
- `related`

Enums:

- `priority`: `high | medium | low`
- `status`: `active | completed`

## jq examples

Active subjects:

```bash
jq '.[] | select(.status == "active") | {subject, date}' .context/index/subjects.json
```

Latest memory entries tagged with `buck-workflow`:

```bash
jq '.[] | select(.topics | index("buck-workflow")) | {date, subject, topics}' .context/index/memory.json
```

Open backlog items:

```bash
jq '.[] | select(.status == "active") | {title, priority, updated}' .context/index/backlog.json
```
