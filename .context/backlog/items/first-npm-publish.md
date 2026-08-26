---
title: First npm publish of buck-workflow (blocked on test gate)
status: active
priority: high
created: 2026-08-12
<<<<<<< HEAD
updated: 2026-08-25
=======
updated: 2026-08-26
>>>>>>> 30e0849 (feat: <short summary>)
completed: null
related: [package.json, scripts/publish.mjs, .github/workflows/test.yml]
---

# First npm publish of buck-workflow

Package is publish-ready as unscoped `buck-workflow`. Its `prepublishOnly:
npm test` gate is now green; release remains pending publish credentials and
execution.

<<<<<<< HEAD
## Tasks
- [x] **BLOCKER resolved 2026-08-25:** `npm test` runs the Node-compatible
      suite under Vitest and the Bun-dependent suites under Bun.
- [x] The PR `Unit tests` check runs this same green contract.
=======
- [ ] **BLOCKER:** green `npm test`. As of 2026-08-26 `npx vitest run` is **307/307** after `vite.config.ts` excluded three bun:test files (`auto-fix`, `import-context-memory`, `import-projects`). Those 79 tests pass under `bun test` and are not in `prepublishOnly`. Re-verify `npm test` before treating this blocker as gone. Original failing files (2026-08-12): `auto-fix.test.ts`, `b-kamal-release/__tests__/wire.test.ts`, `b-commit-improved/__tests__/wire.test.ts`.
>>>>>>> 30e0849 (feat: <short summary>)
- [ ] `npm login` (one time; agent cannot do this)
- [ ] `npm run release -- --dry-run` to preview
- [ ] `npm run release` to publish `--access public`, tag, push (or `-- none` for `0.2.0` verbatim)
- [ ] Verify `npx buck-workflow install` resolves from the registry on a clean machine
- [ ] (Optional) GitHub Action on `v*` tag → `npm publish` with `NPM_TOKEN`
- [ ] (Optional) `.npmignore` with `*.test.mjs`

## Commit note
Working tree also holds an unsaved `b-build-hard` "standalone B-Plan bootstrap" session —
commit the npm-publish files separately.

## See
- Handoff: `.context/2026-08-12.npm-publish-readiness/index.md`
- Memory: `.context/memory/npm-publish-readiness-2026-08-12.md`
