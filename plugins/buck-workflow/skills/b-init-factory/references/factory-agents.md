# Agent Software Factory

This directory is a **nested project**: a generic software factory for agents. It is not the wrapping application's context. Do not import wrapping-product domain, architecture, or style into this tree.

## Purpose

Build and maintain **skills** and **commands** (thin per-harness wrappers around portable skills). The factory produces agent capabilities, not application features.

## Harness stance

The factory is **agent-agnostic**. No single runtime (Claude Code, OMP, Pi, Codex, Goose, OpenCode, Grok, Cursor, or any other) is the home.

- Canonical logic lives in Agent Skills `SKILL.md` files.
- Per-harness surfaces are thin wrappers only (slash commands, plugin skills, recipes).
- Prefer the [Agent Skills](https://agentskills.io) standard and shared locations (e.g. `.agents/skills/`) over harness-only trees.
- When a change is harness-only, flag it and port. The direction of travel is **away from Claude-only** (and away from any other single-harness lock-in).

## Layout

| Path | Owns |
|---|---|
| `AGENTS.md` | This file — factory operating instructions |
| `docs/` | Factory-only documentation (not wrapping-project docs) |
| `skills/` | Portable skills (when this factory starts producing them) |
| `prompts/` / `commands/` | Thin wrappers (when this factory starts producing them) |

## Working here

Treat this folder as the project root for factory work. Wrapping-repo `AGENTS.md` / `CLAUDE.md` / `CONTEXT.md` do not govern this tree.

Documenting the factory (the `docs/` folder) comes after this file exists. Do not dump wrapping-project docs here.
