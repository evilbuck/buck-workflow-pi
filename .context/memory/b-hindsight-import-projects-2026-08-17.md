---
date: 2026-08-17
domains: [infra, tooling, memory]
topics: [omp, hindsight, bulk-import, buck-workflow, skill-development, ts, bun]
related: [ollama-igpu-enable-2026-08-16.md]
priority: medium
status: completed
artifacts:
  - /home/buckleyrobinson/projects/development_tools/buck-workflow-pi/skills/b-hindsight-import-projects/SKILL.md
  - /home/buckleyrobinson/projects/development_tools/buck-workflow-pi/skills/b-hindsight-import-projects/scripts/import-projects.ts
  - /home/buckleyrobinson/projects/development_tools/buck-workflow-pi/skills/b-hindsight-import-projects/scripts/import-projects.test.ts
---

# Session: 2026-08-17 - b-hindsight-import-projects skill

## Goal
Build a multi-project wrapper around the existing `b-memory-import` skill
so that OMP Hindsight can be bulk-seeded across `~/projects/*` in one pass.
Validated against partypix (131 memory files) and qrpro (345 memory files)
in the `evilbuck` bank on proxmox.tiger-goanna.ts.net:8888.

## Built

### Skill: `b-hindsight-import-projects`
Lives at `skills/b-hindsight-import-projects/` in `buck-workflow-pi`.
- `SKILL.md` — describes when to use, CLI shape, output schema, failure
  semantics, related skills
- `scripts/import-projects.ts` — Bun/TS wrapper. Discovers projects under
  one or more `--root` directories, filters via `--include`/`--exclude`,
  spawns `import-context-memory.ts` per project with bounded concurrency
  (default 1), aggregates results into one JSON envelope
- `scripts/import-projects.test.ts` — 8 smoke tests; no network

### Pointer
Added "Related" entry in `b-memory-import/SKILL.md` so the new skill is
discoverable from the inner script's docs.

## CLI shape

```
bun skills/b-hindsight-import-projects/scripts/import-projects.ts \
  --root ~/projects \
  --include partypix qrpro \
  --dry-run
```

Discovery rules: if `<root>/.context/memory/` exists, treat `<root>` as a
single project; otherwise scan immediate subdirectories of `<root>` for
`<sub>/.context/memory/`. Hidden dirs skipped. `--include`/`--exclude`
filter by basename. All flags forward to the inner script
(`--dry-run`, `--sync`, `--force`, `--limit`, `--api-url`, etc.).

Greedy parsing for repeatable flags (`--root`, `--include`, `--exclude`):
each consumes all following non-flag args. Without this, `--include
partypix qrpro` would silently treat `qrpro` as an unknown arg and pass
it to the child.

## Verification

- `bun test skills/b-hindsight-import-projects/scripts/import-projects.test.ts`:
  8 pass, 0 fail
- Dry-run against real projects: 476 files planned (131 partypix + 345
  qrpro), bank `evilbuck`, 102 ms (no HTTP)
- Live pilot (`--sync --limit 3`): 6 items imported, 0 failed, 28 s total
  (qrpro 128 s — extraction is the dominant cost; partypix 147 ms because
  extraction finished early). Server confirmed 200 OK
- Hindsight `memories/list` after settle:
  - partypix: 6 (3 from pilot + 3 from a direct test retain — see Gotchas)
  - qrpro: 50 (was 46; net +4)
  - Total bank: 153 (was 145)

## Gotchas / Notes

### Async extraction race
Hindsight list endpoint doesn't immediately reflect newly retained items
when `async: false` is used at the request level — extraction still runs
in the background and writes are observable after a few seconds. The
inner script returns success as soon as the API returns 200, not when
extraction completes. To verify a run landed: wait 10–30 s before
querying `memories/list`, or trust the `imported` count from the script
output (the server counted it).

### `update_mode: "replace"` on never-seen IDs is fine
`b-memory-import` sets `update_mode: "replace"` on every item, but
Hindsight treats it as a no-op insert (or create) when the
`document_id` doesn't exist yet. Confirmed via isolated test:
`replace` on a fresh `document_id` → 1 entry. No `update_mode` →
silently dropped. So the wrapper's behavior is correct; the inner
script's setting is the safe default.

### Pilot cost shape
3 partypix files @ `--sync` → 147 ms (extraction ran quickly). 3 qrpro
files @ `--sync` → 128 s. The 1000x delta is extraction cost, not
network — qrpro files are larger and the LLM extraction is sequential.
For bulk backfill across many files, drop `--sync` (default is async);
fire-and-forget is ~10x faster per item but you can't tell from the
output whether each item successfully extracted.

### OMP wiring note
`xd://retain` (the device in the tool inventory) is **not** wired up.
The actual write path is the Hindsight HTTP API at
`/v1/default/banks/{bank}/memories` via the `pi-hermes-memory`
extension. The `b-hindsight-import-projects` wrapper uses HTTP directly
because it needs the aggregate envelope for reporting; that's fine for
batch jobs, but ongoing session-side retention should still go through
the OMP extension (transparent).

## Test artifacts
- `/tmp/dryrun.json` — wrapper dry-run output (476 planned, 0 imported)
- `/tmp/live-pilot.json` — wrapper live pilot output (6 imported)
- `/tmp/all-mems-2.json` — full bank state after pilot + tests (153 items)

## Next Steps
- [ ] Run the wrapper against the rest of `~/projects/*` (22 projects
      total) — `--all --dry-run` first to confirm scope, then `--all`
      for the bulk seed
- [ ] Add a `--tag-prefix` flag so users can override the default
      `project:<label>` tag scheme (useful if multiple machines import
      the same project name)
- [ ] After the bulk seed lands, evaluate recall quality — does a query
      for a partypix or qrpro decision return the right memories?
      Determines whether the wrapper needs more curation or if the
      fact-extraction is good enough on its own
- [ ] Decide whether to add a `b-hindsight-recall-projects` companion
      skill that summarizes what each project contributed to the bank
      (low priority — recall API already supports tag-filtered queries)