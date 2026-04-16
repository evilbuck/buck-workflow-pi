# Backlog

## Details

### fix-qmd-index-crash
**Description**: `qmd update` crashes when indexing the vault collection because some Obsidian note filenames have no valid content for the `handelize()` function.
**Context**:
- Relevant files:
  - QMD is installed globally via mise: `qmd 1.0.7` at `~/.local/share/mise/installs/node/25.1.0/lib/node_modules/@tobilu/qmd/`
  - Crash source: `store.js:719` → `handelize()` function
  - Problematic directory: `~/Documents/obsidian_vaults/buck_vault/30_Resources/Tech-Notes/Tech Notes/Spatial SQL with PostGIS and Postgres What makes spatial queries special/New database/`
- The crash file: `=.md` — filename is just `=` which produces an empty slug
- Other problematic files in same directory: `& (A, B) 1.md`, `&& (A, B).md`, etc. — filenames composed entirely of non-alphanumeric characters
- QMD DB: `~/.cache/qmd/index.sqlite` (45.3 MB, 2755 files indexed)
- Collections: vault, chezmoi, context, memory, memory2
- The vault collection uses pattern `**/*.md` and has 2479 files
- Memory collections (memory + memory2) are 4 days stale because `qmd update` fails before reaching them
- Requirements:
  - Option A: Rename/remove the problematic files in the Obsidian vault (simplest, but may be unwanted)
  - Option B: Report bug upstream to QMD (`@tobilu/qmd`) — `handelize()` should skip or sanitize files with empty slugs rather than throwing
  - Option C: Find if QMD supports an exclude/ignore pattern per collection to skip these files
  - Option D: Check if upgrading QMD fixes it (current: 1.0.7)
- Technical notes:
  - Error message: `Error: handelize: path "30_Resources/.../=.md" has no valid filename content`
  - Stack: `handelize()` → `indexFiles()` → `updateCollections()`
  - The vault collection processes first (of 5), so ALL subsequent collections fail too
- Related work: Buck workflow extension calls `qmd index .context/memory --collection memory` but the CLI has no `index` subcommand; it uses `qmd update` to reindex all collections

## High Priority

- [ ] [Fix QMD index crash on vault files with non-handlelizable filenames](#fix-qmd-index-crash)

## Medium Priority

(none currently)

## Low Priority / Nice to Have

(none currently)

## Completed

- [x] Align `docs/buck-workflow.md` with Pi-native terminology — removed OpenCode config blocks, added historical reference appendix (2026-04-16)
- [x] **tmux-window-name-pi-status** — implemented `extensions/tmux-window-status.ts` with state machine for icon-only tmux window names (⚙️/🧠/✅/🚧/🛑) driven by pi lifecycle events; saved original window name restored on session shutdown (2026-04-16)
- [x] Remove deprecated `memory-manager` skill from package — deleted `skills/memory-manager/`, removed from README (2026-04-16)
- [x] Clean Discoverability section — removed OpenCode-specific subagent/primary agent references (2026-04-16)
