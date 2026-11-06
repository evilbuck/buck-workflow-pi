---
status: draft
date: 2026-06-05
subject: 2026-06-05.session-json-origin
topics: [session-state, extension, pi-integration]
related: []
informs: []
artifacts: [research-session-json-origin.md]
---

# Subject: Origin of `.context/workflow/current-session.json`

Quick investigation. Trigger question: *Is the current `current-session.json` a product of the buck-workflow or a pi standard?*

## TL;DR

**Buck workflow product, not a pi standard.** It is created and managed entirely by `extensions/index.ts` in this repo. Pi has its own session format (JSONL, tree-structured, at `~/.pi/agent/sessions/...`) which is unrelated.

## Artifacts

- [research-session-json-origin.md](research-session-json-origin.md) — full findings
