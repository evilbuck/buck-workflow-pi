# Oh My Pi (omp)

> Fork of Pi by Mario Zechner, rewritten as a coding-first surface with LSP, DAP, hashline edits, and native Rust performance.  
> <https://omp.sh> · <https://github.com/can1357/oh-my-pi>

## Context Files

OMP inherits Pi's context file system exactly:

| File | Scope | Purpose |
|---|---|---|
| `AGENTS.md` | Global: `~/.omp/agent/AGENTS.md`; Project: `AGENTS.md` walking up from cwd | Project-specific instructions. All found files concatenated. |
| `SYSTEM.md` | Global: `~/.omp/agent/SYSTEM.md`; Project: `.omp/SYSTEM.md` | Replaces the default system prompt. |
| `APPEND_SYSTEM.md` | Global: `~/.omp/agent/APPEND_SYSTEM.md`; Project: `.omp/APPEND_SYSTEM.md` | Appends to the system prompt. |
| `CLAUDE.md` | Project root | OMP reads `CLAUDE.md` on first launch — settings and plugins transfer from Claude Code. |

**Note:** OMP uses `~/.omp/` as its config root (not `~/.pi/`). Project config lives in `.omp/` (not `.pi/`).

## Skills

OMP inherits Pi's skill system. Same SKILL.md format, same Agent Skills standard.

### Locations

| Scope | Path |
|---|---|
| Global | `~/.omp/agent/skills/` |
| Global (shared) | `~/.agents/skills/` |
| Project | `.omp/skills/` |
| Project (shared) | `.agents/skills/` |

### Cross-Harness Compatibility

> "Your rules, MCP servers, skills, and project context transfer over without rewriting anything."

OMP loads:
- `.claude/skills/` (Claude Code skills)
- `.agents/skills/` (Codex shared skills)
- `~/.claude/` settings on first launch

## Extensions

Same TypeScript extension system as Pi, but under `~/.omp/`:

| Scope | Path |
|---|---|
| Global | `~/.omp/agent/extensions/*.ts` |
| Project | `.omp/extensions/*.ts` |

### `plan-artifact` (bundled with buck-workflow, opt-in)

OMP plan mode has **no exit hook** (no `mode_change` event, no `plan_approved`;
goal mode got `goal_updated`, plan mode got nothing — verified against
pi-coding-agent 18.0.4). The bundled `extensions/plan-artifact.ts` infers the
exit instead: on each `turn_end` it scans session entries for a
`mode_change → "none"` transition whose preceding active mode was `plan`,
then copies the plan the agent wrote at `local://<slug>-plan.md` into the
buck-workflow subject convention `.context/<date>.<slug>/plan-<slug>.md`
(b-plan frontmatter included, so `/b-build` subject resolution finds it).

Disabled by default. Enable via project `.omp/settings.json` (or `.pi/`, or
the global `~/{.pi,.omp}/agent/settings.json`):

```json
{ "buckPlanArtifact": { "enabled": true } }
```

`BUCK_PLAN_ARTIFACT=1|0` overrides all files. Fires at the first `turn_end`
after the exit — abort exits with no follow-up turn are skipped. Dedupes via a
`plan-artifact` session entry, so it is reload-safe and never double-writes.

## Settings

Global: `~/.omp/agent/settings.json`  
Project: `.omp/settings.json`

OMP adds to Pi's settings:
- **Role-based model routing**: assign different models to PLAN, TASK, VISION, COMMIT roles
- **Hashline edits**: content-hash anchors instead of line numbers for token-efficient edits
- **LSP integration**: native in-process LSP for structural refactoring
- **DAP debugger**: real debugger support (dlv, debugpy, lldb-dap)
- **Status line customization**: `StatusLineSegmentId` options (token_total, cost, context_pct)
- **Bash interceptor rules**: `BashInterceptorRule` patterns to redirect shell commands

## Key Differences from Pi

| Feature | Pi | OMP |
|---|---|---|
| Config root | `~/.pi/` | `~/.omp/` |
| LSP | Via extensions | Built-in, in-process |
| DAP Debugger | Not built-in | Built-in (dlv, debugpy, lldb-dap) |
| Edit format | Standard | Hashline edits (content-hash anchors) |
| Model routing | Single model | Role-based (PLAN, TASK, VISION, COMMIT) |
| Claude Code compat | Manual config | Auto-imports CLAUDE.md, settings, plugins |
| Performance | TypeScript | Rust native layer for heavy lifting |

## Other Customization

| Feature | Location |
|---|---|
| Plugins | `omp plugin install <package-name>` |
| MCP integration | Via extensions |
| Hindsight / mnemopi memory | `memory.backend` in `~/.omp/agent/config.yml` — exposes `retain` / `recall` / `reflect` (and optional `learn`) |
| Subagents | Parallel task delegation |
| GitHub as filesystem | Read issues, PRs, diffs natively |

## Buck workflow × OMP memory

Buck keeps **two layers**:

1. **`.context/memory`** — git-portable session records written by `/b-save` (all harnesses).
2. **OMP LTM** — when `memory.backend` is `hindsight` or `mnemopi`, `/b-save` also `retain`s structured session facts via the native tools (not a separate Hindsight client in the skill).

**Prior-work search** (bootstrap, conditional): if OMP → `recall`/`reflect`; else → configured memory skill; fallback → `.context/memory/index.md`.

**Bulk backfill** of an existing markdown tree into Hindsight: `skills/b-memory-import` (`bun …/import-context-memory.ts`). Routine sessions do not run the importer.
