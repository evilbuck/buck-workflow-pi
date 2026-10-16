# Model access uses workflow_state, not raw SQL or required paths

Normal model-facing durable access is one typed `workflow_state` surface: the native tool when it is registered, otherwise `bun skills/_shared/scripts/workflow-state-cli.ts`. The trusted runtime binds project, branch incarnation, and visibility from the checkout and machine config. Callers cannot pass project, branch, worktree, run, or published-revision scope. Artifacts are addressed by `{ subjectId, kind, logicalName, revision? }` or a `workflow-artifact:` token. A physical `.context` path is an optional repo-files projection, not a required input. `external-files`, `sqlite`, and `postgres` do not materialize a canonical `.context` mirror.

`inspect` names a branch and retains evidence. `recover` lists retained scopes and exports or rebinds only a selected scope. Publication administration is `publication-view`, `map-checkpoint`, `revoke-mapping`, and `resolve-publication`. Restricted stages cannot call those operations. `migrate` is CLI-only. Publication policy is [ADR 0005](0005-versioned-integration-view.md). `sql_memory` is not registered. In `/buck-loop`, `SQL_MEMORY_URL` only gates whether save requires a verified store receipt; the supervisor does not open that variable as a pool, and it does not select the adapter.

Supervisor save writes and corrections go through `workflow_state`. A rows receipt lists the revision ids those calls return. A no-fact receipt has an empty id list only when the attempt has no reusable fact. Receipt completion is not a follow-up memory SELECT.

## Considered Options

- Keep model-facing `sql_memory` and required physical paths: rejected. Callers could widen scope, construct SQL, and treat a projection as identity.
- Leave both surfaces registered during cutover: rejected for the model-facing tool. A second recall path bypasses the branch overlay. Remaining consumers still move separately; they do not keep a registered raw-SQL tool.
- Let children pass project or visibility arguments: rejected. Scope is a trusted binding, not a caller parameter.

## Consequences

- Stage roles are `read`, `write`, `save`, and `admin`. Restricted children get a baked role and `workflow_state`, never `sql_memory`.
- Repo-files immutable manifests live under the machine identity registry at `${XDG_CONFIG_HOME:-~/.config}/buck-workflow/projects/<project-id>/repo-manifest`, beside `branch-identity.json`. Only editable bodies belong in `.context/`.
- `workflow_exec` is the Linux command boundary (Bubblewrap, fail closed, no host-shell fallback). Git metadata is read-only inside that command boundary except the commit checkpoint stage. Host file tools do not yet enforce the same rule.
- PostgreSQL administration is `bun skills/_shared/scripts/workflow-state-cli.ts migrate`. Operator token reads are [Read a workflow artifact by token](../howto/read-workflow-artifact-by-token.md).
- Data movement between adapters is [ADR 0006](0006-offline-verified-storage-cutover.md), not `migrate` and not `SQL_MEMORY_URL`.
