# Research Notes: OMP `eval` Tool & `workflow` Mode (Python vs JS/TS)

### Source 1: Installed OMP `eval` Tool Schema & Backends (`src/tools/eval.ts`, `src/eval/settings.ts`)
- **Consulted**: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/tools/eval.ts` and `src/eval/settings.ts`.
- **Key Findings**:
  - `eval` is a unified tool supporting `language: "py" | "js"` (`"py": Python`, `"js": Bun`).
  - Controlled by `eval.py` (env `PI_PY`, default `true`) and `eval.js` (env `PI_JS`, default `true`).
  - Both support standalone `%load <path>` to execute a `.py`, `.js`, or `.ts` file without echoing the file's source into the transcript.
  - In OMP 18.21.0 / 18.22.0, `src/modes/magic-keywords.ts:124-131` registers the `workflow` notice under `word: "workflowz"`, injecting `src/prompts/system/workflow-notice.md` which gives both Python and JS `workpool()` / `agent()` / `judge()` / `judgeBatch()` templates.
- **Confidence**: High (verified from installed source + binary).

### Source 2: TypeScript Support in `"js"` Eval Backend (`src/eval/js/shared/rewrite-imports.ts`, `local-module-loader.ts`)
- **Consulted**: `src/eval/js/shared/rewrite-imports.ts` and `src/eval/js/shared/local-module-loader.ts`.
- **Key Findings**:
  - Inline `"js"` cells parse with `@babel/parser` (`plugins: ["typescript"]`) and strip TypeScript syntax via `new Bun.Transpiler({ loader: "ts" })`.
  - Top-level `const`/`let`/`class` declarations are demoted so state persists across cells inside the isolated Bun subprocess (`omp __omp_worker_js_eval_process`).
  - `LocalModuleLoader` supports `.js`, `.jsx`, `.mjs`, `.ts`, `.tsx`, and `.mts`, transpiling `.ts` imports on the fly and invalidating cached modules when `mtimeMs` changes.
- **Confidence**: High (verified in source and live execution).

### Source 3: Prelude Capabilities (`src/eval/py/prelude.py`, `src/eval/js/shared/prelude.txt`, `src/eval/*-bridge.ts`)
- **Consulted**: `src/eval/py/prelude.py` (1,204 lines), `src/eval/js/shared/prelude.txt` (811 lines), `src/eval/agent-bridge.ts`, `src/eval/judgment-bridge.ts`, `src/eval/judgment-batch-bridge.ts`, `src/task/structured-subagent.ts`.
- **Key Findings**:
  - Both `"py"` and `"js"` expose the exact same host bridge capabilities:
    - `agent(prompt, { agent, label, schema, schemaMode, isolated, apply, merge, tools, model })`
    - `workpool(agent, { name, context, tools, model })`
    - `wait(handles, { timeout, raiseErrors })`
    - `completion(prompt, { model, system, schema })`
    - `judge(state, questions, { images })` and `judge_batch` / `judgeBatch(states, questions, { concurrency, retries, minOk, intent, images })`
    - `@tool` / `tool(fn, ...)` (defines kernel tools callable by spawned `agent()` subagents)
    - `tool.<name>(args)` (calls active session tools, including `workflow_state`)
    - `sh(cmd)` / ``sh`...` ``, `read()`, `write()`, `output()`, `phase()`, `log()`, `budget`.
  - `judge()` / `judgeBatch()` uses `resolveJudge()` (`src/judgment/index.ts`), enforcing the native-only tail rule (`textJudgeRoleChain`) so prompted chat models never stand in for a failed native judge (TypeSafe Jev), while recording usage to the session ledger.
- **Confidence**: High.

### Source 4: Live Validation against `omp` v18.22.0 Binary
- **Consulted**: Live execution of `/home/buckleyrobinson/.local/share/mise/installs/oh-my-pi/18.22.0/omp --smoke-test` and multi-cell IPC execution against `omp __omp_worker_js_eval_process`.
- **Key Findings**:
  - `omp --smoke-test` passes (`smoke-test: ok`).
  - Multi-cell TypeScript execution in `omp __omp_worker_js_eval_process` successfully imported `./extensions/buck-loop/machine.ts`, persisted state across cells, and dispatched `agent()`, `wait()`, and `judge()` over the host IPC protocol.
  - **Discovered bug in compiled `omp` 18.22.0 `LocalModuleLoader`**: `Bun.resolveSync(bareSpecifier, baseDir)` inside a `bun build --compile` binary searches `/$bunfs/root/` unless `BUN_BE_BUN=1` is set. Therefore, local `.ts` files that only import relative files or `node:*`/`bun` builtins (`machine.ts`, `state_machine/index.ts`, `types.ts`) import cleanly, whereas local `.ts` files with bare npm specifiers (`import { parse } from "yaml"` in `plan-acceptance.ts`) fail under `LocalModuleLoader` unless resolved via relative path `./node_modules/...` or run via `sh("bun ...")`.
- **Confidence**: High (reproduced and isolated root cause).
