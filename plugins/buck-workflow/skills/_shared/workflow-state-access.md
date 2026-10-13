# Workflow state access

Durable Buck artifacts are addressed by an artifact reference, not by a required physical path.

Reference: `{ subjectId, kind, logicalName, revision? }` or token `workflow-artifact:<base64url>`.

Use the native `workflow_state` tool when it is registered. Otherwise use the shared CLI:

```bash
bun skills/_shared/scripts/workflow-state-cli.ts <op> [--subject <id>] [--branch <ref>] '<json>'
```

Operations: `read`, `list`, `search`, `write`, `correct`, `discover`, `inspect-lifecycle`, `transition`, `read-receipt`, `write-receipt`. `inspect` and `recover` name a local branch ref and retain evidence; restricted stages cannot call them. `migrate` is CLI-only administration.

Do not pass `projectId`, `branchId`, `publishedRevisionIds`, `worktreeId`, or `runId`. The trusted runtime binds project and visibility. Do not construct SQL. Do not call `sql_memory`. Do not copy canonical bodies into a hidden local file.

Repo-files may project `.context/<subject>/<logicalName>`. That path is an optional editable view, not an input. Other adapters must not materialize a canonical `.context` mirror.

Trusted context resolution keeps one origin/config snapshot for both identity and backend selection. Identity registration is a serialized machine-local transaction; an abandoned identity lock fails closed with a timeout and requires operator recovery. Named branches keep a stable workspace identity. A receipt run is bound to one branch, worktree, and attempt; a later attempt gets a new run, and another branch cannot read or resume the previous receipt.

Repo-files immutable manifests and revision blobs live under the machine identity registry's `projects/<project-id>/repo-manifest`, outside Git. Only editable bodies belong in `.context/`.

The standalone CLI is an operator/portable-agent executable. Ordinary lifecycle/correction/receipt operations use save permissions; only explicit inspect/recover use admin permissions. Token-only reads derive their subject from the token.

Nested Buck stages have native workflow_state, checkout-confined file tools, and Linux `workflow_exec` isolation. Host bash is not available. File tools resolve symlinks and refuse paths outside the checkout, including machine storage, identity, configuration, and credentials. Bubblewrap is required; absence or isolation failure fails closed. Execution sees the checkout and runtime dependencies but not machine storage/configuration, host credentials or network. Git metadata is read-only except for the commit checkpoint stage; the supervisor stages the declared checkpoint. Use native artifact operations inside nested stages, not the operator CLI. No caller-editable role/environment flag authorizes host storage access.
