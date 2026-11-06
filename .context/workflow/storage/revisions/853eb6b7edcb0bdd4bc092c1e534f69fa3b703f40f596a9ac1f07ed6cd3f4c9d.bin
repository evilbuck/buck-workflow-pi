# Plan: Herdr OMP Agent Driver

## User Goal

You, in a live OMP session, dispatch work to other agents that run in **visible Herdr panes** — one control pane plus task runners — so you can see what is running and what each runner produced. Consensus is **not** a locked hidden aggregator: you watch, then pick, keep driving, or accept a labeled digest.

## What we might build

- An **OMP plugin** that drives other agents through the **herdr CLI** (external controller), not a portable skill and not in-process MoA whispers.
- Layout: control pane + N runner panes (`--split --no-focus`).
- Combine step (from research): default = visible transcripts + optional labeled digest; cheapest high-signal filter for this repo = **run candidates, keep what passes** (`guardrails.json` / tests). Academic MoA/debate are later options, not v1.

## Why it matters

- Hidden orchestrators (b-flow) failed here. Visibility is the point.
- Vault already decided OMP `/moa` is *consultation* (labeled opinions, no separate synthesizer). This plugin is a different product: visible external panes (closer to driving other agents), not a StreamFn facade.

## Constraints / preferences

- OMP plugin. Herdr session must already exist. Ephemeral pane ids. `pane read` over `agent read`. `agent send` needs Enter. Wait helpers, not sleeps.
- Tension with deprecate-b-flow: still an extension that drives agents; claimed difference is visible panes.
- Do not re-litigate the vault note `10_Projects/OMP MoA Extension (decision & spec).md`: watchdogs own review; `/moa` owns consultation.

## Open questions

- Control pane = OMP TUI vs OMP inside a herdr pane?
- v1 combine: none vs labeled digest vs test-filter vs advisory judge?
- Specialized roles in v1 or later?

## Brainstorm notes

- Interview cut short; user asked for methodology research, then Obsidian dual-write. Goal synthesized from: OMP plugin, Herdr panes, human watches, consensus unsettled.
- Research: `research-multi-agent-distillation.md`.
