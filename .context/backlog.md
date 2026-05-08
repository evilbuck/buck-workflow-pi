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

### test-b-phase-discrete
**Description**: Run `/skill:b-phase` against a real plan to verify discrete phase files are created correctly and b-build picks up the right phase.
**Context**:
- Relevant files: `skills/b-phase/SKILL.md`, `prompts/b-build.md`, `extensions/index.ts`
- This session (2026-05-06) implemented the discrete phase file system but hasn't been tested end-to-end
- Verification steps: create a test plan, run b-phase, verify phase files + overview are created, run b-build, verify phase state updates

### b-review-b-phase
**Description**: Run `/b-review` to validate the discrete phase file changes across skill, prompts, extension, and docs.
**Context**:
- Relevant files: all modified in this session
- Focus areas: backwards compat with legacy single-file format, phase state update correctness, extension dual-path logic

### test-phase-finders
**Description**: Add unit tests for `findActivePhaseDiscrete()` and `findActivePhaseLegacy()` in the extension test file.
**Context**:
- Relevant files: `extensions/index.ts`, existing test patterns in `extensions/*.test.ts`
- Test cases: discrete phase files (all states), legacy inline format, empty directory, mixed states

### test-tmux-extension
**Description**: Add vitest tests for `extensions/tmux-window-status.ts` or set up CI to run existing tests.
**Context**:
- The extension has 38 vitest tests but may not run in CI
- Related: `extensions/tmux-window-status.test.ts`

## High Priority

- [ ] [Fix QMD index crash on vault files with non-handlelizable filenames](#fix-qmd-index-crash)
- [ ] [Test b-present with a real single-file plan](#test-b-present-single-plan)
- [ ] [Test b-present with a phased plan for diagram and phase slides](#test-b-present-phased-plan)

## Nice to Have (Deferred)

- [ ] [Add tests for findActivePhaseDiscrete and findActivePhaseLegacy](#test-phase-finders)
- [ ] [Add tests for extensions/tmux-window-status.ts in CI](#test-tmux-extension)
- [ ] [Add scripts helper to auto-open b-present HTML or serve via HTTP server](#b-present-scripts-helper)

## Medium Priority

(none currently)

## Low Priority / Nice to Have

(none currently)

## Completed

- [x] Align `docs/buck-workflow.md` with Pi-native terminology — removed OpenCode config blocks, added historical reference appendix (2026-04-16)
- [x] **tmux-window-name-pi-status** — implemented `extensions/tmux-window-status.ts` with state machine for icon-only tmux window names (⚙️/🧠/✅/🚧/🛑) driven by pi lifecycle events; fixed thinking→working transition bug; refactored into pure StateMachine + injectable TmuxAdapter + wire(); 38 vitest tests (2026-04-16)
- [x] **brainstorm-sidecar-naming** — fixed `.b-brainstorm/` hidden subdirectory → flat `brainstorm-state-<slug>.json` in subject folder; updated prompt template and docs; removed dot prefix since `.context` is already hidden (2026-04-16)
- [x] Remove deprecated `memory-manager` skill from package — deleted `skills/memory-manager/`, removed from README (2026-04-16)
- [x] Clean Discoverability section — removed OpenCode-specific subagent/primary agent references (2026-04-16)
- [x] **ghostty-shift-enter** — commented out Omarchy default `keybind = shift+enter=text:\u001b[13;2u` in Ghostty config; conflicted with native Kitty keyboard protocol that pi enables on startup (2026-04-17)
- [x] **b-review-b-phase** — validated discrete phase file changes across skill, prompts, extension, and docs; confirmed backwards compat with legacy format, phase state updates, and extension dual-path logic (2026-05-07)

## b-present Skill

### test-b-present-single-plan
**Description**: Test `/b-present` against a real single-file plan to verify Reveal.js HTML generation, Mermaid diagrams, and slide structure.
**Context**:
- Relevant files: `skills/b-present/SKILL.md`, `skills/b-present/references/revealjs-templates.md`
- Verification steps: create a test plan in a subject folder, run `/b-present`, open generated HTML in browser, verify slides + diagrams render, speaker notes work, keyboard navigation works

### test-b-present-phased-plan
**Description**: Test `/b-present` against a phased plan to verify phase overview slides, dependency diagram, and per-phase detail slides.
**Context**:
- Relevant files: `skills/b-present/SKILL.md` (phased plan section mapping)
- Verification steps: use an existing phased plan, run `/b-present`, verify phase summary table, dependency flowchart, and acceptance criteria appear correctly

### b-present-scripts-helper
**Description**: Add a `scripts/` helper to the b-present skill that auto-opens the generated HTML in a browser (e.g., via `open`/`xdg-open`) and optionally serves it via a local HTTP server.
**Context**:
- Relevant files: `skills/b-present/scripts/`
- Optional: integrate with `run-in-idle-pane` for serving the presentation
