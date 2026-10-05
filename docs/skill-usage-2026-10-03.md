---
date: 2026-10-03
status: completed
---

# OMP skill usage snapshot — October 3, 2026

Use this saved snapshot to compare skill invocation frequency and maintenance priorities without rescanning session transcripts. Machine-readable counts and both complete rankings are in [skill-usage-2026-10-03.json](skill-usage-2026-10-03.json).

## Top five by explicit recorded invocations

| Rank | Skill | Invocations | Invoking parent sessions |
|---|---|---:|---:|
| 1 | `b-review` | 50 | 48 |
| 2 | `b-save` | 44 | 43 |
| 3 | `b-build` | 42 | 39 |
| 4 | `git-commit` | 39 | 35 |
| 5 | `b-plan` | 38 | 37 |

The primary ranking counts explicit requests, including expanded slash-command prompts and recognized historical equivalents. It does **not** rank arbitrary mentions or skill-file reads as invocations. Ties are ordered by invoking parent sessions, then skill identifier.

## Window and coverage

- Requested window: **April 3–October 3, 2026**, America/New_York. Exact inclusive UTC bounds: `2026-04-03T04:00:00Z` to `2026-10-04T02:27:24Z`. Message timestamps determine inclusion, not file modification dates.
- Earliest available record: **May 31, 2026**, `2026-05-31T23:45:53Z`. The archive does not cover the first part of the requested six months.
- Source: `~/.omp/agent/sessions/`, across all project directories, not only this repository.
- Enumerated **1,197 JSONL transcripts** and scanned **179,597 lines**. After excluding this analysis and its advisor: **1,195 included transcripts**, comprising **621 top-level sessions** and **574 subagent transcripts**, across **60 project directories**.
- Observed **166 skill identifiers**. The full inventory below adds the current repository skill with no evidence, for **167 rows**, covering all **64 current repository skills**. Shared resources are not ranked as a skill.
- Recorded **370 explicit invocations** and **1,461 successful skill-read records**.
- One malformed Unicode tool-result line was skipped. It contained no skill path and was not an invocation record.
- Generated: `2026-10-04T02:45:41Z`. This is a frozen snapshot; later sessions are not included.

## Metric definitions

| Metric | Meaning |
|---|---|
| Invocations | Explicit recorded request or command expansion. Repeated requests count separately; successful completion is not implied. |
| Invocation sessions | Distinct parent sessions containing at least one explicit request. |
| Skill reads | Successful tool-result records identifying a skill root or `SKILL.md`. Repeated reads count separately. Includes inspection of skill definitions. |
| Any-use sessions | Distinct parent sessions containing either an explicit invocation or a successful read. Each skill counts at most once per parent session. |
| Current repo | Present in this repository's skill inventory at analysis time; not a historical installation inventory. |

Subagent use is folded into the parent session for both session metrics. Transcript records are deduplicated by message ID, timestamp and skill; no duplicate invocation or read records were found. A command expansion followed by a read is one invocation plus one read, not two invocations.

## Counting method

1. Enumerate JSONL transcripts recursively, including subagent logs. Detect truncated glob results and partition directory queries until every returned slice is complete.
2. Decode each line with the real **jq 1.8.2** binary. Keep string and array user content, filter on record timestamps, and track malformed lines. Raw transcripts are streamed, not slurped.
3. Recognize explicit invocations through these recorded forms:
   - Native `custom_message` events with `customType: skill-prompt`, user attribution and a named skill.
   - Expanded prompt wrappers beginning with a command heading and containing an explicit `Load and follow the ... skill` directive.
   - Recognized historical full `b-save` and Conventional Commits prompt bodies.
   - Leading slash commands for known skill identifiers and explicit leading `Load and follow skill://...` requests.
4. Recognize successful loads only from read/eval tool results with skill-root read metadata or a skill-file header. Ignore assistant prose, advertised skill catalogs, quoted session updates and incidental name/path mentions.
5. Normalize `b-commit` → `git-commit`, `b-commit-improved` → `git-commit-improved`, and `b-build-hard` → `b-build`. Historical commit/save prompt bodies are attributed to the equivalent current skill. Other observed identifiers are preserved.
6. Exclude the analysis parent session and its advisor. Aggregate explicit invocations and successful reads separately; compute the alternative distinct-parent-session ranking.

### Evidence source totals

| Recorded form | Records |
|---|---:|
| `expanded-prompt` | 208 |
| `explicit-load-request` | 2 |
| `legacy-b-save-prompt` | 23 |
| `legacy-git-commit-prompt` | 2 |
| `skill-prompt` | 130 |
| `skill-read` | 1461 |
| `slash-command` | 5 |

