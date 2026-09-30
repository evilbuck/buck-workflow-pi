---
date: 2026-09-30
domains: [tooling]
topics: [installer-source-integrity, installer]
subject: 2026-09-09.installer-source-integrity
artifacts: [plan-installer-source-integrity.md]
related: []
priority: medium
status: completed
---

Installer source integrity shipped in `scripts/install.mjs`. Added exported `verifySurfaces()` plus a read-only `--verify` mode (wired via `parseArgs` default `verify: false` and `runVerify()` dispatch in `main()`), `isInsideRoot()` boundary helper, `ensureSymlink({ sourceRoot, relPath })` cross-root classification, a copy-specific `Copied bootstrap detected … Re-run with --force` message on the bootstrap surface, a `summarize()` that counts created/replaced/skipped/conflict/moved, a `— N moved from another source root` run-summary suffix, and HELP text. `README.md` flags table gained the `--verify` row; both `README.md` and `agent-install_instructions.md` now tell users to audit with `--verify` instead of `ls -l`.

Verification: `npx vitest run scripts/install.test.mjs` → 76/76 passed (grew from the original 37). Live smoke `node scripts/install.mjs --verify` on this machine correctly detected a real 2-root split (`/home/buckleyrobinson/.pi/agent` holding 1 destination vs 106 in the dev repo) and exited 1 per the contract — the tool works; the machine genuinely has a split to repair.

Open criterion: the plan's "single-root, exit 0 on this machine" acceptance item reflects a healthy machine state, not current reality — a pre-existing split on this host (pi bootstrap resolved into `~/.pi/agent`) still needs an ordinary installer re-run to consolidate; `--verify` correctly flags it today.
