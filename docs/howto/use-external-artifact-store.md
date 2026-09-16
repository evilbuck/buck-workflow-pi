# Use an external artifact store

Keep Buck plans, research, backlog, and session memory on this machine (and any machine that syncs the XDG dir) when the project gitignores `.context/`.

## Steps

1. Add `.context` to the project's `.gitignore` (no trailing slash — `.context/` only ignores a real directory and would let git commit the symlink) and commit that line. That line is the opt-in.
2. From the project root, run `bun <skills-dir>/_shared/scripts/ensure-context-store.ts` (or start any Buck skill — bootstrap runs the same script when `.context/` is missing).
3. Sync `~/.local/share/buck/` with Syncthing, iCloud, or a private git repo of the store if you want the same tree on another machine. Then clone the project there and run the script again.
4. **Eat:** `readlink .context` prints `…/buck/projects/<host>/<org>/<repo>` and that directory contains `memory/` and `backlog/`. A second run of the script changes nothing.

If `.context/` already exists as a real directory, leave it — the script will not convert it. If the repo has no `origin`, the script mkdirs in-repo `.context/memory` and prints a note. If the symlink exists but the ignore line is gone, the script warns: committing the symlink would leak the home path. Re-add the ignore line.

Team sharing via CSV-at-HEAD + KV is a different path; this how-to is the solo symlink.
