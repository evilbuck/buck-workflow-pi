---
description: Run unattended Buck phase loops for one named subject in OMP via installed module import
---

# B-Loop

Arguments:
```text
$ARGUMENTS
```

Run the Buck phased loop runner once inside OMP's Bun `eval` kernel (`language: "js"`, `timeout: 0`) using explicit module import (no magic file-paste directives and no relative `skills/` working-directory assumptions).

Rules:
- Read the exact argument text from the `Arguments:` block above and serialize it safely as a single JSON string literal when replacing `"__BUCK_LOOP_ARGS__"` (never interpolate raw quotes, backslashes, newlines, or backticks inside template strings; pass `""` when empty; never invent or auto-select a subject; never add flags).
- Resolve `skills/b-loop/scripts/eval-buck-loop.ts` from installed OMP plugin/skill/config paths or local `cwd`, import it once via `import()`, and call `runBuckLoop` once with explicit guarded OMP bridges.

```javascript
eval({
  language: "js",
  timeout: 0,
  code: `
const fs = await import("node:fs");
const os = await import("node:os");
const path = await import("node:path");
const { pathToFileURL } = await import("node:url");

const rawArgs = "__BUCK_LOOP_ARGS__";
const home = os.homedir();
const cwd = process.cwd();
const rel = path.join("skills", "b-loop", "scripts", "eval-buck-loop.ts");
const agentDir = (process.env.PI_CODING_AGENT_DIR || "").trim() || path.join(home, ".omp", "agent");
const isFile = (p) => { try { return typeof p === "string" && p.length > 0 && path.isAbsolute(p) && fs.statSync(p).isFile(); } catch { return false; } };
const expand = (p) => (p.startsWith("~/") ? path.join(home, p.slice(2)) : path.resolve(cwd, p));
const stripComment = (line) => line.replace(/\\s+#.*$/, "").trim();
const unquote = (v) => ((v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) ? v.slice(1, -1) : v);

const explicitEnv = (process.env.BUCK_LOOP_RUNNER || "").trim();
let runnerPath;
if (explicitEnv) {
  const expanded = expand(explicitEnv);
  if (!isFile(expanded)) {
    throw new Error("BUCK_LOOP_RUNNER does not point to an existing file: " + expanded);
  }
  runnerPath = expanded;
} else {
  const envCfg = (process.env.PI_CONFIG_FILES || "").split(path.delimiter).map((s) => s.trim()).filter(Boolean);
  const cfgPaths = [...envCfg, path.join(agentDir, "config.yml"), path.join(home, ".omp", "agent", "config.yml")];
  const fromCfg = [];
  for (const cfg of cfgPaths) {
    if (!isFile(cfg)) continue;
    let rawCfg = "";
    try { rawCfg = fs.readFileSync(cfg, "utf8"); } catch { continue; }
    let inExtSection = false;
    let extIndent = 0;
    for (const rawLine of rawCfg.split(/\\r?\\n/)) {
      const cleaned = stripComment(rawLine);
      if (!cleaned || cleaned.startsWith("#")) continue;
      const indent = rawLine.length - rawLine.trimStart().length;
      if (!inExtSection || indent <= extIndent) {
        const hdr = /^(extensions|skills|plugins)\\s*:\\s*$/.exec(cleaned);
        inExtSection = Boolean(hdr);
        extIndent = indent;
        continue;
      }
      if (!cleaned.startsWith("- ")) continue;
      const entry = unquote(cleaned.slice(2).trim());
      if (!entry) continue;
      const base = expand(entry);
      fromCfg.push(path.join(base, rel), path.join(path.dirname(base), rel), path.join(path.dirname(path.dirname(base)), rel));
    }
  }
  const candidates = [
    path.join(cwd, rel),
    path.join(cwd, ".omp", "skills", "b-loop", "scripts", "eval-buck-loop.ts"),
    path.join(cwd, ".agents", "skills", "b-loop", "scripts", "eval-buck-loop.ts"),
    path.join(cwd, ".pi", "skills", "b-loop", "scripts", "eval-buck-loop.ts"),
    path.join(cwd, "node_modules", "@buckleyrobinson", "buck-workflow", rel),
    path.join(cwd, "node_modules", "buck-workflow", rel),
    path.join(path.dirname(agentDir), "plugins", "node_modules", "@buckleyrobinson", "buck-workflow", rel),
    path.join(path.dirname(agentDir), "plugins", "node_modules", "buck-workflow", rel),
    path.join(agentDir, "skills", "b-loop", "scripts", "eval-buck-loop.ts"),
    path.join(agentDir, "managed-skills", "b-loop", "scripts", "eval-buck-loop.ts"),
    path.join(home, ".omp", "plugins", "node_modules", "@buckleyrobinson", "buck-workflow", rel),
    path.join(home, ".omp", "plugins", "node_modules", "buck-workflow", rel),
    path.join(home, ".omp", "agent", "skills", "b-loop", "scripts", "eval-buck-loop.ts"),
    path.join(home, ".omp", "agent", "managed-skills", "b-loop", "scripts", "eval-buck-loop.ts"),
    path.join(home, ".agents", "skills", "b-loop", "scripts", "eval-buck-loop.ts"),
    path.join(home, ".pi", "agent", "skills", "b-loop", "scripts", "eval-buck-loop.ts"),
    ...fromCfg,
  ];
  runnerPath = candidates.find(isFile);
}

if (!runnerPath) {
  throw new Error("Unable to locate installed skills/b-loop/scripts/eval-buck-loop.ts");
}
const mod = await import(pathToFileURL(fs.realpathSync(runnerPath)).href);
return await mod.runBuckLoop({
  args: rawArgs,
  cwd,
  bridges: {
    agent: typeof agent !== "undefined" ? agent : undefined,
    wait: typeof wait !== "undefined" ? wait : undefined,
    judge: typeof judge !== "undefined" ? judge : undefined,
    sh: typeof sh !== "undefined" ? sh : undefined,
    phase: typeof phase !== "undefined" ? phase : undefined,
    log: typeof log !== "undefined" ? log : undefined,
    budget: typeof budget !== "undefined" ? budget : undefined,
    tool: typeof tool !== "undefined" ? tool : undefined,
  },
});
`
});
```

Do not modify or paraphrase the runner source. Execute the `eval` module import call directly.
