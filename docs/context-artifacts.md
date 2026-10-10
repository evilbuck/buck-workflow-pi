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

`skills/_shared/storage/` defines a backend-neutral contract and its config,
identity, visibility, capability, and conformance helpers. It does **not** yet
provide production adapters or redirect existing Buck readers/writers. The
adapter names accepted by the schema are `repo-files`, `external-files`,
`sqlite`, and `postgres`; accepting a selection is not proof that an adapter
is connected. Existing persistence behavior, including the separate
[SQL-memory path](sql-memory.md), remains unchanged.

### Operations and module boundaries

`contract.ts` defines `StorageStore`: artifact read/list/search, write batches,
scoped corrections, lifecycle transitions, run receipts, checkpoint
seal/bind/reconcile, and streaming export/import. Revisions carry exact bytes,
a hash, author/source provenance, timestamps, typed links, and optional
expected-revision concurrency preconditions. Content is not limited to
Markdown; attachments can carry binary bytes.

`conformance.ts` is a Vitest-only helper, not a production runtime dependency.
`defineStorageConformance()` accepts a backend factory with a disposable store
implementing read/list/write-batch/correct/transition. Its shared cases cover
exact byte round-trip, stale-batch rollback, visibility filtering before the
result limit, branch-local correction, evidence-required completion, and
stale lifecycle refusal. The throwaway SQLite fixture in
`skills/_shared/scripts/storage-conformance.test.ts` exercises this boundary;
it is not the production SQLite adapter. Receipt, checkpoint, search, and
export/import operations have typed signatures but are not covered by that
fixture suite.

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

`visibility.ts` first requires an exact project match. Knowledge revisions are
visible when owned by the current branch or explicitly present in the supplied
published-revision set. Run-scoped revisions require exact branch, worktree,
and run matches even if marked published. The helper does not establish Git
publication evidence or implement overlay ordering, ranking, or pagination;
consumers must establish publication evidence and filter before exposing
bodies or applying limits. This is a retrieval invariant, not file/DB-operator
access control, and is not yet enforced by existing production callers.

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
