# Install Bubblewrap for restricted stages

Restricted `/buck-loop` command stages run through `workflow_exec`. On Linux that binary is `/usr/bin/bwrap`. If it is missing, the stage fails closed. There is no host-shell fallback.

## Steps

1. Install the `bubblewrap` package from the distro. On Arch: `sudo pacman -S --needed bubblewrap`. On Debian or Ubuntu: `sudo apt-get install bubblewrap`.
2. Confirm the binary is `/usr/bin/bwrap`, not a user-local substitute. Restricted execution spawns that path and no other.
3. **Eat:** `bwrap --version` prints a version line, and `/usr/bin/bwrap` exists. A restricted stage with Bubblewrap missing errors instead of opening host `bash`.

This check covers command isolation only. It does not make host file tools read-only for Git metadata. Durable artifacts inside a restricted stage go through native `workflow_state`, not this shell. See [ADR 0004](../adr/0004-workflow-state-trusted-access.md).
