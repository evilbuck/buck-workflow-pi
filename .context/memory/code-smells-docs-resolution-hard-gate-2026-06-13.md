---
date: 2026-06-13
domains: [skill, docs, omp, eval-kernel]
topics: [code-smells, skill-resolution, skill-protocol, hard-gate, audit-workflow]
related: [code-smells-audit-contract-hardening-plan-2026-06-13.md, code-smells-audit-skill-iteration-2026-06-13.md]
priority: medium
status: completed
subject: 2026-06-13.code-smells-audit-skill
artifacts: [skills/code-smells/SKILL.md]
---

# Code-Smells Skill — Docs Resolution Hard Gate

## Problem
Running the code-smells audit from a project where `code-smells` is not a *discovered* skill left the agent unable to find the `docs/` reference definitions. The user had to manually point at the buck-workflow checkout. Root cause: the skill referenced docs via `skill://code-smells/docs/<name>.md`, which only resolves when the skill is discovered by the session loader — and discovery is package/roots-based (`~/.{omp,pi,agents}/skills/`, `.agents/skills/`, registered packages), **not** cwd-based.

## Research findings (authoritative)
- **`skill://<name>/<path>` resolves inside the skill's own directory** regardless of cwd — this IS the harness-blessed "relative to itself" mechanism (`omp://skills.md` → "Keep referenced assets under the same skill directory and access with `skill://<name>/...`"). Probed live: `skill://code-smells/docs/long-method.md` resolves.
- **No fallback search** is performed for missing skill assets; unknown skill → error.
- **Subagents inherit the session's discovered-skills list**, so once `skill://code-smells` resolves for the orchestrator it resolves for every category subagent too.
- **Eval-kernel `read` helper does NOT support protocol paths** (`skill://`, etc.) — raises `ValueError: Protocol paths are not supported by this helper`. Must use `tool.read({"path": ...})` for `skill://` probes. `tool.read` returns `{'text': ...}` on success, raises `RuntimeError` ("Unknown skill" / "File not found") on failure.

## Change
Added a **Step 0 hard gate** to `skills/code-smells/SKILL.md`:
1. Explicit override (`CODE_SMELLS_DOCS` abs path) → verify completeness.
2. Canonical: probe `skill://code-smells/docs/index.md` → set `DOCS`/`SKILL_BASE`.
3. **Hard stop** if neither resolves — abort, do not fan out, surface a remediation message (register the skill OR pass the path). No silent filesystem-search fallback.

Also: OMP starter cell self-gates (uses `tool.read`, raises `SystemExit` on failure); portable fallback inlines doc contents into each `task` (separate sessions can't be relied on to resolve `skill://`); `category_prompt` builds refs from resolved `DOCS`; report frontmatter gained `docs_source`; added a doc-resolution note covering both reference and audit modes.

## Verification
- Probed all three gate branches in the eval kernel: canonical → True; all 24 docs (index + 23 smells) reachable, zero missing; bad override → False; unknown skill → False.
- Confirmed `skill://code-smells/docs/<name>.md` resolves to the installed omp plugin path.

## Lesson
A skill's own bundled assets should be referenced via `skill://<name>/<path>` (resolves relative to the skill dir). Skills that fan out subagents over bundled reference docs MUST probe resolution as a hard gate first and stop loudly — never run a partial audit on missing definitions. In eval-kernel code, use `tool.read`, not the `read` helper, for `skill://` paths.
