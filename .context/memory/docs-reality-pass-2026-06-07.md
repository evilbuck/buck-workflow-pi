---
date: 2026-06-07
domains: [docs, buck-workflow, omp, pi]
topics: [readme, docs, extension-loading, b-save, b-flow, command-mirror]
related: []
priority: medium
status: completed
artifacts:
  - README.md
  - docs/buck-workflow.md
  - docs/b-flow.md
---

# README/docs reality pass

Updated public docs to match the current package surface:

- `README.md` now describes Pi + OMP as maintained targets, the `prompts/` source-of-truth plus `commands/` symlink mirror, and `/b-save` as a pure prompt/skill command.
- `docs/buck-workflow.md` now documents the runtime mapping, current wired extension scope, `/b-save` responsibilities, OMP command mirror, and b-flow as deprecated/unwired historical code.
- `docs/b-flow.md` now opens with a deprecated/unwired archival status note.

Reality verified against:

- `package.json`: both `pi.extensions` and `omp.extensions` point only to `./extensions/index.ts`.
- `extensions/index.ts`: wired behavior is model auto-switch plus TPS tracker.
- `extensions/buck-mode.test.ts`: asserts `/b-mode` and `/b-save` are not registered by the extension.
- `commands/*.md`: all 17 command files are symlinks to matching `prompts/*.md`.

Verification run:

- `npx vitest run extensions/buck-mode.test.ts extensions/tmux-window-status.test.ts` → 61/61 passing.
- Node package-surface check → `OK package extensions: ./extensions/index.ts`; `OK command mirror: 17 commands`.
- Search check over `README.md`, `docs/buck-workflow.md`, `docs/extension-loading.md` found no active stale claims that `/b-save` is extension-registered or Pi-only.
