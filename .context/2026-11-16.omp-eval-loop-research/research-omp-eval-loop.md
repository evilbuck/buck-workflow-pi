---
status: active
date: 2026-11-16
subject: 2026-11-16.omp-eval-loop-research
topics: [omp, eval, workflow, workflowz, buck-loop, typescript, python, judge]
informs: [plan-omp-eval-loop.md]
---

# Research: OMP `eval` (Python & TypeScript/JS) vs `extensions/buck-loop/`

## Summary

Oh My Pi (`omp` v18.21.0 / v18.22.0) ships a unified `eval` tool that supports **both Python (`language: "py"`) and TypeScript/JavaScript (`language: "js"`, running on Bun)**. In the `"js"` backend, TypeScript syntax is transparently transpiled by `Bun.Transpiler({ loader: "ts" })` both in inline cells and when importing local `.ts`/`.tsx`/`.mts` files via `LocalModuleLoader`. Both runtimes expose identical host bridges for spawning subagents (`agent`, `workpool`, `wait`), native judgment (`judge`, `judge_batch`/`judgeBatch`), tool invocation (`tool.<name>`), kernel-defined subagent tools (`@tool` / `tool()`), shell commands (`sh`), and TUI status/budgets (`phase`, `log`, `budget`).

Furthermore, in OMP 18.21+, the magic keyword that triggers `workflow-notice.md` is literally **`workflowz`** (`src/modes/magic-keywords.ts:124-131`).

## Key Findings

### 1. `eval` Supports Both Python (`"py"`) and TypeScript/Bun (`"js"`)
- **Tool schema (`src/tools/eval.ts:78-163`)**: `{ language: "py" | "js", code: string, title?: string, timeout?: number, reset?: boolean }`.
- **TypeScript in `language: "js"` (`src/eval/js/shared/rewrite-imports.ts`, `local-module-loader.ts`)**:
  - Parses cells with `@babel/parser` (`plugins: ["typescript"]`) and strips types via `new Bun.Transpiler({ loader: "ts" })`.
  - Demotes top-level `const`/`let`/`class` bindings so state persists across cells.
  - `LocalModuleLoader` loads `.ts`, `.tsx`, `.mts`, `.js`, `.mjs` from the repository with automatic `mtimeMs` cache invalidation when files change on disk.
- **`%load <path>` (`src/eval/input.ts:30-86`)**: Both `"py"` and `"js"` support standalone `%load path/to/script.ts` (or `.py`), executing a repo script inside the persistent kernel without echoing its source into the chat transcript.

### 2. Prelude Parity: Python vs TypeScript/JS
| Capability | Python (`language: "py"`) | TypeScript/JS (`language: "js"`) |
|---|---|---|
| Spawn subagent | `h = agent(prompt, *, agent=None, label=None, schema=None, schema_mode=None, isolated=None, apply=None, merge=None, tools=None, model=None)` | `const h = await agent(prompt, { agent, label, schema, schemaMode, isolated, apply, merge, tools, model })` |
| Worker pool | `pool = workpool(agent=None, *, name=None, context=None, tools=None, model=None)` | `const pool = await workpool(agent, { name, context, tools, model })` |
| Barrier wait | `wait(handles, timeout=None, *, raise_errors=True)` | `await wait(handles, { timeout, raiseErrors })` |
| Native judgment | `await judge(state, questions, *, images=None)`<br>`b = judge_batch(states, questions, ...)` | `await judge(state, questions, { images })`<br>`const b = await judgeBatch(states, questions, ...)` |
| Define subagent tool | `@tool` (auto-infers JSON Schema from Python type hints) | `tool(fn, { name, description, parameters })` |
| Call session tool | `await tool.workflow_state({ ... })` | `await tool.workflow_state({ ... })` |
| Embedded shell | `sh(cmd, cwd=None, timeout=None)` | ``await sh`cmd ${arg}` `` (auto-escapes template args) |
| TUI & Budget | `phase(title)`, `log(msg)`, `budget.remaining()` | `phase(title)`, `log(msg)`, `await budget.remaining()` |

*(Note: OMP 18.x replaced the v15 `parallel()`, `pipeline()`, and `llm()` helpers with `agent()`, `workpool()`, `wait()`, `completion()`, `judge()`, and `judgeBatch()`, and renamed `agent_type` to `agent`.)*

### 3. Live Validation & Discovered Gotchas
1. **Live TypeScript + `buck-loop` Machine Import Passed**:
   - Tested against `/home/buckleyrobinson/.local/share/mise/installs/oh-my-pi/18.22.0/omp __omp_worker_js_eval_process`.
   - Imported `./extensions/buck-loop/machine.ts` directly inside a `"js"` cell with TypeScript interfaces, verified state persistence across cells, and verified wire execution of `agent()`, `wait()`, and `judge()`.
2. **Compiled Binary Bare-Specifier Bug in `omp` 18.22.0**:
   - In `src/eval/js/shared/local-module-loader.ts:369-390`, bare npm specifiers (`import { parse } from "yaml"`) call `Bun.resolveSync(source, baseDir)`.
   - Because `omp` is a `bun build --compile` binary running without `BUN_BE_BUN=1`, `Bun.resolveSync("yaml", cwd)` searches the embedded `/$bunfs/root/` virtual filesystem instead of `<repo>/node_modules`.
   - **Impact**: Local `.ts` modules that only use relative imports and `node:*`/`bun` builtins (`machine.ts`, `state_machine/index.ts`, `types.ts`, `phase-completion.ts`) import directly. Modules with bare npm imports (`"yaml"`, `"pg"`, `"@sinclair/typebox"`) must either import via relative `./node_modules/...` or be called via `await tool.workflow_state(...)` / ``await sh`bun ...` ``.
3. **Subagent Model Override & Tool Confinement Differences**:
   - Passing `model` to `agent()` requires `task.perCallModel` (`"eval"` or `"on"`) and an operator-approved model pattern (`src/task/structured-subagent.ts:358-464`), OR routing via the `before_subagent_spawn` extension hook (`invocationKind: "eval"`).
   - Built-in tool confinement for `agent()` subagents comes from agent definitions (`.omp/agents/<name>.md`), whereas custom confined tools can be defined right in the `eval` kernel via `@tool` / `tool()` and passed via `tools: ["..."]`.

## Conclusions & Recommendations

1. **Between Python and TypeScript/JS in `eval`, TypeScript/JS (`language: "js"`) is the stronger fit for this repo** because it runs on the built-in Bun worker (zero Python dependency), supports static TypeScript types, can directly import pure repo `.ts` modules like `extensions/buck-loop/machine.ts`, and provides auto-escaped ``await sh`...` `` + `await tool.workflow_state(...)`.
2. **`judge()` and `judgeBatch()` in `eval` are strictly superior to `extensions/jev-tool/`** for loop decisions: they use OMP's native `ChainJudge` (enforcing the native-only tail rule, shared caching, OpenRouter + TypeSafe auth, and session usage ledger accounting) and allow parallel batch ranking via `judgeBatch()`.
3. **Update stale OMP docs in `docs/buck-workflow.md`**: `docs/buck-workflow.md` still documents the OMP v15 keyword (`workflow` instead of `workflowz`) and v15 prelude (`parallel()`, `pipeline()`, `llm()`, `agent_type=` instead of `workpool()`, `wait()`, `completion()`, `judge()`, `judgeBatch()`, `agent=`, and `language: "js" | "py"`).