## Full ranked inventory

Sorted by explicit invocations descending, invocation sessions descending, then skill identifier. Read-only skills therefore appear below skills with explicit invocation evidence, even when their session footprint is larger.

| Rank | Skill | Invocations | Invocation sessions | Skill reads | Any-use sessions | Current repo |
|---|---|---:|---:|---:|---:|---|
| 1 | `b-review` | 50 | 48 | 107 | 86 | yes |
| 2 | `b-save` | 44 | 43 | 83 | 78 | yes |
| 3 | `b-build` | 42 | 39 | 79 | 75 | yes |
| 4 | `git-commit` | 39 | 35 | 61 | 67 | yes |
| 5 | `b-plan` | 38 | 37 | 118 | 87 | yes |
| 6 | `fix-pr` | 26 | 24 | 48 | 35 | yes |
| 7 | `b-phase` | 22 | 22 | 66 | 42 | yes |
| 8 | `b-iterate` | 22 | 21 | 31 | 37 | yes |
| 9 | `b-brainstorm` | 7 | 7 | 26 | 18 | yes |
| 10 | `b-init-guardrails` | 6 | 6 | 26 | 16 | yes |
| 11 | `b-recap` | 6 | 6 | 12 | 10 | yes |
| 12 | `github-story-breakdown` | 5 | 5 | 13 | 9 | no |
| 13 | `b-auto-fix` | 4 | 4 | 12 | 9 | yes |
| 14 | `b-blueprint` | 4 | 4 | 2 | 5 | yes |
| 15 | `b-docs` | 4 | 4 | 13 | 11 | yes |
| 16 | `b-pr-review-2-issues` | 4 | 4 | 5 | 6 | yes |
| 17 | `git-commit-improved` | 4 | 4 | 11 | 11 | yes |
| 18 | `requirements-refiner` | 4 | 4 | 16 | 7 | no |
| 19 | `b-grill-me` | 3 | 3 | 16 | 7 | yes |
| 20 | `b-research` | 3 | 3 | 20 | 18 | yes |
| 21 | `improve-codebase-architecture` | 3 | 3 | 2 | 4 | no |
| 22 | `b-arch-qa` | 2 | 2 | 5 | 5 | yes |
| 23 | `b-explore` | 2 | 2 | 12 | 11 | yes |
| 24 | `b-guardrails-check` | 2 | 2 | 50 | 37 | yes |
| 25 | `b-pr` | 2 | 2 | 13 | 11 | yes |
| 26 | `b-writer` | 2 | 2 | 0 | 2 | no |
| 27 | `deep-research` | 2 | 2 | 0 | 2 | no |
| 28 | `github-issue-prioritizer` | 2 | 2 | 5 | 4 | no |
| 29 | `seo-plan` | 2 | 2 | 0 | 2 | no |
| 30 | `typesafe-ai` | 2 | 2 | 10 | 9 | no |
| 31 | `accessibility` | 1 | 1 | 1 | 2 | no |
| 32 | `b-diagnose` | 1 | 1 | 6 | 6 | yes |
| 33 | `b-grill-with-docs` | 1 | 1 | 9 | 6 | yes |
| 34 | `b-issue-create` | 1 | 1 | 4 | 4 | yes |
| 35 | `b-plan-update` | 1 | 1 | 4 | 4 | yes |
| 36 | `code-review` | 1 | 1 | 14 | 12 | yes |
| 37 | `code-smells` | 1 | 1 | 41 | 19 | yes |
| 38 | `git-clean-orphans` | 1 | 1 | 4 | 4 | yes |
| 39 | `intake` | 1 | 1 | 0 | 1 | no |
| 40 | `omp-eval-helpers` | 1 | 1 | 6 | 7 | no |
| 41 | `pi-to-omp-convert` | 1 | 1 | 1 | 1 | no |
| 42 | `thought-dump-writer` | 1 | 1 | 4 | 3 | yes |
| 43 | `agent-browser` | 0 | 0 | 2 | 2 | no |
| 44 | `architecture-sync` | 0 | 0 | 1 | 1 | no |
| 45 | `b-backlog` | 0 | 0 | 7 | 6 | yes |
| 46 | `b-capture` | 0 | 0 | 6 | 3 | yes |
| 47 | `b-create-styleguide` | 0 | 0 | 2 | 1 | yes |
| 48 | `b-create-ux-guide` | 0 | 0 | 2 | 1 | yes |
| 49 | `b-eval-upstream-prs` | 0 | 0 | 4 | 2 | yes |
| 50 | `b-fix-rebase-conflict` | 0 | 0 | 9 | 9 | yes |
| 51 | `b-grill` | 0 | 0 | 9 | 5 | yes |
| 52 | `b-grill-auto` | 0 | 0 | 6 | 4 | yes |
| 53 | `b-handoff` | 0 | 0 | 2 | 1 | yes |
| 54 | `b-hindsight-import-projects` | 0 | 0 | 3 | 2 | yes |
| 55 | `b-howto` | 0 | 0 | 6 | 5 | yes |
| 56 | `b-init-factory` | 0 | 0 | 1 | 1 | yes |
| 57 | `b-init-tracker` | 0 | 0 | 3 | 2 | yes |
| 58 | `b-loop` | 0 | 0 | 17 | 11 | no |
| 59 | `b-memory-import` | 0 | 0 | 10 | 6 | yes |
| 60 | `b-nasa-prd` | 0 | 0 | 1 | 1 | yes |
| 61 | `b-present` | 0 | 0 | 3 | 2 | yes |
| 62 | `b-save-improved` | 0 | 0 | 17 | 9 | yes |
| 63 | `b-triage` | 0 | 0 | 4 | 3 | yes |
| 64 | `b-wizard` | 0 | 0 | 1 | 1 | yes |
| 65 | `best-practices` | 0 | 0 | 2 | 2 | no |
| 66 | `blacksmith-e2e-watch` | 0 | 0 | 1 | 1 | no |
| 67 | `btw` | 0 | 0 | 3 | 3 | no |
| 68 | `buck-loop-commit-refusal` | 0 | 0 | 4 | 3 | no |
| 69 | `buck-loop-premature-done-closeout` | 0 | 0 | 2 | 2 | no |
| 70 | `buck-loop-sql-memory-stage-failure` | 0 | 0 | 3 | 2 | no |
| 71 | `buck-workflow-pi-add-skill` | 0 | 0 | 2 | 2 | no |
| 72 | `bun-hono-daisyui-tailwind-v4` | 0 | 0 | 1 | 1 | no |
| 73 | `caddy-docker-static-projects-server` | 0 | 0 | 1 | 1 | no |
| 74 | `chezmoi` | 0 | 0 | 6 | 6 | no |
| 75 | `chrome-extensions` | 0 | 0 | 2 | 2 | no |
| 76 | `code-review-universal` | 0 | 0 | 24 | 20 | yes |
| 77 | `codebase-design` | 0 | 0 | 3 | 2 | yes |
| 78 | `commit` | 0 | 0 | 2 | 2 | no |
| 79 | `crawl4ai` | 0 | 0 | 3 | 2 | yes |
| 80 | `create-skill` | 0 | 0 | 6 | 6 | no |
| 81 | `cross-platform-pi-omp-loading` | 0 | 0 | 12 | 10 | yes |
| 82 | `cross-platform-pi-omp-loading/slash-command-mirror` | 0 | 0 | 5 | 4 | no |
| 83 | `defuddle` | 0 | 0 | 1 | 1 | no |
| 84 | `deprecated-b-save` | 0 | 0 | 2 | 2 | no |
| 85 | `design-brief` | 0 | 0 | 2 | 1 | yes |
| 86 | `diagnose` | 0 | 0 | 12 | 12 | no |
| 87 | `diagnose-crash` | 0 | 0 | 3 | 3 | no |
| 88 | `diagnose-failed-buck-loop-call` | 0 | 0 | 3 | 2 | no |
| 89 | `diagnose-stuck-buck-loop` | 0 | 0 | 5 | 5 | no |
| 90 | `duck-grill` | 0 | 0 | 1 | 1 | no |
| 91 | `employ-assess` | 0 | 0 | 5 | 1 | no |
| 92 | `employ-critique` | 0 | 0 | 3 | 1 | no |
| 93 | `employ-customer-reply` | 0 | 0 | 7 | 2 | no |
| 94 | `employ-implement` | 0 | 0 | 7 | 1 | no |
| 95 | `employ-intake` | 0 | 0 | 7 | 2 | no |
| 96 | `employ-investigate` | 0 | 0 | 13 | 1 | no |
| 97 | `employ-onboard` | 0 | 0 | 3 | 1 | no |
| 98 | `employ-ops` | 0 | 0 | 8 | 1 | no |
| 99 | `employ-plan` | 0 | 0 | 4 | 1 | no |
| 100 | `employ-reopen-rate` | 0 | 0 | 4 | 1 | no |
| 101 | `employ-review` | 0 | 0 | 5 | 1 | no |
| 102 | `employ-scope` | 0 | 0 | 4 | 2 | no |
| 103 | `employ-triage` | 0 | 0 | 9 | 2 | no |
| 104 | `fail-closed-pagination-loops` | 0 | 0 | 1 | 1 | no |
| 105 | `find-omp-session` | 0 | 0 | 1 | 1 | no |
| 106 | `find-skills` | 0 | 0 | 3 | 3 | no |
| 107 | `flux-drip-loop-orchestrator` | 0 | 0 | 1 | 1 | no |
| 108 | `flux-drip-occupancy-flag` | 0 | 0 | 1 | 1 | no |
| 109 | `forensics` | 0 | 0 | 2 | 2 | no |
| 110 | `frontend-design` | 0 | 0 | 7 | 7 | no |
| 111 | `gh-pr-merge-squash-bookkeeping` | 0 | 0 | 1 | 1 | no |
| 112 | `grill-me` | 0 | 0 | 2 | 2 | no |
| 113 | `herdr` | 0 | 0 | 8 | 7 | no |
| 114 | `hindsight-http-api` | 0 | 0 | 1 | 1 | no |
| 115 | `image-generation` | 0 | 0 | 1 | 1 | no |
| 116 | `intake-skill` | 0 | 0 | 6 | 3 | no |
| 117 | `jev-typesafe-choice-schema` | 0 | 0 | 10 | 9 | no |
| 118 | `llm-wiki-vault` | 0 | 0 | 8 | 6 | yes |
| 119 | `make-interfaces-feel-better` | 0 | 0 | 3 | 3 | no |
| 120 | `manage-herdr-panes` | 0 | 0 | 9 | 7 | yes |
| 121 | `monitor-buck-loop` | 0 | 0 | 3 | 3 | no |
| 122 | `node5-code-review` | 0 | 0 | 2 | 1 | yes |
| 123 | `obsidian-cli` | 0 | 0 | 6 | 4 | no |
| 124 | `obsidian-markdown` | 0 | 0 | 6 | 4 | no |
| 125 | `obsidian-research-subagent` | 0 | 0 | 2 | 2 | no |
| 126 | `omarchy` | 0 | 0 | 5 | 5 | no |
| 127 | `omp-hashline-edits` | 0 | 0 | 4 | 3 | no |
| 128 | `pi-ralph-wiggum` | 0 | 0 | 1 | 1 | no |
| 129 | `pi-rpc` | 0 | 0 | 2 | 2 | yes |
| 130 | `plan-synopsis` | 0 | 0 | 0 | 0 | yes |
| 131 | `pm-story-groomer` | 0 | 0 | 1 | 1 | no |
| 132 | `pr` | 0 | 0 | 4 | 3 | no |
| 133 | `pr-review` | 0 | 0 | 1 | 1 | no |
| 134 | `pr-watch` | 0 | 0 | 2 | 1 | no |
| 135 | `product-tour` | 0 | 0 | 2 | 1 | yes |
| 136 | `profile-pr-screenshots` | 0 | 0 | 1 | 1 | no |
| 137 | `project-researcher` | 0 | 0 | 1 | 1 | no |
| 138 | `prototype` | 0 | 0 | 1 | 1 | no |
| 139 | `qmd` | 0 | 0 | 10 | 10 | no |
| 140 | `rails-app` | 0 | 0 | 5 | 4 | yes |
| 141 | `rebase-merge-stale-pr` | 0 | 0 | 1 | 1 | no |
| 142 | `rebase-onto-current-master` | 0 | 0 | 1 | 1 | no |
| 143 | `recover-blocked-buck-loop-run` | 0 | 0 | 3 | 3 | no |
| 144 | `review` | 0 | 0 | 3 | 3 | no |
| 145 | `run-in-idle-pane` | 0 | 0 | 6 | 6 | yes |
| 146 | `security-audit` | 0 | 0 | 3 | 1 | no |
| 147 | `simple-review` | 0 | 0 | 2 | 2 | no |
| 148 | `skill-explainer` | 0 | 0 | 2 | 1 | yes |
| 149 | `spec-progress` | 0 | 0 | 1 | 1 | no |
| 150 | `tailwind` | 0 | 0 | 1 | 1 | no |
| 151 | `tdd` | 0 | 0 | 4 | 4 | no |
| 152 | `tmux-dev-server` | 0 | 0 | 9 | 3 | no |
| 153 | `tmux-sudo` | 0 | 0 | 5 | 5 | no |
| 154 | `to-issues` | 0 | 0 | 1 | 1 | no |
| 155 | `tui-over-ssh-diagnose` | 0 | 0 | 1 | 1 | no |
| 156 | `tutorial-path` | 0 | 0 | 2 | 2 | no |
| 157 | `userinterface-wiki` | 0 | 0 | 2 | 2 | no |
| 158 | `validate-a-plan` | 0 | 0 | 1 | 1 | no |
| 159 | `verify-before-complete` | 0 | 0 | 9 | 9 | no |
| 160 | `verify-doc-snippets` | 0 | 0 | 1 | 1 | no |
| 161 | `web-design` | 0 | 0 | 2 | 2 | no |
| 162 | `web-design-guidelines` | 0 | 0 | 2 | 2 | no |
| 163 | `web-images` | 0 | 0 | 1 | 1 | no |
| 164 | `web-quality-audit` | 0 | 0 | 1 | 1 | no |
| 165 | `write-a-skill` | 0 | 0 | 3 | 3 | no |
| 166 | `write-docs` | 0 | 0 | 1 | 1 | no |
| 167 | `writing-for-agents` | 0 | 0 | 7 | 6 | yes |

