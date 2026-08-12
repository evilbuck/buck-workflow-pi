---
title: First npm publish of buck-workflow (blocked on test gate)
status: active
priority: high
created: 2026-08-12
updated: 2026-08-12
completed: null
related: [package.json, scripts/publish.mjs]
---

# First npm publish of buck-workflow

Package is publish-ready as unscoped `buck-workflow`, but `npm publish` is blocked by the
`prepublishOnly: npm test` gate. Resolve that first.

## Tasks
- [ ] **BLOCKER:** green `npm test` (31 pre-existing failures / 3 files) OR scope `prepublishOnly`
      to the publishable surface. Failing files: `skills/b-auto-fix/scripts/auto-fix.test.ts`,
      `extensions/b-kamal-release/__tests__/wire.test.ts` (needs `kamal`), `extensions/b-commit-improved/__tests__/wire.test.ts`.
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
