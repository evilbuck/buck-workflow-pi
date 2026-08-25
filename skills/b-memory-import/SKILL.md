---
name: b-memory-import
description: Deterministically import project .context/memory markdown into OMP Hindsight (retain). Use for one-shot/backfill seeding of native agent memory from Buck session records.
triggers:
  - /b-memory-import
  - import context memory
  - seed hindsight from .context
---

Push **this project's** `.context/{memory,backlog/items}/**/*.md` into the
configured **Hindsight** bank via HTTP retain. Deterministic Bun script — no
LLM, no qmd required.
2. Env `HINDSIGHT_API_URL`, `HINDSIGHT_API_TOKEN`, `HINDSIGHT_BANK_ID`, `HINDSIGHT_SCOPING`
3. `~/.omp/agent/config.yml` → `hindsight.*`

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

The script walks any combination of these directories under `.context/`:

| Path | `kind` | Required frontmatter |
|------|--------|------------------------|
| `.context/memory/` | `memory` | yes (any) |
| `.context/backlog/items/` | `backlog` | `title` + `status` (string) |

Files missing required frontmatter are skipped with a warning in the
`parse_warnings` field of the result envelope. Walk passes silently through
missing dirs (only the canonical first dir is required to exist).

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
| Scan | All `*.md` under each `--source-dirs` entry, except `index.md` and dotfiles |
| Parse | YAML frontmatter (simple subset) + body; per-kind required-frontmatter gate enforced |
| Id | Stable `document_id` = `buck-ctx-mem:<slug>:<path-sha20>` → server upsert |
| Skip | Manifest sha match at the first source dir (canonical). One manifest per project regardless of how many source dirs walked |
| Retain | `POST /v1/default/banks/{bank}/memories` batches of 16, `async: true` by default |
| Tags | `project:<label>` when scoping is `per-project-tagged` |
| Content | Header (path/date/subject/topics/…) + body; cap ~48k chars |

## Flags

```
--root <dir>
--source-dirs <list>   # comma-separated; greedy flag-repeatable
--memory-dir <dir>     # deprecated alias for the .context/memory entry
--dry-run --force --limit <n> --sync
--api-url --api-token --bank-id --scoping --omp-config
```
## Verification

- Live run: `imported` + manifest entries; spot-check with OMP `recall` on a known topic from an imported file
- Tests: `bun test skills/b-memory-import/scripts/import-context-memory.test.ts`

## Related
- `b-hindsight-import-projects` — bulk wrapper that drives this script
  across many projects in one pass
- OMP tools `retain` / `recall` / `reflect` — interactive memory during sessions
- Manifest is local skip-state (gitignored); `document_id` still makes re-import idempotent without it
