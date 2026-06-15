---
date: 2026-06-15
domains: [tooling]
topics: [omp, plugin, tui, account-awareness]
subject: 2026-06-15.omp-account-status-plugin
artifacts: []
related: []
priority: medium
status: active
---

# Session: OMP Account Status Plugin

## What happened

Created `omp-account-status` OMP plugin to expose the current omp-account (the suffix of `PI_CODING_AGENT_DIR` under `~/.omp/accounts/`) in the OMP TUI.

## How it works

The plugin is a local OMP plugin at `~/.omp/agent/plugins/omp-account-status/` (symlink-installed to `~/.omp/plugins/`).

On every `session_start`, it reads:
- `getAgentDir()` from `@oh-my-pi/pi-utils` — the effective `PI_CODING_AGENT_DIR`
- `OMP_ACCOUNT` env var — set by the user's `omp-account` zsh function

Then pushes to two TUI surfaces:
1. `ctx.ui.setStatus("omp-account", …)` — hook-status line below the main status bar (theme-colored with `statusLineContext`)
2. `ctx.ui.setWidget("omp-account", …, {placement:"aboveEditor"})` — persistent dimmed card above the editor

## Key OMP plugin system findings (from librarian research)

- OMP uses `package.json#omp` manifest (not `plugin.json`)
- `StatusLineSegmentId` is a closed enum — no plugin API to add new segments
- `ctx.ui.setStatus(key, text)` is the canonical extension point for status bar text
- `ctx.ui.setWidget(key, content, opts)` mounts persistent text above/below the editor
- `setHeader`/`setFooter` are stubs (not currently wired)
- `getAgentDir()` from `@oh-my-pi/pi-utils` is the correct API for the agent directory

## Files created

- `~/.omp/agent/plugins/omp-account-status/package.json` — OMP manifest
- `~/.omp/agent/plugins/omp-account-status/index.ts` — extension

## Verification

- Plugin installed via `omp plugin install ~/.omp/agent/plugins/omp-account-status`
- Registered in `~/.omp/plugins/omp-plugins.lock.json`
- No errors in `~/.omp/logs/omp.2026-06-15.log`
- `omp plugin list` only shows npm/marketplace plugins — local link-installed plugins not shown there (known OMP behavior)

## Notes

- LSP errors about `@oh-my-pi/pi-coding-agent` not found are workspace-LSP false positives — OMP resolves these at runtime from its own `node_modules`
- The plugin uses `ExtensionContext` type from `@oh-my-pi/pi-coding-agent` for the `session_start` handler
- `session_shutdown` handler is empty — status/widget auto-clear on session end
