---
date: 2026-08-12
domains: [tooling, release, npm]
topics: [npm-publish, buck-workflow, package-json, peer-dependencies, devdependencies, deploy-script, test-gate]
subject: 2026-08-12.npm-publish-readiness
artifacts: [package.json, scripts/publish.mjs, agent-install_instructions.md, docs/extension-loading.md, package-lock.json]
related: [standalone-b-plan-bootstrap-build-2026-08-12.md]
priority: high
status: active
---

# npm publish readiness for buck-workflow (BLOCKED on test gate)

Made `buck-workflow` publish-ready to npm as the **unscoped** name `buck-workflow`. Originated
from the overhub-api AGENTS.md reference work (`agents-md-buck-workflow-reference-2026-08-12.md`).

## Changes
- `package.json`: name → `buck-workflow`; `files` allowlist; `publishConfig.access=public`; repo
  metadata; `engines`; `prepublishOnly: npm test`; `release` script; `peerDependenciesMeta`
  (both peers `optional: true`); **pruned peers re-added to `devDependencies`**.
- `scripts/publish.mjs`: new deploy script.
- `package-lock.json`: regenerated.
- `agent-install_instructions.md` + `docs/extension-loading.md`: stale name refs fixed.

## Peer-prune incident (found + fixed)
`optional` peers + `npm install` pruned `@mariozechner/{pi-coding-agent,pi-ai,pi-tui}`, which b-flow
tests import by value → `npm test` broke. Fixed by pinning them in `devDependencies` (0.73.1 trio +
`@sinclair/typebox@^0.34.52`) and re-installing. b-flow tests verified passing.

## ⛔ Still blocked: `npm test` / `prepublishOnly`
31 pre-existing failures / 3 files, unrelated to this work:
- `skills/b-auto-fix/scripts/auto-fix.test.ts` (gh/git-worktree — env)
- `extensions/b-kamal-release/__tests__/wire.test.ts` (needs `kamal` binary)
- `extensions/b-commit-improved/__tests__/wire.test.ts` (path assertion)

These block `npm publish`. First release task: green the gate or scope `prepublishOnly`.

## Verified
Tarball `buck-workflow@0.2.0` = 236 files / 691 kB; secrets absent; JSON valid; b-flow regression fixed.

## Not done (next session)
Resolve test gate → `npm login` → `npm run release`. No CI yet. Mixed tree (unsaved
standalone-b-plan-bootstrap session) — commit separately.

## Handoff
`.context/2026-08-12.npm-publish-readiness/index.md`
