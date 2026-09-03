---
title: Locate Pi coding-agent runtime source in clean worktrees
status: active
priority: medium
created: 2026-09-03
updated: 2026-09-03
completed: null
related:
  - .context/2026-08-26.deterministic-bsave/plan-bsave-improved-parity.md
  - .context/memory/deterministic-bsave-2026-08-27.md
  - .context/memory/omp-integration-buck-workflow-2026-06-06.md
  - .context/memory/b-pr-improved-worktree-enotdir-2026-07-24.md
  - skills/b-save-improved/SKILL.md
  - skills/cross-platform-pi-omp-loading/SKILL.md
  - extensions/b-save-improved/index.ts
  - package.json
---

# Locate Pi coding-agent runtime source in clean worktrees

## Problem

During diagnosis of `b-save-improved` (and related extensions), an attempted source lookup at `node_modules/@mariozechner/pi-coding-agent` failed with `Path not found`. In clean git worktrees and environments where repository-local packages are not pre-installed, assumptions that `@mariozechner/pi-coding-agent` exists under the repository-relative `node_modules/` path break down. Diagnostics that need to verify runtime behavior, `ExtensionAPI` types, or runtime shims across harnesses (Pi and OMP) need a supported, documented method to locate and inspect the runtime source without relying on repository-local directory assumptions.

## Investigation Goal

Determine the supported way to locate and read the Pi coding-agent runtime source in a clean worktree, and avoid repository-local package assumptions in future diagnostics.

## Acceptance criteria

- [ ] Identify and document supported resolution paths for the active Pi coding-agent runtime source across supported environments and clean git worktrees (e.g. global installation paths, package manager caches, harness runtime shims, or parent checkout resolution)
- [ ] Document diagnostic procedures for inspecting `ExtensionAPI` contracts and runtime source without assuming a local `node_modules/@mariozechner/pi-coding-agent` directory exists
- [ ] Verify the resolution procedure succeeds when run from a freshly created clean worktree where repository-local `node_modules` is absent
