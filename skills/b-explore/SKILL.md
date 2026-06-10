---
name: b-explore
description: Explore unfamiliar codebases, trace architecture, map data flows, and capture findings to .context/ without changing the codebase. Use when investigating internal code structure before planning.
---

# b-explore: Codebase Exploration Agent

Investigate unfamiliar code, trace flows, map architecture, and capture findings without changing the codebase. This is the **internal investigation** command — for external/web research, use `b-research`.

## When to Use

- You need to understand unfamiliar code before planning
- Tracing data flow, dependency graphs, or call chains
- Mapping architecture and module boundaries
- Discovering entry points, config, and conventions
- Evaluating blast radius before a refactor

## Write Boundary

- You may write only to `.context/**` and temporary scratch locations.
- Use `.context/` for durable notes the user should keep.
- Do not modify application code, config, CI, infra, or tests.

## Subject Folder Creation (Required)

**Every b-explore session creates a subject folder.** This is not opt-in.

1. **Infer subject name** from the exploration topic (kebab-case)
2. **Create dated folder**: `.context/YYYY-MM-DD.<subject-name>/`
3. **Create `research/` subdirectory** inside the subject folder for rolling notes.
4. **Write exploration file inside**: `research-<topic>.md` (keeps the canonical summary artifact name for compatibility)
5. **Create `index.md`** with `status: draft` as the stable entrypoint linking all artifacts.

**Example:**
```
.context/
└── 2026-04-08.auth-feature/
    ├── index.md
    ├── research/
    │   └── notes-oauth-providers.md   ← rolling exploration notes
    └── research-oauth-providers.md    ← canonical summary (consolidated)
```

## Subject Resolution

Follow the shared protocol at `skills/_shared/subject-resolution.md`.
If the protocol resolves a subject, use it for all downstream artifact discovery.
If the protocol finds no subject, proceed as a fresh session.

## Behavior

### Exploration Strategy

1. **Start broad**: Use code lookup tools for symbol search, outlines, and targeted retrieval over reading full files.
2. **Trace entry points**: Find main exports, route handlers, CLI entry points, or public API surfaces.
3. **Follow dependencies**: Map imports, callers, and data flow between modules.
4. **Identify patterns**: Note conventions, repeated structures, naming patterns, and architectural decisions.
5. **Capture risks**: Record unknowns, edge cases, technical debt, and areas that look fragile.

### Tool Usage

- Use symbol search and code outline tools to navigate efficiently.
- Prefer targeted reads over full-file reads when the codebase is large.
- Use GitNexus (when available) for dependency/caller analysis.
- For QMD usage, read `~/.agents/skills/qmd/SKILL.md` for proper command syntax and collection management.

### Write-Gate Protocol (Required)

**Write immediately. Do not hoard findings in context.** After each meaningful discovery — tracing a call chain, reading a module, identifying a pattern, or mapping a dependency — persist it to `.context/` before moving to the next step. A "meaningful discovery" is anything that would be lost if the session were interrupted at that point.

Cadence:
1. **Create rolling notes file immediately** after the subject folder: `research/notes-<topic>.md` in the subject root.
2. **After each code trace or file-group read**, append findings to the rolling notes file with a `### <what you traced>` heading. Include: files examined, key symbols, data flow observed, and questions raised.
3. **Every 3–5 findings**, or at any natural breakpoint (e.g., finished tracing a subsystem), consolidate the rolling notes into `research-<topic>.md` (the canonical summary). Update its frontmatter `status: active` and keep it current.
4. **Update `index.md`** after each consolidation so downstream consumers see a fresh entrypoint.

Do NOT wait until session end to write. The canonical summary should be readable and useful at any interruption point.


## Cross-Reference Stitching

When creating exploration findings:

1. **Set `informs: []`** — empty array to be populated later when plans/specs reference this research
2. **If you know what this exploration will inform**, you can pre-populate `informs:` with the expected plan/spec filename
3. **b-save will stitch links** when plans are created that reference this research


## Research Frontmatter Template

```yaml
---
status: active
date: YYYY-MM-DD
subject: YYYY-MM-DD.subject-name
topics: [keyword, list]
informs: []  # Plans or specs this exploration fed into (filled by b-plan or b-save)
---
```

## Output

```text
Summary
Key files and modules
Architecture / data flow
Risks / unknowns / open questions
Subject folder created: .context/YYYY-MM-DD.<subject>/
Research saved: research-<topic>.md
Recommended next step
```

## Recommended Next Steps

- `/b-plan` — turn findings into a bounded implementation plan
- `/b-research` — if external/web investigation is needed to fill gaps
- `/b-build` — if the exploration makes the path clear enough to skip planning
- `/b-build-hard` — if the path is clear but the work is complex or risky
