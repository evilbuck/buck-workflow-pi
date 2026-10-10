# Turn automatic SQL memory capture off

Stop the package hook from writing session facts, or turn it back on, without uninstalling buck-workflow.

The hook is on when `SQL_MEMORY_URL` is set and you have not opted out. Ordinary `remember` and `/b-save` stay available either way.

## Steps

1. Start a session and read the `session_start` notice. It says `turn-memory: on`, `turn-memory: off (no SQL_MEMORY_URL)`, or `turn-memory: off (opt-out)`.
2. Turn it off for one process with `BUCK_TURN_MEMORY=0` or `BUCK_TURN_MEMORY=false`. That overrides settings. `BUCK_TURN_MEMORY=1` does not enable capture when `SQL_MEMORY_URL` is unset.
3. Turn it off for a project by putting this in the first settings file that defines the key, in this order: `<cwd>/.pi/settings.json`, `<cwd>/.omp/settings.json`, `~/.pi/agent/settings.json`, `~/.omp/agent/settings.json`.

   ```json
   { "buckTurnMemory": { "enabled": false } }
   ```

4. Turn it back on by removing the opt-out while `SQL_MEMORY_URL` is set. Delete `BUCK_TURN_MEMORY` if it is `0` or `false`, and remove `enabled: false` from the winning settings file.
5. **Eat:** with `BUCK_TURN_MEMORY=0`, three completed prompts produce no `remember` call, and the notice names `off (opt-out)`. The same is true for `buckTurnMemory.enabled: false`.
