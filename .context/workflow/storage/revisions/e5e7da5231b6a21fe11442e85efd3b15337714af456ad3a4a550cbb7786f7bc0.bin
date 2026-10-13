---
status: completed
date: 2026-09-18
---

# b-commit-improved ENOBUFS on large staged diffs

Preflight `execFileSync("git", ["diff", "--cached"])` used the default 1 MiB `maxBuffer`. Staged patches larger than that threw `ENOBUFS`; the extension surfaced:

```
Warning: Preflight failed (exit 1): git diff --cached failed: spawnSync git ENOBUFS (stdout or stderr buffer reached maxBuffer size limit)
```
