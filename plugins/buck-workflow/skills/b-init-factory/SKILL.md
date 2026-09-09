---
name: b-init-factory
description: Initialize a nested agent software factory — write a factory-scoped AGENTS.md (and ensure a factory-local docs/ folder) in a harness directory the user names, a project default, or an asked choice. Never assume .claude/. Use when treating a harness folder as its own project that builds portable skills and commands.
argument-hint: "[factory-root]"
---

# b-init-factory: Nested Agent Software Factory

Write a **simplistic** `AGENTS.md` inside a nested directory that is its own project: a generic software factory for agents. That file drives building **skills and commands**. It is not the wrapping application's context.

This pass is **AGENTS.md only**. Factory-local documentation comes later. Create `docs/` if missing; do not fill it.

## When to use

- A repo wants a nested factory (skills/commands workshop) separate from the wrapping product.
- Someone says "treat `.claude/` / `.omp/` / `.agents/` as its own project."
- Starting an agent-agnostic factory and getting off a single-harness (including Claude-only) home.

Not for: wrapping-project `AGENTS.md`/`CLAUDE.md` at repo root (`GLOBAL_OR_PROJECT-AGENTS.md` / `/b-docs`); quality gates (`b-init-guardrails`); session memory (`b-save`).

## Invocation (all harnesses)

Same skill body. Native entrypoints:

| Harness | Invoke |
|---|---|
| **Pi** | `/b-init-factory` (`prompts/b-init-factory.md`) or `/skill:b-init-factory` |
| **OMP** | `/b-init-factory` (`commands/b-init-factory.md` → prompt) or skill by name |
| **Claude Code** | `/b-init-factory` after `buck-workflow install` (command + skill links) |
| **Codex** | `$b-init-factory` after installing the Buck Workflow plugin |
| **OpenCode** | `/b-init-factory` after `buck-workflow install` |
| **Grok Build** | `/b-init-factory` after `buck-workflow install --harness grok` |
| **Goose** | Summon / load `b-init-factory`; no slash wrapper |
| **Cursor** | Load this `SKILL.md` from project rules; no global install |

Do not require OMP-only tools (`ask`, `retain`, `recall`). If a native chooser exists, use it; otherwise ask in chat and wait.

## Resolve factory root

Never default to `.claude/`. Never use the wrapping repo root unless the user explicitly names `.` / the repo root.

**Well-known harness dirs** (project-relative): `.claude` `.omp` `.pi` `.agents` `.codex` `.opencode` `.cursor` `.goose` `.grok`

Normalize arguments: `claude`, `.claude`, `.claude/` → `.claude`. Absolute paths allowed.

### 1. Told

If `$ARGUMENTS` (or the user message) names a path, use it. Remaining args may include `refresh` to overwrite an existing factory `AGENTS.md`.

### 2. Project default

If no path was told, resolve **one** default, first hit:

1. Wrapping `AGENTS.md` or `CLAUDE.md` YAML `factory_root:` **or** a `## Agent factory` section that names a single path.
2. A `.factory-root` file in the wrapping repo (one path; `#` comments ignored).
3. Exactly **one** existing well-known harness directory. If several exist, this step does not choose.

### 3. Ask

If still unset or several candidates exist: list detected well-known dirs (existing vs missing) and ask which folder is the factory. Do not guess. Do not create a directory until the user answers.

Stop until the root is resolved.

## What the factory is

Treat `<factory_root>` as a **separate project**:

| In scope | Out of scope |
|---|---|
| Portable skills and commands/prompts | Wrapping product domain, app architecture, app style |
| Factory-local `docs/` | Wrapping `docs/`, `CONTEXT.md`, ADRs |
| Agent-agnostic packaging (Agent Skills `SKILL.md`, thin per-harness wrappers) | Harness-only features presented as the factory's home |

**Harness stance:** the factory is **agent-agnostic**. Do not treat Claude Code, OMP, Pi, Codex, Goose, or any other runtime as the canonical home. Prefer the [Agent Skills](https://agentskills.io) standard, portable `SKILL.md`, and thin wrappers (`prompts/` + per-harness command/plugin links). When a change is harness-only, flag it and port.

The factory file is always `AGENTS.md` — even under `.claude/`. Do not write `CLAUDE.md` as a substitute; that is Claude's wrapping-project context, not the factory.

## Procedure

### 0. Idempotency

- If `<factory_root>/AGENTS.md` exists and the user did not say `refresh`: report the path, do not overwrite, ensure `docs/` exists, stop.
- `refresh`: replace `AGENTS.md` from the template below. Do not delete other factory files.

### 1. Create the root if needed

Create `<factory_root>/` only after the path is resolved.

### 2. Write `AGENTS.md`

Copy `references/factory-agents.md` into `<factory_root>/AGENTS.md`. Keep it simplistic. Do not splice wrapping-project names, stacks, or conventions into it.

### 3. Ensure `docs/`

Create `<factory_root>/docs/` if missing. Do not add factory documentation in this pass (no README, no ADRs, no how-tos). Note in the chat reply that documenting the factory is next.

### 4. Report

State: resolved root and how (told / default / asked); files written or left untouched; next step (factory docs, then skills/commands). Do not edit wrapping-project `AGENTS.md` unless the user asked to record `factory_root`.

## Files in this skill

- `SKILL.md` — this entry point
- `references/factory-agents.md` — the factory `AGENTS.md` template (source of truth for step 2)
