---
status: active
subject: 2026-08-12.npm-publish-readiness
related: [package.json, scripts/publish.mjs, agent-install_instructions.md, docs/extension-loading.md]
---

# Handoff — npm publish readiness for `buck-workflow` (BLOCKED on test gate)

**Goal:** publish `buck-workflow` to npm as the **unscoped** name `buck-workflow` so
`npx buck-workflow install` resolves for contributors on any harness.

**Status: publish-ready *except* `npm test` gate.** `prepublishOnly: npm test` currently
fails on **31 pre-existing tests** unrelated to this work, so `npm publish` is hard-blocked.
The first task is to green the test gate (or scope it) — see **NEXT**.

## Decisions already made
- **Name:** unscoped `buck-workflow` (was `@buckleyrobinson/buck-workflow`). Verified free on npm.
- **Peers optional:** `@mariozechner/pi-coding-agent` + `@sinclair/typebox` are `optional: true`
  in `peerDependenciesMeta`. The Pi peer is **deprecated** (→ `@earendil-works/pi-coding-agent`,
  v0.73.1) and drags pi-ai/pi-agent/chalk/glob/diff. Without `optional`, npm ≥7 auto-installs it
  on every non-Pi `npx buck-workflow install`.

## Done this session (`~/projects/buck-workflow-pi`)
| File | Change |
|---|---|
| `package.json` | name → `buck-workflow`; `files` allowlist; `publishConfig.access=public`; repo metadata; `engines`; `prepublishOnly: npm test`; `release` script; `peerDependenciesMeta` (both optional); **added the pruned peers to `devDependencies`** (`@mariozechner/pi-ai`/`pi-coding-agent`/`pi-tui` @ `0.73.1`, `@sinclair/typebox` @ `^0.34.52`) |
| `scripts/publish.mjs` | **new** deploy script: auth → clean-tree → `npm version` → already-published guard → test gate → `npm pack --dry-run` → `npm publish --access public` → push tags |
| `package-lock.json` | regenerated via `npm install` |
| `agent-install_instructions.md:95` | `pi install npm:@buckleyrobinson/buck-workflow` → `pi install npm:buck-workflow` |
| `docs/extension-loading.md:109` | stale name comment fixed |

### The peer-prune incident (found + fixed)
Marking the peers `optional` + `npm install` **pruned `node_modules/@mariozechner/*`** (pi-coding-agent,
pi-ai, pi-tui), which the b-flow tests import by value (`createAgentSession`, `getModel`, `Container`/`Text`).
That broke `npm test`. **Fixed** by adding them to `devDependencies` and re-installing — verified the
b-flow test files now pass (they're among the 16 passing files).

## ⛔ BLOCKER — `npm test` / `prepublishOnly` fails on pre-existing tests
`npm test` → **31 failed | 310 passed (341)** across **3 files**, none related to this work:
| File | Cause |
|---|---|
| `skills/b-auto-fix/scripts/auto-fix.test.ts` | `gh` wrapper / git-worktree / pipeline tests — environment-dependent |
| `extensions/b-kamal-release/__tests__/wire.test.ts` | needs `kamal` binary (`gem install kamal`) — not installed here |
| `extensions/b-commit-improved/__tests__/wire.test.ts` | `.context/draft-commit.md` path `existsSync` assertion |

No CI exists to confirm a prior green baseline; these read as environmental/pre-existing.
**First release task:** make these green **or** scope `prepublishOnly` to the publishable
surface (the failing files are an unwired skill + two extensions, not the installer that ships).

## NEXT — for pickup
1. **Resolve the test gate** (above). Without it, `npm publish` is blocked by `prepublishOnly`.
2. **`npm login`** (manual; one time) — agent cannot do this.
3. **Preview:** `npm run release -- --dry-run`.
4. **Publish:** `npm run release` (patch bump, test, `--access public`, tag, push) — or `-- none`
   to publish `0.2.0` verbatim, or `-- minor`/`-- major`.
5. **(Optional) CI:** GitHub Action on `v*` tag → `npm publish` with `NPM_TOKEN`.
6. **(Optional) `.npmignore`:** `*.test.mjs` to slim `scripts/` entries (not needed for secrets).

## Verification done
- `npm pack --dry-run` → `buck-workflow@0.2.0`, **236 files, 691 kB**; `commands/` symlinks
  dereferenced; `.context`/`.env`/`node_modules`/`.git` absent.
- Secret scan of allowed dirs: no real secrets (grep hits were doc prose).
- JSON valid; lock name `buck-workflow`; no stale living-doc refs (historical `.context/` left as record).
- b-flow import regression fixed; b-flow tests pass.

## Commit strategy — IMPORTANT (mixed tree)
Working tree holds **two unrelated changesets**:
- **This npm-publish work:** `package.json`, `package-lock.json`, `agent-install_instructions.md`,
  `docs/extension-loading.md`, `scripts/publish.mjs`.
- **An unsaved `b-build-hard` session** ("standalone B-Plan bootstrap", `current-session.json` →
  `save_completed: false`): `README.md`, `prompts/b-plan.md`, `skills/b-plan/SKILL.md`,
  `skills/b-init-guardrails/scripts/detect-stack.ts`, + its own `.context/2026-08-12.standalone-b-plan-bootstrap/`.
Commit the npm-publish files separately.

## Cross-references
- overhub-api origin: `.context/memory/agents-md-buck-workflow-reference-2026-08-12.md` + backlog
  `items/buck-workflow-pi-upstream-doc-fixes.md` (its npm-name/unpublished tasks are resolved here).
- Memory record: `.context/memory/npm-publish-readiness-2026-08-12.md`
- Backlog item: `.context/backlog/items/first-npm-publish.md`
