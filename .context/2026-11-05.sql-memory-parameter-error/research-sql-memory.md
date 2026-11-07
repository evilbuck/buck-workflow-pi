---
status: active
date: 2026-11-05
subject: 2026-11-05.sql-memory-parameter-error
topics: [sql-memory, postgres, parameters, recall]
informs: []
---

# SQL memory parameter error

## Findings

`sql_memory` supports positional SQL parameters through the `values` argument. A live execution of the canonical two-parameter recall query using `values: [projectOrigin, searchText]` returned eight rows. `extensions/sql-memory/index.ts:14-19,112-131` defines `values` and passes it to PostgreSQL unchanged. No database or parameter substitution failure occurred in this correctly bound call.

The shared recall protocol (`skills/_shared/recall-project-memories.md:19-30`) gives SQL placeholders and describes their values but does not show a tool invocation or identify the `values` field. The rendered `xd://sql_memory` schema also omits the SQL operation's `statement` and `values` fields, although the runtime accepts them. The tool documentation defect was reported to the harness. Prior stored suggestions to inline literals or avoid positional parameters conflict with the successful live execution; do not follow them.

An absent or misnamed `values` array is a plausible explanation for the reported PostgreSQL error, but the original failing call was not captured. The error alone does not identify the caller or establish exactly how its arguments were lost. `extensions/sql-memory/notice.ts:43-45` formats SQL operation errors as the observed notice. `extensions/buck-loop/project-memory.ts:49-84` separately performs deterministic supervisor recall and explicitly binds both values; do not assume that path is at fault.

SQL errors other than missing column and UUID cast fall through `failureFix`/`fixForSqlError` (`extensions/sql-memory/index.ts:163-190`) to generic column-card or remember advice (`extensions/sql-memory/columns.ts:117-118`), rather than explaining a missing binding.

## Recommended next step

Capture the failing `sql_memory` call's operation, statement and parameter-field names (redact values) to establish the actual path. For a bounded fix: document and exemplify `{op: "sql", statement: "… $1 … $2 …", values: [projectOrigin, searchText]}` in the shared protocol and tool description; provide actionable parameter-error feedback and regression coverage through the real tool surface. Investigate the harness schema rendering separately. Do not interpolate user input into SQL.

Exploration only: no application code or tests changed. The original failed request was unavailable, so its exact cause and frequency remain unverified.
