---
name: b-hindsight-import-projects
description: Bulk-import Buck `.context/memory` from many projects into OMP Hindsight in one pass. Wraps `b-memory-import` with multi-project discovery, per-project isolation, and aggregate reporting. Use when seeding Hindsight across a workspace (`~/projects/*`), resuming a partial run, or running the same pipeline on a different machine.
triggers:
  - /b-hindsight-import-projects
  - import all projects into hindsight
  - bulk seed hindsight
  - seed hindsight across projects
---

# b-hindsight-import-projects

Drive `b-memory-import` over **many** projects in one invocation. Discovers
projects under one or more roots, runs the per-project import per root,
aggregates results, and survives individual project failures.

Companion to `b-memory-import` (which is single-project). Same credentials,
same manifest, same idempotency. This skill is the outer loop.

## When to use

- First-time Hindsight seeding across a workspace of Buck projects
- Resuming a partial run after a network blip / server restart
- Running the same pipeline on another OMP install (script is
  self-contained — no hardcoded paths beyond the sibling `b-memory-import`
  skill)

**Not** a substitute for per-project `/b-save`. The wrapper reads
already-written `.context/memory/*.md` and pushes them; ongoing sessions
should still write new memory files via `b-save`.

## Prerequisites

- `bun` on PATH
- `skills/b-memory-import` checked out next to this skill
  (`../b-memory-import/scripts/import-context-memory.ts`)
- OMP Hindsight configured (`memory.backend: hindsight` in
  `~/.omp/agent/config.yml`) or explicit `--api-url` / `HINDSIGHT_*`
- At least one project with `.context/memory/`

## Quick start

Dry-run across two projects:

```bash
bun skills/b-hindsight-import-projects/scripts/import-projects.ts \
  --root ~/projects \
  --include partypix qrpro \
  --dry-run
```

Pilot import (3 files per project, wait for extraction):

```bash
bun skills/b-hindsight-import-projects/scripts/import-projects.ts \
  --root ~/projects \
  --include partypix qrpro \
  --sync --limit 3
```

Full bulk import, async (fire-and-forget extraction):

```bash
bun skills/b-hindsight-import-projects/scripts/import-projects.ts \
  --root ~/projects \
  --all
```


Multi-dir (memory + backlog items):

```bash
bun skills/b-hindsight-import-projects/scripts/import-projects.ts \
  --root ~/projects --include partypix qrpro \
  --source-dirs .context/memory,.context/backlog/items
```
## Discovery rules

For each `--root <dir>`:

1. If `<root>/.context/memory/` exists, treat `<root>` as a single project.
2. Otherwise scan immediate subdirectories of `<root>`. A subdirectory is a
   project iff `<sub>/.context/memory/` exists.
3. Hidden directories (`.*`) are skipped.
4. `--include` / `--exclude` filter by basename after discovery.
5. Multiple `--root` flags are merged; duplicates are removed.

## What it forwards

Every flag below is passed through to `import-context-memory.ts` per
project, so behavior is identical to running the inner script by hand:

| Flag | Inner equivalent |
|------|------------------|
| `--dry-run` | plan only, no HTTP |
| `--sync` | retain with `async=false` |
| `--force` | re-upsert even if sha matches manifest |
| `--limit <n>` | cap files per project |
| `--source-dirs <list>` | comma-separated `.context/{memory,backlog/items,...}`; greedy flag-repeatable; forwarded as-is |
| `--api-url` / `--api-token` / `--bank-id` / `--scoping` | override Hindsight config |
| `--omp-config <path>` | override OMP config path |
Stdout is a single JSON envelope:

```json
{
  "inner_script": "/abs/path/to/import-context-memory.ts",
  "inner_script_exists": true,
  "roots": ["/home/.../projects"],
  "mode": "include",
  "projects_requested": 2,
  "projects_discovered": 22,
  "projects_matched": 2,
  "projects_skipped_no_memory": 20,
  "results": [
    {
      "root": "/home/.../projects/partypix",
      "label": "partypix",
      "status": "ok",
      "scanned": 57,
      "planned": 57,
      "imported": 57,
      "failed": 0,
      "skipped_unchanged": 0,
      "bank_id": "omp",
      "duration_ms": 4231,
      "raw": { /* full inner-script result */ }
    }
  ],
  "totals": {
    "scanned": 403,
    "planned": 403,
    "imported": 403,
    "failed": 0,
    "skipped_unchanged": 0,
    "duration_ms": 14822
  }
}
```

Pipe to `jq`:

```bash
... | jq '.totals, .results[] | {label, scanned, imported, failed}'
```

## Failure semantics

- One project failing **does not** stop the rest. Each child is spawned
  with `bun`; exit code 0 → ok, anything else → `status: "error"`.
- The wrapper exits 0 if every project succeeded (or was a no-op), 2 if
  any project had retain errors, 1 only for usage / discovery failure.
- Manifest state is per-project (lives at
  `<project>/.context/memory/.omp-hindsight-import-manifest.json`). A
  failed project re-running is a no-op for the files that already landed
  and a retry for the rest.

## Verifying on another machine

Minimum checks to confirm the pipeline landed somewhere new:

```bash
# 1. Discovery
bun skills/b-hindsight-import-projects/scripts/import-projects.ts \
  --root ~/projects --all --dry-run \
  | jq '.projects_discovered, .projects_matched'

# 2. Pilot
bun skills/b-hindsight-import-projects/scripts/import-projects.ts \
  --root ~/projects --include <one-project> --sync --limit 2

# 3. Cross-check via Hindsight API
curl -sS -H "Authorization: Bearer $HINDSIGHT_API_TOKEN" \
  "$HINDSIGHT_API_URL/v1/default/banks/omp/memories/list?limit=5" \
  | jq '.items[] | {context, tags}'
```

## Related

- `b-memory-import` — single-project retain; this skill drives it in a loop
- `b-save` — writes `.context/memory` (source of truth this skill reads)
- OMP `retain` / `recall` / `reflect` — interactive memory during sessions
- `gitnexus-pr-review`, `code-review-universal` — alternate read paths
  into historical project state (not retained by default)