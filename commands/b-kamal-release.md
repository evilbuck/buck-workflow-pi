---
description: Tag a release and deploy it with Kamal — detects destinations, warns on uncommitted changes, picks a semver bump, tags, pushes, then kamal deploy
---

# B-Kamal-Release

$ARGUMENTS

> `/b-kamal-release` tags a release and deploys it with Kamal as deterministic code in `extensions/b-kamal-release/`. The flow:
>
> 1. **Pre-checks** — git repo, `kamal` on PATH, `config/deploy.yml` present.
> 2. **Detect environments** — destinations from `config/deploy.<name>.yml`; pick one interactively or pass `-d`/`--destination`.
> 3. **Dirty-tree gate** — warn on uncommitted changes and confirm before proceeding (`--allow-dirty` bypasses; headless aborts).
> 4. **Version** — conventional-commits heuristic picks a default major/minor/patch bump, then a selector confirms or overrides (`--tag`/`--bump` skip the prompt).
> 5. **Tag** — `git tag -a` + push (`--skip-tag`, `--no-push`).
> 6. **Deploy** — `kamal deploy [-d <dest>] [--version=<tag>]` (`--no-version` lets Kamal use its default SHA).
>
> **Flags:** `--tag <v>` · `--bump <major|minor|patch>` · `-d`/`--destination <name>` · `--allow-dirty` · `--skip-tag` · `--no-push` · `--no-version` · `--force` · `--dry-run`
>
> **Cross-platform note:** this code path runs under Pi/OMP **when the extension is loaded**. Without the extension there is no skill fallback — load the extension or run `kamal deploy` directly. `--dry-run` previews the plan without tagging or deploying.
