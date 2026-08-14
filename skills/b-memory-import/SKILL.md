---
name: b-memory-import
description: Deterministically import project .context/memory markdown into OMP Hindsight (retain). Use for one-shot/backfill seeding of native agent memory from Buck session records.
triggers:
  - /b-memory-import
  - import context memory
  - seed hindsight from .context
---

# b-memory-import

Push **this project's** `.context/memory/**/*.md` into the configured **Hindsight** bank via HTTP retain. Deterministic Bun script — no LLM, no qmd required.

## When to use

- First time enabling OMP Hindsight on a repo that already has Buck `.context/memory`
- Catch-up after many `/b-save` sessions written only to git
- Re-seed after bank clear / new `bankId`

**Not** a substitute for `/b-save`. Ongoing sessions should still write `.context/memory` (and optionally `retain` key facts). This skill is bulk backfill.

## Prerequisites

- `bun` on PATH
- OMP Hindsight configured (`memory.backend: hindsight`) **or** explicit `--api-url` / `HINDSIGHT_*`
- Project has `.context/memory/` (any Buck project)

Credentials resolution (first hit wins):

1. CLI `--api-url` / `--api-token` / `--bank-id` / `--scoping`
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

3. Review JSON: `scanned`, `planned`, `skipped_unchanged`, `bank_id`, `project_label`.
4. Import:

```bash
bun "${SKILL_DIR}/scripts/import-context-memory.ts"
```

5. Optional: `--force` to re-upsert all; `--limit N` for a pilot batch; `--sync` to wait for extraction.

## What the script does (deterministic)

| Step | Behavior |
|------|----------|
| Scan | All `*.md` under `.context/memory` except `index.md` and dotfiles |
| Parse | YAML frontmatter (simple subset) + body |
| Id | Stable `document_id` = `buck-ctx-mem:<slug>:<path-sha20>` → server upsert |
| Skip | Manifest sha match at `.context/memory/.omp-hindsight-import-manifest.json` |
| Retain | `POST /v1/default/banks/{bank}/memories` batches of 16, `async: true` by default |
| Tags | `project:<label>` when scoping is `per-project-tagged` |
| Content | Header (path/date/subject/topics/…) + body; cap ~48k chars |

No qmd. Source of truth is the filesystem every project already has.

## Flags

```
--root <dir> --memory-dir <dir> --dry-run --force --limit <n> --sync
--api-url --api-token --bank-id --scoping --omp-config
```

## Verification

- Dry-run exit 0 and `planned` matches expectations
- Live run: `imported` + manifest entries; spot-check with OMP `recall` on a known topic from an imported file
- Tests: `bun test skills/b-memory-import/scripts/import-context-memory.test.ts`

## Related

- `skills/b-save` — writes `.context/memory` (git-portable record)
- OMP tools `retain` / `recall` / `reflect` — interactive memory during sessions
- Manifest is local skip-state (gitignored); `document_id` still makes re-import idempotent without it
