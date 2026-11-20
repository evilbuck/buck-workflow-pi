---
status: active
date: 2026-11-20
subject: 2026-11-11.host-typebox-mismatch
topics: [typebox, omp, token-attribution, checkSchema]
informs: [plan-host-typebox-mismatch.md]
---

# Diagnosis: token attribution foreign typebox warning under OMP 19

## Symptom

OMP 19.0.1 toasts:

`Warning: Token attribution persistence failed: schema validation used a foreign typebox implementation (Unknown type)`

Not a fix. Diagnosis only.

## Where the toast is built

The prefix is only in `extensions/token-attribution/index.ts` (`message_end`, `agent_end`, `session_shutdown`). The parenthetical is only thrown by `checkSchema` in `extensions/typebox-check.ts` when `Value.Check` raises `Unknown type`.

That pairing is this repo's token-attribution plugin, loaded from `~/projects/development_tools/buck-workflow-pi` (`~/.omp/agent/config.yml`). It is not emitted by the other configured extensions.

Checked and clear of this string and of runtime `Value.Check`:

- `~/.pi/agent/extensions/omarchy-system-theme.ts`
- `~/.pi/agent/git/github.com/tmustier/pi-extensions` (agent-guidance, arcade, code-actions, pi-ralph-wiggum, tab-status, usage-extension, weather)
- `~/.pi/agent/npm/node_modules/context-mode`
- `~/.pi/agent/npm/node_modules/pi-hermes-memory`
- `plugins/buck-workflow`

`pi-mcp-adapter` imports the package name `typebox`, which OMP 19 also rewrites to the legacy shim. It does not call `checkSchema` and does not emit this warning.

## Red loop

Host: `omp` 19.0.1 at `~/.local/share/mise/installs/oh-my-pi/19.0.1/omp`.

Probe: `/tmp/typebox-probe-19/probe.ts`, loaded with `--no-extensions -e` so the user's plugin set was not involved. `node_modules` symlinked to this repo so `@sinclair/typebox/value` resolved. The probe built the same `Type.Object` / `Type.Union` / `Type.Literal` / `Type.Null` shape as `RecordSchema`, then applied `checkSchema`'s gate: use `safeParse` only when `typeof schema === "object"`, otherwise `Value.Check`.

Result (`/tmp/typebox-probe-19/report.json`):

| fact | value |
|---|---|
| `typeof` schema | `function` |
| `safeParse` present | yes, and it is a function |
| object-only gate (`hasSafeParse`) | false |
| `TypeBox.Kind` | absent |
| `Value.Check` | `Error: Unknown type` |

Second probe (`/tmp/typebox-probe-19/safeparse.json`): calling `schema.safeParse(sample)` on that function returned `success: true`.

OMP's own loader only rewrites the exact specifiers `typebox` and `@sinclair/typebox` (`fst` specifier regex, `eI` legacy-typebox path via the `jst` resolver in the 19.0.1 binary). `@sinclair/typebox/value` stays real typebox. The 19 shim (`packages/omptype/src/typebox.ts`, re-exported by `legacy-typebox.ts`) returns callable schemas and attaches `safeParse` with `Object.defineProperty`. `Type.String()`, `Type.Union()`, and `Type.Literal()` are also functions.

## Cause

`hasSafeParse` in `extensions/typebox-check.ts` returns false unless `typeof schema === "object"`. OMP 19 schemas are functions, so the helper ignores a working `safeParse` and calls `Value.Check` on a shim schema. Real typebox then throws `Unknown type`. `checkSchema` rethrows that as the foreign-implementation error. Token attribution catches it and toasts the warning.

The Nov 12 helper assumed an object schema with `safeParse` (OMP 18.19.0 probe). That assumption is false on 19.0.1. The 18.19 smoke also never had to re-parse an existing row: the plan's repeat-insert acceptance box is still open. `parseRecord` is the read-back path (`extensions/token-attribution/db.ts`), used when `insertReconciled` finds an existing row and when `records()` lists rows. A later turn that reconciles or lists a stored row hits `checkSchema` and fails. A first insert of a new key does not call `parseRecord`.

## Same helper, different toast

`extensions/b-save/roles.ts` and `extensions/b-save/types.ts` also call `checkSchema` on `Type.*` schemas. Those paths would throw the same inner error under OMP 19. They are not the warning the user pasted. The other extensions in this package that import `Type` (`code-review-iteration`, `fix-pr-feedback`, `jev-tool`, `sql-memory`, `workflow-state`) pass schemas to the host as tool parameters. They do not call `Value.Check` at runtime, so they do not produce this toast.

## Not the cause

- A second installed copy of token-attribution. Config loads this checkout. No other configured extension contains the warning text.
- A shim with no `safeParse`. On 19.0.1 `safeParse` is present and accepts a well-shaped row. The object gate skips it.
- Vitest. Node resolves `Type` and `Value` to the same `@sinclair/typebox`, so `checkSchema` never sees a function schema. The suite stays green and cannot catch this.

## Left alone

No code change. Probe files are under `/tmp/typebox-probe-19/`, not in the repo. Profile `typebox-probe-19` was used only for the probe runs.