## Alternative: session-based usage

This counts each skill once per parent session whenever it was invoked **or read**. It captures automatically loaded skills without letting repeated reads or subagents dominate the ranking, but it also includes skill audits. Ties use explicit invocation count, then skill identifier. The JSON contains the complete alternative ranking.

| Rank | Skill | Any-use sessions | Invocations | Skill reads |
|---|---|---:|---:|---:|
| 1 | `b-plan` | 87 | 38 | 118 |
| 2 | `b-review` | 86 | 50 | 107 |
| 3 | `b-save` | 78 | 44 | 83 |
| 4 | `b-build` | 75 | 42 | 79 |
| 5 | `git-commit` | 67 | 39 | 61 |
| 6 | `b-phase` | 42 | 22 | 66 |
| 7 | `b-iterate` | 37 | 22 | 31 |
| 8 | `b-guardrails-check` | 37 | 2 | 50 |
| 9 | `fix-pr` | 35 | 26 | 48 |
| 10 | `code-review-universal` | 20 | 0 | 24 |

## Reuse the saved data

The JSON `ranking` array contains all 167 rows in invocation order; `session_ranking` contains the same inventory in session order. Each row includes repository membership, invocation/read session counts, top-level versus subagent invocation counts, evidence-source breakdown and first/last observed timestamps. Neither array requires access to raw transcripts.

