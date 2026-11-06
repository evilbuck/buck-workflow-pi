# Read a workflow artifact by token

Read one durable artifact through the shared CLI when native `workflow_state` is not in the session. The token is the address. A `.context/` path is not required.

## Steps

1. From the project checkout, take the `workflow-artifact:` token returned by a successful write. Do not put `projectId`, `branchId`, `worktreeId`, `runId`, or `publishedRevisionIds` in the JSON.
2. Read it:

   ```bash
   bun skills/_shared/scripts/workflow-state-cli.ts read '{"token":"workflow-artifact:TOKEN"}'
   ```

3. **Eat:** stdout is JSON whose `text` is the artifact body and whose `revision` matches the write. The process exits 0. A missing artifact prints `null` and exits 1.

Do not use this command to name another project. `inspect` and `recover` are separate operator operations and are not available to restricted stages. Why the token is the address: [ADR 0004](../adr/0004-workflow-state-trusted-access.md).
