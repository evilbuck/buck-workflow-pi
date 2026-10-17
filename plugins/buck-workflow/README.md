# Buck Workflow for Codex

This is the Codex plugin bundle for Buck Workflow. It packages the portable core of the workflow as Agent Skills; invoke a workflow explicitly with `$b-plan`, `$b-build`, `$b-build-hard`, `$b-review`, `$b-save`, or `$b-commit`, or describe the goal normally and let Codex select a matching skill.

The bundle intentionally does not include the Pi/OMP runtime extensions. Those extensions depend on their host APIs and will be ported to Codex hooks only after an independent design and trust review.

## Included workflows

The bundle includes Buck's lifecycle skills, guardrails, research and presentation helpers, PR/rebase workflows, durable context support, and the supporting review/design utilities they reference.

The shared artifact CLI is self-contained in this bundle and requires Bun plus the declared `package.json` dependencies (`bun install` in this directory). No Pi/OMP extensions are needed. PostgreSQL migrations ship in `migrations/`; file and SQLite modes do not require a database server.

## Install in Codex

Add the repository marketplace from a durable clone:

```bash
git clone https://github.com/evilbuck/buck-workflow-pi ~/.local/share/buck-workflow-pi
codex plugin marketplace add ~/.local/share/buck-workflow-pi
codex plugin marketplace list
```

Restart the Codex desktop app, open the **Plugins Directory**, select the
**Personal** marketplace, and install **Buck Workflow**. Start a new session,
then use `$b-plan` or `/skills` to confirm that the workflow skills loaded.

For a checkout under active development, run `codex plugin marketplace add .`
from the repository root. After updating a clone, run
`codex plugin marketplace upgrade`, restart the app, and update or reinstall
the plugin from the Plugins Directory.

## Development

`skills/` at the repository root is the canonical source. `plugins/buck-workflow/skills/` is a release bundle for Codex and must remain self-contained — never a symlink to the canonical tree. The bundle is a **curated inventory**: every entry is either a byte-for-byte recursive copy of the same-named canonical skill, or one of the two Codex-only skills (`b-build-hard`, `b-commit`) with no canonical twin. When a shipped canonical skill changes, re-copy its full directory into the bundle before publishing — `scripts/codex-plugin.test.ts` (part of `npm test`) enforces exact directory-set and recursive path/byte parity, so a stale or undeclared bundle copy fails CI.

Run `node scripts/sync-storage-bundle.mjs` from the repository root after storage-runtime changes; it synchronizes portable modules, CLI, shared access guidance and immutable SQL resources. `package.json` at the root includes those migrations in npm releases.

The repository marketplace is `.agents/plugins/marketplace.json`. For local
testing, add the repository root with `codex plugin marketplace add .`, then
restart the Codex app and install **Buck Workflow** from the **Personal**
marketplace.
