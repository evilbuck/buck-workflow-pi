---
date: 2026-07-24
domains: [implementation, testing, extensions, tooling]
topics: [b-kamal-release, kamal, deploy, git-tag, semver, release, destinations, pi-extension, omp, ctx-ui, conventional-commits]
artifacts:
  - extensions/b-kamal-release/index.ts
  - extensions/b-kamal-release/__tests__/wire.test.ts
  - commands/b-kamal-release.md
  - extensions/index.ts
related:
  - b-pr-improved-worktree-enotdir-2026-07-24.md
priority: medium
status: active
---

# b-kamal-release — tag a release + deploy with Kamal

## What was built
A new extension `extensions/b-kamal-release/` that tags a git release and deploys it
with Kamal as one deterministic command (`/b-kamal-release`). Wired into
`extensions/index.ts` (+3 lines: import + `wireKamalRelease(pi)`) and given a slash
wrapper at `commands/b-kamal-release.md`. No skill counterpart — by user choice the
scope was "extension + command wrapper".

## Flow (orchestrated in code, not agent prose)
1. **Pre-checks** — git repo, `kamal` on PATH (`hasBin` via `kamal --version`),
   `config/deploy.yml` present.
2. **Detect environments** — destinations from `config/deploy.<name>.yml`; pick
   interactively (production-first default) or via `-d`/`--destination`. Errors if
   ambiguous + headless.
3. **Dirty-tree gate** — `ctx.ui.confirm` yes/no with a file sample (the interactive
   "verify that's ok" the user asked for). `--allow-dirty` bypasses; headless aborts
   (never auto-confirms a dirty tree).
4. **Version** — conventional-commits heuristic picks the default bump
   (`BREAKING`/`!:`→major, `feat:`→minor, else→patch; first release→`0.1.0`), then a
   major/minor/patch/Custom selector with the recommended marked. `--tag`/`--bump`
   skip the prompt.
5. **Tag** — `git tag -a` + push (`--skip-tag`, `--no-push`).
6. **Deploy** — `kamal deploy [-d <dest>] [--version=<tag>]`, non-blocking via
   `node:events` `once` so the TUI stays live. `--no-version` lets Kamal use its SHA.

## Key design decisions (from the intake ask)
- **Version scheme**: semver auto-increment, interactive major/minor/patch selector
  with a detected default; user can override or pick Custom. Not explicit-only, not
  date-based, not version-file.
- **Dirty confirm**: interactive `ctx.ui.confirm` (not a deterministic flag-only
  gate) — per user request.
- **Scope**: extension + command wrapper only (no skill).

## Cross-harness API notes (durable for future extensions)
- `ctx.ui` exposes `select`/`confirm`/`input`/`notify`/`setWorkingMessage` +
  `ctx.hasUI` in **both** pi (0.71.1) and OMP. Gate interactive prompts on
  `ctx.hasUI`; fall back to deterministic flags headless.
- `ui.select` takes `string[]` in pi; OMP additionally allows `{label,description}`
  and `initialIndex` in dialog opts. **pi's `ExtensionUIDialogOptions` lacks
  `initialIndex`** — don't rely on it for cross-compat (mark "recommended" in the
  label text instead, as done here).
- tsconfig is `lib: ES2022` → **`Promise.withResolvers` does NOT typecheck**. Used
  `node:events` `once(child, "close")` for the non-blocking deploy instead.
- `ExtensionAPI`/`ExtensionUIDialogOptions` are re-exported from
  `@mariozechner/pi-coding-agent` root — importable for typing.

## Verification
- 27/27 vitest pass (`extensions/b-kamal-release/__tests__/wire.test.ts`): parseArgs,
  semver parse/bump/format, conventional bump heuristic, version proposal (+ prefix
  preservation, first-release), fs destination detection, git helpers (latestTag /
  commitsSince / isDirty / tagExists), wire shape, and deterministic orchestrator
  paths (not-a-repo, not-a-kamal-project, dry-run plan, dirty-abort, --allow-dirty,
  ambiguous-destination, --destination/--no-version).
- LSP diagnostics clean on both new files. tsc: zero errors in
  `extensions/b-kamal-release/*`.
- E2E smoke under Bun (outside vitest): detection → `["production","staging"]`,
  `feat:`→minor, `v1.2.3`→`v1.3.0`, dry-run plan → `kamal deploy -d production
  --version=2.0.0`. Hits the real installed `kamal` binary check.

## Flags
`--tag <v>` · `--bump <major|minor|patch>` · `-d`/`--destination <name>` ·
`--allow-dirty` · `--skip-tag` · `--no-push` · `--no-version` · `--force` · `--dry-run`

## Status / follow-ups
- **Not committed** — `/b-commit` has not run; work is uncommitted alongside the
  prior session's b-pr-improved changes.
- **Live deploy not exercised** — verified everything up to the `kamal deploy` spawn
  (via `--dry-run`); no deploy against real servers/registry was run. Needs a real
  `config/deploy.yml` + registry/SSH to fully validate the deploy step.
- Pre-existing, unrelated failures left as-is: `skills/b-auto-fix` vitest suite
  (`Bun.spawn` under the Node runner) and pre-existing tsc errors in b-flow/buck-mode
  test files + grill-me-dialog + the model-switch TUI block in `extensions/index.ts`.
