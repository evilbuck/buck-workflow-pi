# Inspect project token use

Show token totals and estimated cost visible to the current checkout's configured workflow adapter, grouped by branch and provider/model. Other checkouts' or branch runs' private rows stay excluded, including after merge.

## Steps

1. Open OMP in the project checkout you want to inspect, using its configured workflow adapter, and complete at least one assistant turn after Buck Workflow is loaded. Attribution is forward-only; old stats-table rows are not an automatic fallback.
2. Run `/tokens`. If another extension already owns `/tokens`, run `/token-use` instead; it accepts the same argument.
3. To filter a visible branch, run `/tokens <exact-branch-name>` (or `/token-use <exact-branch-name>` after a collision). Otherwise the argument matches project-key substrings among the current scope's retained rows; it does not search other checkouts or private branch runs.
4. Treat dollar amounts as estimates copied from OMP's normalized usage data. `unavailable` means no cost value was recorded. A persistence warning means the turn is not yet durably acknowledged; do not treat a local SQL export as recovery proof.
5. **Eat:** the report names the expected project, shows a non-zero token total, and lists the expected branch and provider/model. A project-substring query instead lists the matching project keys.
