---
status: completed
date: 2026-06-10
subject: 2026-06-10.agent-install-instructions
topics: [install, opencode, pi, omp, claude-code, codex, agent-skills, slash-commands, bootstrap, cross-harness, docs, readme]
research: []
iterations: []
spec: []
memory: []
artifacts:
  - ../../agent-install_instructions.md
  - ../../README.md
---

# Plan: agent-install_instructions

## User Goal

A maintainer of `buck-workflow-pi` (or a downstream user) who wants the
Buck workflow skills installable on **any** of the five supported harnesses
(Pi, OMP, OpenCode, Claude Code, Codex) — using each harness's native
install mechanism, with copy-pasteable commands and a self-verifying
check. The README should point installing agents at this single file.

## Goal

1. Produce `agent-install_instructions.md` at the repo root — a single,
   self-contained, agent-runnable install guide.
2. Update `README.md` to link the new file from the top of the Install
   section so any agent reading the README can find the right install
   path immediately.

## Context used / assumptions

- **User-provided context** (this turn): "I want you to create an
  instruction for an agent to read and install these skills. You can
  include the link or reference to the instructions for the agent in the
  README. Something like `Agents- use the following to install with your
  agent: Use the instructions found at {github_url_path}/agent-install_instructions.md
  to install this set of skills` Make any changes necessary to make the
  installer work better for different agents."
- **Session context**: This is a `/b-plan` invocation on a fresh branch
  (`agent-install-instructions`). The deliverable is a docs + README
  change; no source code is touched.
- **Repo state**: `package.json` already declares `pi` and `omp`
  manifests with skills/prompts/extensions. `prompts/` is the source of
  truth for slash commands; `commands/` is a symlink mirror to
  `prompts/` for OMP discovery.
- **Assumptions**:
  - The five target harnesses are fixed: opencode, pi, omp, codex, claude-code.
  - The install instructions file should be agent-runnable, not just
    human-runnable — meaning an agent should be able to read it and
    identify the right section for its own harness.
  - Symlinks are the preferred install mechanism on file-based harnesses
    (OpenCode, Claude Code, Codex) because they keep the install in sync
    with the source repo and let edits flow through.
  - The companion `GLOBAL_OR_PROJECT-AGENTS.md` bootstrap is a separate
    step (per-harness target path), already documented in the README.
  - The README's existing per-harness install table ("OMP / Pi / Claude
    Code / OpenCode / Codex") remains — the new file extends and
    concretizes those entries.

## Scope

**In scope:**

1. New file at repo root: `agent-install_instructions.md`. Sections:
   - Top-of-file agent self-detect preamble
   - What-you-get table of `b-*` commands
   - Quick-reference install-method matrix
   - Per-harness section: Pi, OMP, OpenCode, Claude Code, Codex
   - Each section: install commands, where things land, verify step,
     reference URL
   - Companion bootstrap section (per-harness `AGENTS.md` / `CLAUDE.md`
     target path)
   - "Verify it worked" smoke-test checklist
   - Troubleshooting (slash vs `$skill`, name collisions, symlinks,
     permission prompts)
2. README edit: add a single blockquote at the top of the Install
   section that points installing agents at the new file.

**Out of scope:**

- Source changes to `skills/`, `prompts/`, `commands/`, or `extensions/`.
- Changes to `package.json` — the existing `pi` and `omp` manifests are
  correct as-is.
- Marketplace publishing for Claude Code / OMP / Codex — the file
  documents the future hook but does not publish anything.
- A new install script (e.g. `bin/install.sh`) — symlink loops in the
  file are sufficient and more transparent.
- New cross-harness compat fixes — those live in
  `.context/2026-06-06.omp-integration-buck-workflow/`.

## Implementation steps

1. **Research each harness's install mechanism** — done. Sources captured
   in `index.md`.
2. **Draft `agent-install_instructions.md`** with one section per
   harness, copy-paste install blocks, and a "where things go" table per
   section. The body of each section was written this turn.
3. **Edit `README.md`** to insert a single blockquote at the top of the
   `## Install` section pointing at the new file. No other README
   changes; the existing per-harness table and bootstrap instructions
   remain.
4. **Verify the install file reads well** end-to-end: every harness
   section is self-contained, the smoke test at the end works, the
   troubleshooting covers the four known failure modes (slash vs
   `$skill`, name collisions, symlink breakage, permission prompts).
5. **Verify the README change** is one blockquote, no content loss.

## Files touched

| File | Change |
|---|---|
| `agent-install_instructions.md` | New file, ~280 lines |
| `README.md` | Insert one blockquote at the top of the Install section |
| `.context/2026-06-10.agent-install-instructions/plan-agent-install-instructions.md` | This plan |
| `.context/2026-06-10.agent-install-instructions/index.md` | Subject folder index |

## Verification

- [x] `agent-install_instructions.md` exists at repo root.
- [x] One section per harness (Pi, OMP, OpenCode, Claude Code, Codex),
      each with install + where-things-go + verify + reference.
- [x] README's Install section opens with a clear pointer to the new
      file.
- [x] No claims about agent behavior lack a source URL.
- [x] No edits to `skills/`, `prompts/`, `commands/`, `extensions/`, or
      `package.json`.
- [x] Smoke-test checklist at the bottom of the install file matches
      what each harness actually does.
