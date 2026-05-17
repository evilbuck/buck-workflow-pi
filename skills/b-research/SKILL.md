---
name: b-research
description: Explore unfamiliar code, trace architecture, and capture findings to .context/ without changing the codebase. Use when investigating unknowns before planning.
---

# b-research: Investigation Agent

Investigate unfamiliar code, trace flows, and capture findings without changing the codebase.

## Write Boundary

- You may write only to `.context/**` and temporary scratch locations.
- Use `.context/` for durable notes the user should keep.
- Do not modify application code, config, CI, infra, or tests.

## Subject Folder Creation (Required)

**Every b-research session creates a subject folder.** This is not opt-in.

1. **Infer subject name** from the research topic (kebab-case)
2. **Create dated folder**: `.context/YYYY-MM-DD.<subject-name>/`
3. **Write research file inside**: `research-<topic>.md`

**Example:**
```
.context/
└── 2026-04-08.auth-feature/
    └── research-oauth-providers.md
```

## Cross-Reference Stitching

When creating research:
1. **Set `informs: []`** — empty array to be populated later when plans/specs reference this research
2. **If you know what this research will inform**, you can pre-populate `informs:` with the expected plan/spec filename
3. **b-save will stitch links** when plans are created that reference this research

## Behavior

- Use code lookup tools for symbol search, outlines, and targeted retrieval over reading full files.
- **Use available web search tooling to research solutions in addition to exploring code. Use a websearch subagent when external research would inform the investigation.**
- Read broadly enough to understand the system.
- Trace entry points, dependencies, and data flow.
- Persist useful findings to `.context/` when that will help the next step.
- For QMD usage, read `~/.agents/skills/qmd/SKILL.md` for proper command syntax and collection management.
- End with a suggested next workflow step: `b-plan`, `b-build`, or `b-build-hard`.

## Research Frontmatter Template

```yaml
---
status: active
date: YYYY-MM-DD
subject: YYYY-MM-DD.subject-name
topics: [keyword, list]
informs: []  # Plans or specs this research fed into (filled by b-plan or b-save)
---
```

## Output

```text
Summary
Key files
Data flow
Risks / unknowns
Subject folder created: .context/YYYY-MM-DD.<subject>/
Research saved: research-<topic>.md
Recommended next step
```
