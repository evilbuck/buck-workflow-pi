---
name: b-research
description: Investigate external sources, APIs, libraries, documentation, and web resources. Capture findings incrementally and synthesize into durable research artifacts in .context/. Use when you need information beyond the local codebase.
---

# b-research: External Research Agent

Investigate external sources — APIs, libraries, documentation, web resources, best practices, and competitive landscapes — and capture findings into durable, incrementally updated research artifacts. This is the **external investigation** command — for internal codebase exploration, use `b-explore`.

## When to Use

- Looking up library/framework APIs and usage patterns
- Researching solutions to unfamiliar problems
- Comparing approaches, tools, or services
- Understanding external dependencies, APIs, or services
- Verifying standards, best practices, or compatibility
- Any investigation that requires information beyond the local codebase

## When NOT to Use

- Tracing code flow within the project → use `/b-explore`
- Understanding internal architecture → use `/b-explore`
- Planning implementation steps → use `/b-plan`

## Write Boundary

- You may write only to `.context/**` and temporary scratch locations.
- Use `.context/` for durable notes the user should keep.
- Do not modify application code, config, CI, infra, or tests.

## Subject Folder Creation (Required)

**Every b-research session creates a subject folder.** This is not opt-in.

1. **Infer subject name** from the research topic (kebab-case)
2. **Create dated folder**: `.context/YYYY-MM-DD.<subject-name>/`
3. **Create `index.md`** as the stable entrypoint linking all artifacts
4. **Write incremental notes** in a subject-local `research/` subdirectory as you gather information
5. **Consolidate into `research-<topic>.md`** in the subject root as the canonical summary artifact

**Example:**
```
.context/
└── 2026-04-08.oauth-research/
    ├── index.md
    ├── research/
    │   ├── notes-providers.md
    │   └── sources-oauth.md
    └── research-oauth-providers.md    ← canonical summary
```

## Artifact Model

### Canonical Summary (Required)

`research-<topic>.md` in the subject root is the canonical artifact that other Buck commands consume. It must exist by the end of the session and contain a synthesized summary of findings.

### Incremental Notes (Optional but Recommended)

During long research sessions, write rolling notes and source captures in a `research/` subdirectory:

- `research/notes-<topic>.md` — running notes, observations, intermediate conclusions
- `research/sources-<topic>.md` — URLs, citations, and key quotes from sources

This prevents loss if the session is interrupted and makes it easy to trace where conclusions came from.

### Subject Entrypoint (Required)

`index.md` in the subject root links all artifacts and provides a fast navigation point for downstream commands.

## Behavior

### Research Strategy

1. **Clarify the question**: Understand what specific information is needed. If ambiguous, ask one targeted question before diving in.
2. **Select sources**: Choose the most authoritative sources first (official docs, source code, standards bodies) before secondary sources (blogs, forums, StackOverflow).
3. **Search systematically**: Use multiple queries with varied phrasing for broader coverage.
4. **Capture as you go**: Write findings to incremental notes immediately — don't batch until the end.
5. **Evaluate evidence**: Note confidence levels, contradictions between sources, and recency.
6. **Synthesize**: Consolidate incremental notes into the canonical `research-<topic>.md` summary.

### Source Selection

Use the **Research Source Dictionary** (`docs/research-source-dictionary.md`) to select appropriate sources for the topic. It maps source types to when they're useful, access methods, confidence levels, and caveats.

Workflow:
1. Match the research topic against the dictionary's "Best for" tags
2. Select 2-4 source types most likely to yield authoritative results
3. Start with highest-confidence sources, then broaden if needed
4. Record which sources were consulted in the research output

### Tool Usage

- **Web search**: Use available web search tools for documentation, APIs, and solutions.
- **Fetch content**: Use URL fetching tools to read full pages when search snippets are insufficient.
- **Crawl4AI**: For deep website crawling or bulk extraction, invoke the `crawl4ai` skill. See `skills/crawl4ai/SKILL.md` for install/bootstrap guidance and usage patterns.
- **Code search**: Use code search tools for library source code and implementation examples.
- **Local docs**: Check local project docs and README files first — they may already contain the answer.

### Incremental Research Behavior

During a long research pass:

1. **Create/update `index.md`** with current state and links to notes
2. **Append/update rolling notes** in `research/notes-<topic>.md`
3. **Track sources** in `research/sources-<topic>.md` with URLs and key quotes
4. **Keep the assessment section current** in the canonical summary as evidence changes
5. **Finish by consolidating** incremental notes into the final `research-<topic>.md`

### Graceful Degradation

If web access tools are unavailable:

- Note the limitation in the research output
- Work with locally available documentation and READMEs
- Capture what can be determined and flag open questions requiring web access
- The session is still valuable — it structures the investigation and identifies what's unknown

## Cross-Reference Stitching

When creating research:

1. **Set `informs: []`** — empty array to be populated later when plans/specs reference this research
2. **If you know what this research will inform**, pre-populate `informs:` with the expected plan/spec filename
3. **b-save will stitch links** when plans are created that reference this research

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
Key findings
Sources consulted (with types from source dictionary)
Recommendations / conclusions
Open questions
Subject folder created: .context/YYYY-MM-DD.<subject>/
Research saved: research-<topic>.md
Recommended next step
```

## Recommended Next Steps

- `/b-plan` — turn findings into a bounded implementation plan
- `/b-explore` — if internal codebase investigation is needed to complement external research
- `/b-build` — if the research makes the path clear enough to skip planning
- `/b-build-hard` — if the path is clear but the work is complex or risky
