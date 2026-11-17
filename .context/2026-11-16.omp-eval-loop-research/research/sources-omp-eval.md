# Research Sources: OMP `eval` Tool & `workflow` Mode

1. **Oh My Pi (`@oh-my-pi/pi-coding-agent` v18.21.0 / v18.22.0) — Eval Tool & Settings**
   - Path: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/tools/eval.ts` (lines 78–163)
   - Path: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/eval/settings.ts` (lines 8–32)
   - Path: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/modes/magic-keywords.ts` (lines 124–131)
   - Access date: 2026-11-16
   - Key data: `EvalLanguageToken = "py" | "js"`; `word: "workflowz"` triggers `workflow-notice.md`.

2. **Oh My Pi — JS/TS Eval Kernel & Local Module Loader**
   - Path: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/eval/js/shared/rewrite-imports.ts` (lines 118–138, 1188–1246)
   - Path: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/eval/js/shared/local-module-loader.ts` (lines 18–143, 268–390)
   - Path: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/eval/js/shared/prelude.txt` (lines 1–811)
   - Access date: 2026-11-16
   - Key data: `LOCAL_MODULE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".mts"])`; `Bun.Transpiler({ loader: "ts" })`; `Bun.resolveSync` `/$bunfs/` behavior in compiled binary.

3. **Oh My Pi — Python Eval Kernel Prelude**
   - Path: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/eval/py/prelude.py` (lines 1–1204)
   - Access date: 2026-11-16
   - Key data: `agent`, `workpool`, `wait`, `completion`, `judge`, `judge_batch`, `@tool`, `tool.<name>`, `sh`, `read`, `write`, `output`, `phase`, `log`, `budget`.

4. **Oh My Pi — Host Bridges, Structured Subagents & Native Judgment**
   - Path: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/eval/agent-bridge.ts` (lines 28–40, 197–199)
   - Path: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/task/structured-subagent.ts` (lines 284–464, 604–829)
   - Path: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/eval/judgment-bridge.ts` (lines 153–289)
   - Path: `/home/buckleyrobinson/projects/.cache/oh-my-pi-v18.21.0/packages/coding-agent/src/judgment/index.ts` (lines 209–312, 411)
   - Access date: 2026-11-16
   - Key data: `task.perCallModel` gate, `before_subagent_spawn` hook, `resolveJudge()` native-only tail rule.
