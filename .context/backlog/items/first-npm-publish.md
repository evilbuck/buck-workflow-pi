---
title: First npm publish of buck-workflow (blocked on test gate)
status: active
priority: high
created: 2026-08-12
updated: 2026-08-25
completed: null
related: [package.json, scripts/publish.mjs, .github/workflows/test.yml]
---

# First npm publish of buck-workflow

Package is publish-ready as unscoped `buck-workflow`. Its `prepublishOnly:
npm test` gate is now green; release remains pending publish credentials and
execution.

## Tasks
- [x] **BLOCKER resolved 2026-08-25:** `npm test` runs the Node-compatible
      suite under Vitest and the Bun-dependent suites under Bun.
- [x] The PR `Unit tests` check runs this same green contract.
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
