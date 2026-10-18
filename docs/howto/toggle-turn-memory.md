# Turn automatic memory capture off

Stop the package hook from writing session facts, or turn it back on, without uninstalling buck-workflow.

Capture uses the [configured workflow backend](configure-storage-backend.md) and is on unless you opt out. `SQL_MEMORY_URL` does not enable or select this hook. Explicit `workflow_state` writes and `/b-save` remain available when automatic capture is off.

## Steps

1. Start an interactive or RPC session with the hook loaded and read its startup notice: `turn-memory: on` or `turn-memory: off (opt-out)`.
2. Turn it off for one process with `BUCK_TURN_MEMORY=0` or `BUCK_TURN_MEMORY=false`. This overrides settings. `BUCK_TURN_MEMORY=1` or `true` explicitly enables capture, even without `SQL_MEMORY_URL`.
3. Turn it off for a project by putting this in the first settings file that defines the key, in this order: `<cwd>/.pi/settings.json`, `<cwd>/.omp/settings.json`, `~/.pi/agent/settings.json`, `~/.omp/agent/settings.json`.

   ```json
   { "buckTurnMemory": { "enabled": false } }
   ```

4. Turn it back on by removing the effective opt-out, or use `BUCK_TURN_MEMORY=1` for one process. Delete a `0`/`false` environment override and remove `enabled: false` from the winning settings file when returning to the default.
5. **Eat:** with `BUCK_TURN_MEMORY=0`, completed prompts produce no automatic hook memory and the notice names `off (opt-out)`. With capture enabled, three completed prompts containing a durable decision can produce a saved-revision notice; verify that revision and its exact complete attempt-bound receipt on the selected backend.

Keep the live session running through that saved-revision acknowledgment.
A one-shot print process can consume a window and exit before asynchronous
capture finishes. A consumed marker or an `on` notice is not retention proof;
the native judgment, extraction and selected-store readback must succeed.