These commands read only the saved JSON snapshot. Use the tested absolute jq path to avoid a shell builtin with the same name.

```bash
JQ=/home/buckleyrobinson/.local/share/mise/installs/jq/1.8.2/jq

# Top five explicit invocation counts
"$JQ" '.ranking[:5] | .[] | {skill, invocations, invocation_sessions}' docs/skill-usage-2026-10-03.json

# Current repository skills, including zero counts
"$JQ" '.ranking | map(select(.current_repository))' docs/skill-usage-2026-10-03.json

# Top ten by distinct parent sessions with invocation or load evidence
"$JQ" '.session_ranking[:10] | .[] | {skill, sessions, invocations, skill_reads}' docs/skill-usage-2026-10-03.json
```

## Limitations and interpretation

- The requested six-month window begins April 3, but the available source logs begin May 31, 2026. No earlier usage can be inferred.
- Invocation recognition is conservative and measures recorded explicit requests, not every natural-language request or autonomous workflow-stage execution. Automatic command handling can leave no explicit invocation event.
- Successful skill reads include auditing and editing skill definitions. A positive read count alone does not establish actual execution; zero explicit invocations does not establish that a skill is unused.
- The inventory covers every observed skill identifier and all 64 current repository skills, not a complete historical inventory of every installed global skill.
- One malformed JSON line was skipped: a tool-result record with an invalid Unicode surrogate pair and no skill path. It is not a user or skill-prompt invocation.
- This analysis session and its advisor transcript were excluded. Raw prompts, project paths, tool payloads and private transcript contents are not included in the saved aggregates.

`plan-synopsis` has no recognized invocation or read evidence in this snapshot. That is not sufficient evidence to remove it.

Verification: aggregate totals reconcile with all 167 rows; skill identifiers are unique; source totals reconcile; invocation/session/read invariants and rank ordering pass jq assertions. Saved-data query examples were exercised. No project source code was changed; deterministic project checks are skipped for this documentation-only investigation.
