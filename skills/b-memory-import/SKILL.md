---
name: b-memory-import
description: Deterministically import publication-proven project memory and backlog revisions from the configured workflow adapter into OMP Hindsight. Use for one-shot/backfill seeding of native agent memory from Buck session records.
triggers:
  - /b-memory-import
  - import context memory
  - seed hindsight from .context
---

Import publication-proven memory and backlog bytes from the configured workflow store into OMP Hindsight via HTTP retain. `.context/memory/` is the default logical source prefix, not a required local directory. Private branch drafts, subject receipts, and ambiguous legacy records are excluded before payload construction. No local-file union or outage fallback is permitted. Without trusted published-revision evidence, withhold imports; historical Markdown is not automatically migrated.

Backend migration is a separate operator route: `workflow-state-cli.ts
migration-import-legacy` retains original legacy JSON (including categories,
ranks and successor links) in a private recovery scope without ordinary
pointers. Do not feed those recovery records to Hindsight or infer publication
from their old branch names. Use the [storage migration guides](../../docs/howto/README.md#storage-migration)
for export/import, verified backend switching, and rollback.

The deterministic Bun script uses no LLM or qmd. Configure `HINDSIGHT_API_URL`, `HINDSIGHT_API_TOKEN`, `HINDSIGHT_BANK_ID`, and `HINDSIGHT_SCOPING`, or `~/.omp/agent/config.yml` → `hindsight.*`.

Default scoping matches OMP: `per-project-tagged` with tag `project:<git-root-basename>`.

## Agent procedure

1. Confirm cwd is the **target project** (or pass `--root`).
2. Dry-run first:

```bash
bun "${SKILL_DIR}/scripts/import-context-memory.ts" --dry-run
```

   (`SKILL_DIR` = this skill's directory. From buck-workflow-pi checkout you can use the repo-relative path.)
3. Review JSON: `scanned`, `planned`, `skipped_unchanged`, `source_dirs`, `parse_warnings`, `bank_id`, `project_label`.
4. Import:

```bash
bun "${SKILL_DIR}/scripts/import-context-memory.ts"
```

5. Optional: `--force` to re-upsert all; `--limit N` for a pilot batch; `--sync` to wait for extraction; `--source-dirs` to extend beyond `.context/memory`.

## Source dirs (multi-dir import)

The script selects retained Markdown revisions under these logical `.context/` prefixes; local source and manifest exports need not exist:

| Path | `kind` | Required frontmatter |
|------|--------|------------------------|
| `.context/memory/` | `memory` | yes (any) |
| `.context/backlog/items/` | `backlog` | `title` + `status` (string) |

Revisions missing required frontmatter are skipped with a warning in
`parse_warnings`. A missing logical source contributes no records. Store
outages or malformed retained cursor state fail closed even if local exports exist.

Examples:

```bash
# Default: memory only (back-compat with single-dir invocation)
bun scripts/import-context-memory.ts --dry-run

# Memory + backlog items in one batch
bun scripts/import-context-memory.ts \
  --source-dirs .context/memory,.context/backlog/items --dry-run

# Two --source-dirs flags (greedy)
bun scripts/import-context-memory.ts \
  --source-dirs .context/memory \
  --source-dirs .context/backlog/items \
  --dry-run
```

Per-kind framing is automatic: `memory` items get "session record" context
to Hindsight's extractor; `backlog` items get "backlog item" framing. That
keeps the recall distinguishing between "what we did" and "what we're
planning to do."

## What the script does (deterministic)

| Step | Behavior |
|------|----------|
| Scan | Publication-proven adapter `*.md` revisions under each logical `--source-dirs` prefix, except `index.md` and dotfiles |
| Parse | YAML frontmatter (simple subset) + body; per-kind required-frontmatter gate enforced |
| Id | Stable `document_id` = `buck-ctx-mem:<slug>:<path-sha20>` → server upsert |
| Skip | Exact source hash matches the configured-store cursor bound to the actual checkout/workspace run; local manifest is an optional export only |
| Retain | `POST /v1/default/banks/{bank}/memories` batches of 16, `async: true` by default |
| Tags | `project:<label>` when scoping is `per-project-tagged` |
| Content | Header (path/date/subject/topics/…) + body; cap ~48k chars |
| Cursor | Conditional retained update on the pre-HTTP bound destination; changed destination on restart or a concurrent cursor advance refuses |

## Flags

```
--root <dir>
--source-dirs <list>   # comma-separated; greedy flag-repeatable
--memory-dir <dir>     # deprecated alias for the .context/memory entry
--dry-run --force --limit <n> --sync
--api-url --api-token --bank-id --scoping --omp-config
```
## Verification

- Live run: `imported` plus retained cursor readback; spot-check with OMP `recall` on a known topic from an imported published revision
- Tests: `bun test skills/b-memory-import/scripts/import-context-memory.test.ts`; `npx vitest run skills/b-memory-import/scripts/import-context-memory.storage.test.ts`

## Related
- `b-hindsight-import-projects` — bulk wrapper that drives this script
  across many projects in one pass
- OMP tools `retain` / `recall` / `reflect` — interactive memory during sessions
- Import skip authority is the configured adapter's run-private cursor, not a local manifest. Stable `document_id` still makes re-import idempotent without skip state.
