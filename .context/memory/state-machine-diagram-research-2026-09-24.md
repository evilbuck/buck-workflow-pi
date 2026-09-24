---
date: 2026-09-24
domains: [docs, visualization, research]
topics: [state-machine, cytoscape, diagram, obsidian-vault, buck-loop]
related: []
priority: low
status: completed
artifacts: [docs/state-machine-diagram.html]
---

# State-machine diagram + drawing-library research

**Task:** generate a beautiful zoomable/pannable diagram of the buck-loop state machine (HTML+JS), research the drawing-library landscape, and file the research in the Obsidian vault.

## What was done

1. **Machine extraction** — pulled the 11 `LoopState`s from `extensions/buck-loop/types.ts` and the full transition set from `extensions/buck-loop/machine.ts` (guard rules aggregated into ~35 edges by (from, to, label): flow, rework cycles, halt fan-in, STOP fan-in, `blocked→resolving` resume).
2. **Library research (3 scouts in parallel)** — Cytoscape deep-dive, alternatives sweep, visual-design patterns. Verdict: **Cytoscape.js 3.34 + cytoscape-dagre 4.x** (MIT, native wheel-zoom/drag-pan, layered DAG, no build). Disqualified: GoJS ($3,995/dev), JointJS+ (paid plugins), React Flow/xyflow (React peer + build), maxGraph (npm-only). Backups if Cytoscape ever fails: Mermaid + svg-pan-zoom (fastest), D3 + d3-dag (max control), @viz-js/viz WASM (prettiest static).
3. **Diagram built** — `docs/state-machine-diagram.html` (self-contained, CDN scripts, dark theme, category-colored states, dashed cycle/resume edges, weighted dagre LR layout, legend, zoom buttons, dim-on-select interaction, tap-to-inspect info panel).
4. **Verified in Chromium** — render, wheel-zoom reaction, drag-pan, node tap → info panel (`state: blocked`), fit button; screenshot proof at each step.
5. **Vault documentation** — `30_Resources/Tech-Notes/State Machine Diagram Libraries (JS).md` (comparison table, embedding pattern, live-tested gotchas, design checklist), indexed in `Javascript Libraries.md`, logged in `LLM Wiki Log.md`.

## Key findings (durable)

- **cytoscape-elk@2.3.0 UMD is broken in browsers** (`ELK_default is not a constructor`) — reach for dagre first.
- Dagre layout sags without per-edge weights: give happy-path edges `weight ~10`, cosmetic fan-in edges `~0.4`.
- Cytoscape renderer is canvas: interactions go through `cy.on('tap')`, not CSS; text stays crisp at any zoom.
- `width: 'label'` and custom `wheelSensitivity` both print benign deprecation/warning console noise.
- **Vault path differs from the skill default:** actual vault is `~/Documents/obsidian_vaults/Second Brain` (per Obsidian's own registry), not `~/Documents/second brain`.

## Verification

- Diagram exercised live in headless Chromium (zoom/pan/tap/fit all functional; screenshots reviewed).
- Docs-only session (all changed paths under `docs/` or `.context/`) → guardrails gate skipped per contract.

## Follow-ups

- None required. Optional: re-pin `cytoscape-elk` to a working version if orthogonal routing is ever wanted.
